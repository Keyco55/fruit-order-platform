-- 기존 데이터 보존 / 재실행 가능. 운영 적용 전 테스트 DB와 백업을 확인할 것.
begin;
alter table public.products add column if not exists idempotency_key text;
alter table public.products add column if not exists stock_version integer not null default 0;
alter table public.orders add column if not exists idempotency_key text;
alter table public.orders add column if not exists request_fingerprint text;
alter table public.orders add column if not exists nickname_lookup text generated always as (regexp_replace(lower(trim(kakao_nickname)), '[[:space:]]', '', 'g')) stored;
alter table public.orders add column if not exists phone_lookup text generated always as (regexp_replace(customer_phone, '[^0-9]', '', 'g')) stored;
create unique index if not exists idx_products_idempotency_key on public.products(idempotency_key);
create unique index if not exists idx_orders_idempotency_key on public.orders(idempotency_key);
alter table public.store_settings alter column admin_pin set default '!unconfigured';
-- 이미 적용된 기존 제약은 보존한다. 잘못된 재고를 임의로 보정하지 않고 migration을 중단한다.
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.products'::regclass and conname = 'fruit_stock_invariant') then
    alter table public.products add constraint fruit_stock_invariant check (total_stock >= 0 and remain_stock >= 0 and remain_stock <= total_stock);
  end if;
end;
$$;
alter table public.order_items alter column product_id drop not null;
do $$
declare fk record;
begin
  for fk in select conname from pg_constraint where conrelid = 'public.order_items'::regclass and contype = 'f'
    and confrelid = 'public.products'::regclass loop
    execute format('alter table public.order_items drop constraint %I', fk.conname);
  end loop;
end;
$$;
alter table public.order_items add constraint order_items_product_id_fkey foreign key(product_id) references public.products(id) on delete set null;
-- Expand-first: 현재 배포의 10인자 RPC는 유지한다. 새 배포 검증 후 별도 승인으로 제거한다.
-- 11인자는 모두 필수로 두어 기존 default 인자 overload와 호출이 모호해지지 않게 한다.
drop function if exists public.create_fruit_order(text, text, text, text, text, text, text, text, jsonb);

create or replace function public.create_fruit_order(
  p_kakao_nickname text,
  p_customer_phone text,
  p_customer_phone_last4 text,
  p_fulfillment_type text,
  p_delivery_address text,
  p_pickup_time text,
  p_memo text,
  p_source text,
  p_items jsonb,
  p_idempotency_key text,
  p_request_fingerprint text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nickname text := trim(coalesce(p_kakao_nickname, ''));
  v_idem text := nullif(trim(coalesce(p_idempotency_key, '')), '');
  v_existing public.orders%rowtype;
  v_order_id uuid;
  v_total_amount integer := 0;
  v_all_delivery boolean := true;
  v_valid_count integer := 0;
  v_fulfillment text;
  v_raw_phone text := trim(coalesce(p_customer_phone, ''));
  v_phone_digits text;
  v_last4 text;
  v_pickup_time text;
  v_source text;
  v_item record;
  v_product public.products%rowtype;
  v_subtotal integer;
begin
  if v_idem is not null then
    if p_request_fingerprint is null or length(p_request_fingerprint) <> 64 then raise exception '주문 내용 검증값이 필요합니다.'; end if;
    perform pg_advisory_xact_lock(hashtextextended(v_idem, 0));
    select * into v_existing
    from public.orders
    where idempotency_key = v_idem
    limit 1;
    if found then
      if v_existing.request_fingerprint is distinct from p_request_fingerprint then raise exception '같은 요청키의 주문 내용이 다릅니다. 기존 접수를 확인해 주세요.'; end if;
      return v_existing.id;
    end if;
  end if;

  if v_nickname = '' then
    raise exception '오픈카톡 닉네임을 입력해 주세요.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception '주문할 과일을 1개 이상 선택해 주세요.';
  end if;

  -- 동일 상품이 여러 줄로 들어온 경우 합산 후 product_id 순으로 잠금 (데드락 방지)
  for v_item in
    select
      (elem->>'product_id')::uuid as product_id,
      sum((elem->>'quantity')::integer)::integer as quantity
    from jsonb_array_elements(p_items) as elem
    where coalesce((elem->>'quantity')::integer, 0) > 0
    group by (elem->>'product_id')::uuid
    order by (elem->>'product_id')::uuid
  loop
    v_valid_count := v_valid_count + 1;

    select *
    into v_product
    from public.products
    where id = v_item.product_id
    for update;

    if not found or not v_product.is_visible then
      raise exception '존재하지 않거나 판매 종료된 과일이 포함되어 있습니다.';
    end if;

    if v_product.is_limited and v_product.remain_stock < v_item.quantity then
      raise exception '''%'' 상품의 남은 수량(%개)이 부족합니다.', v_product.name, v_product.remain_stock;
    end if;

    if v_product.category <> 'DELIVERY' then
      v_all_delivery := false;
    end if;

    if v_product.is_limited then
      update public.products
      set remain_stock = greatest(0, remain_stock - v_item.quantity)
      where id = v_product.id;
    end if;

    v_total_amount := v_total_amount + (v_product.price * v_item.quantity);
  end loop;

  if v_valid_count = 0 then
    raise exception '유효한 주문 수량이 없습니다.';
  end if;

  if p_fulfillment_type in ('PICKUP', 'DELIVERY') then
    v_fulfillment := p_fulfillment_type;
  elsif v_all_delivery then
    v_fulfillment := 'DELIVERY';
  else
    v_fulfillment := 'PICKUP';
  end if;

  v_phone_digits := regexp_replace(v_raw_phone, '[^0-9]', '', 'g');
  v_last4 := trim(coalesce(p_customer_phone_last4, ''));
  if v_last4 = '' then
    if length(v_phone_digits) >= 4 then
      v_last4 := right(v_phone_digits, 4);
    else
      v_last4 := v_phone_digits;
    end if;
  end if;

  v_pickup_time := trim(coalesce(p_pickup_time, ''));
  if v_pickup_time = '' then
    if v_fulfillment = 'DELIVERY' then
      v_pickup_time := '순차 배송 예정';
    else
      v_pickup_time := '오늘 오후 방문';
    end if;
  end if;

  v_source := case when p_source = 'KAKAO_BOT' then 'KAKAO_BOT' else 'WEB' end;

  insert into public.orders (
    order_date,
    kakao_nickname,
    customer_phone,
    customer_phone_last4,
    fulfillment_type,
    delivery_address,
    total_amount,
    status,
    is_paid,
    source,
    pickup_time,
    memo,
    idempotency_key,
    request_fingerprint
  )
  values (
    (now() at time zone 'Asia/Seoul')::date,
    v_nickname,
    v_raw_phone,
    v_last4,
    v_fulfillment,
    trim(coalesce(p_delivery_address, '')),
    v_total_amount,
    'RESERVED',
    false,
    v_source,
    v_pickup_time,
    trim(coalesce(p_memo, '')),
    v_idem,
    p_request_fingerprint
  )
  returning id into v_order_id;

  for v_item in
    select
      (elem->>'product_id')::uuid as product_id,
      sum((elem->>'quantity')::integer)::integer as quantity
    from jsonb_array_elements(p_items) as elem
    where coalesce((elem->>'quantity')::integer, 0) > 0
    group by (elem->>'product_id')::uuid
    order by (elem->>'product_id')::uuid
  loop
    select * into v_product from public.products where id = v_item.product_id;
    v_subtotal := v_product.price * v_item.quantity;

    insert into public.order_items (
      order_id,
      product_id,
      product_name,
      unit_label,
      unit_price,
      quantity,
      subtotal
    )
    values (
      v_order_id,
      v_product.id,
      v_product.name,
      v_product.unit_label,
      v_product.price,
      v_item.quantity,
      v_subtotal
    );
  end loop;

  return v_order_id;
end;
$$;

-- ============================================================================
-- 원자적 관리자 주문 상태 변경 RPC (취소 시 재고 복원 / 복구 시 재차감 보장)
-- ============================================================================
create or replace function public.update_fruit_order_admin(
  p_order_id uuid,
  p_status text default null,
  p_is_paid boolean default null,
  p_memo text default null,
  p_pickup_time text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_prev_status text;
  v_next_status text;
  v_item record;
  v_product public.products%rowtype;
begin
  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception '주문을 찾을 수 없습니다.';
  end if;

  v_prev_status := v_order.status;
  v_next_status := coalesce(p_status, v_prev_status);

  if v_next_status not in ('RESERVED', 'READY', 'PICKED_UP', 'CANCELED') then
    raise exception '유효하지 않은 주문 상태입니다: %', v_next_status;
  end if;

  -- 취소로 변경 시 한정 수량 재고 복원
  if v_prev_status <> 'CANCELED' and v_next_status = 'CANCELED' then
    for v_item in
      select product_id, sum(quantity)::integer as quantity
      from public.order_items
      where order_id = p_order_id and product_id is not null
      group by product_id
      order by product_id
    loop
      select * into v_product from public.products where id = v_item.product_id for update;
      if found and v_product.is_limited then
        update public.products
        set remain_stock = least(total_stock, remain_stock + v_item.quantity)
        where id = v_product.id;
      end if;
    end loop;
  end if;

  -- 취소 상태에서 활성 상태로 복구 시 재고 재차감
  if v_prev_status = 'CANCELED' and v_next_status <> 'CANCELED' then
    for v_item in
      select product_id, sum(quantity)::integer as quantity
      from public.order_items
      where order_id = p_order_id and product_id is not null
      group by product_id
      order by product_id
    loop
      select * into v_product from public.products where id = v_item.product_id for update;
      if found and v_product.is_limited then
        if v_product.remain_stock < v_item.quantity then
          raise exception '''%'' 재고가 부족하여 주문을 복구할 수 없습니다.', v_product.name;
        end if;
        update public.products
        set remain_stock = remain_stock - v_item.quantity
        where id = v_product.id;
      end if;
    end loop;
  end if;

  update public.orders
  set
    status = v_next_status,
    is_paid = coalesce(p_is_paid, is_paid),
    memo = coalesce(p_memo, memo),
    pickup_time = coalesce(p_pickup_time, pickup_time)
  where id = p_order_id;

  return p_order_id;
end;
$$;

-- ============================================================================
-- 원자적 관리자 재고 증감 RPC (동시 주문 차감 덮어쓰기 방지)
-- ============================================================================
create or replace function public.adjust_fruit_product_stock(
  p_product_id uuid,
  p_delta integer
)
returns public.products
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products%rowtype;
  v_next_remain integer;
  v_next_total integer;
begin
  select *
  into v_product
  from public.products
  where id = p_product_id
  for update;

  if not found then
    raise exception '상품을 찾을 수 없습니다.';
  end if;

  if not v_product.is_limited then
    return v_product;
  end if;

  v_next_remain := greatest(0, v_product.remain_stock + coalesce(p_delta, 0));
  v_next_total := greatest(v_product.total_stock, v_next_remain);

  update public.products
  set
    remain_stock = v_next_remain,
    total_stock = v_next_total
  where id = p_product_id
  returning * into v_product;

  return v_product;
end;
$$;

revoke all on function public.create_fruit_order(text, text, text, text, text, text, text, text, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.create_fruit_order(text, text, text, text, text, text, text, text, jsonb, text, text) to service_role;

-- 이전 서버만 사용하는 호환 RPC도 공개 실행을 허용하지 않는다.
do $$
begin
  if to_regprocedure('public.create_fruit_order(text,text,text,text,text,text,text,text,jsonb,text)') is not null then
    revoke all on function public.create_fruit_order(text,text,text,text,text,text,text,text,jsonb,text) from public, anon, authenticated;
    grant execute on function public.create_fruit_order(text,text,text,text,text,text,text,text,jsonb,text) to service_role;
  end if;
end;
$$;

revoke all on function public.update_fruit_order_admin(uuid, text, boolean, text, text) from public, anon, authenticated;
grant execute on function public.update_fruit_order_admin(uuid, text, boolean, text, text) to service_role;

revoke all on function public.adjust_fruit_product_stock(uuid, integer) from public, anon, authenticated;
grant execute on function public.adjust_fruit_product_stock(uuid, integer) to service_role;


-- 재고가 변경된 모든 경로(주문/취소/RPC/직접 편집)에서 낙관적 잠금 버전을 올린다.
create or replace function public.bump_fruit_stock_version()
returns trigger language plpgsql set search_path = public as $$
begin
  if (new.remain_stock, new.total_stock, new.is_limited) is distinct from
     (old.remain_stock, old.total_stock, old.is_limited) then
    new.stock_version := old.stock_version + 1;
  end if;
  return new;
end;
$$;
drop trigger if exists fruit_stock_version on public.products;
create trigger fruit_stock_version before update on public.products for each row execute function public.bump_fruit_stock_version();

create index if not exists idx_orders_customer_lookup on public.orders(nickname_lookup, customer_phone_last4, created_at desc);

-- 서버 간 공유 요청 제한. IP/credential 원문은 저장하지 않는다.
create table if not exists public.fruit_rate_limits (
  key text primary key,
  count integer not null,
  expires_at timestamptz not null
);
alter table public.fruit_rate_limits enable row level security;
revoke all on table public.fruit_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on public.fruit_rate_limits to service_role;
create or replace function public.consume_fruit_rate_limit(p_key text, p_limit integer, p_window integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  if p_limit < 1 or p_window < 1 or length(p_key) <> 64 then raise exception 'invalid rate limit'; end if;
  insert into public.fruit_rate_limits as bucket(key, count, expires_at)
  values (p_key, 1, now() + make_interval(secs => p_window))
  on conflict (key) do update set
    count = case when bucket.expires_at <= now() then 1 else least(bucket.count + 1, p_limit + 1) end,
    expires_at = case when bucket.expires_at <= now() then now() + make_interval(secs => p_window) else bucket.expires_at end
  returning count into v_count;
  -- 요청에 따른 만료 bucket 정리로 영구 누적 방지. 다른 행 잠금과의 데드락은 SKIP LOCKED로 회피.
  delete from public.fruit_rate_limits where key in
    (select key from public.fruit_rate_limits where expires_at < now() - interval '1 day' limit 100 for update skip locked);
  return v_count <= p_limit;
end;
$$;
revoke all on function public.consume_fruit_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_fruit_rate_limit(text, integer, integer) to service_role;
revoke all on function public.bump_fruit_stock_version() from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
