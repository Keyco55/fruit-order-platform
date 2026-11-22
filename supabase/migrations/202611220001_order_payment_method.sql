-- ============================================================================
-- 결제 방식(payment_method: 계좌입금 / 현장결제) 컬럼 및 12인자 주문 RPC 추가
-- - 기존 11인자 create_fruit_order RPC는 무중단 호환을 위해 그대로 유지
-- ============================================================================

alter table public.orders
  add column if not exists payment_method text not null default 'BANK_TRANSFER'
  check (payment_method in ('BANK_TRANSFER', 'ONSITE'));

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
  p_request_fingerprint text,
  p_payment_method text
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
  v_payment_method text;
  v_item record;
  v_product public.products%rowtype;
  v_subtotal integer;
begin
  if v_idem is not null then
    if p_request_fingerprint is null or length(p_request_fingerprint) <> 64 then
      raise exception '주문 내용 검증값이 필요합니다.';
    end if;
    perform pg_advisory_xact_lock(hashtextextended(v_idem, 0));
    select * into v_existing
    from public.orders
    where idempotency_key = v_idem
    limit 1;
    if found then
      if v_existing.request_fingerprint is distinct from p_request_fingerprint then
        raise exception '같은 요청키의 주문 내용이 다릅니다. 기존 접수를 확인해 주세요.';
      end if;
      return v_existing.id;
    end if;
  end if;

  if v_nickname = '' then
    raise exception '오픈카톡 닉네임을 입력해 주세요.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception '주문할 과일을 1개 이상 선택해 주세요.';
  end if;

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
  v_payment_method := case when p_payment_method = 'ONSITE' then 'ONSITE' else 'BANK_TRANSFER' end;

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
    payment_method,
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
    v_payment_method,
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

revoke all on function public.create_fruit_order(text, text, text, text, text, text, text, text, jsonb, text, text, text) from public, anon, authenticated;
grant execute on function public.create_fruit_order(text, text, text, text, text, text, text, text, jsonb, text, text, text) to service_role;
