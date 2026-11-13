-- ============================================================================
-- 과일 가게 모바일 웹 주문 및 오픈카톡 자동 집계 시스템 (Supabase PostgreSQL Schema)
-- ============================================================================

create extension if not exists "pgcrypto";

-- 1. 매장 기본 설정 (store_settings)
create table if not exists public.store_settings (
  id uuid primary key default gen_random_uuid(),
  branch_code text not null unique default 'main',
  store_name text not null default '우리동네 과일가게',
  subtitle text not null default '매일 새벽 가락시장 경매 직송 신선 과일',
  notice_text text not null default '🍓 오늘 주문건은 오후 2시 이후 매장 픽업 가능합니다. 오픈카톡방에 주문서를 붙여넣어 주세요!',
  pickup_guide text not null default '영업시간: 10:00 ~ 20:30 (매장 앞 정차 픽업 가능)',
  bank_account text not null default '카카오뱅크 3333-01-2345678 (예금주: 우리동네청과)',
  kakao_openchat_url text not null default 'https://open.kakao.com/o/gFruitDemo',
  admin_pin text not null default '1234',
  show_price boolean not null default true,
  show_stock boolean not null default true,
  updated_at timestamptz not null default now()
);

-- 2. 일별 판매 과일 (products)
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  sale_date date not null default current_date,
  category text not null default 'TODAY' check (category in ('TODAY', 'RESERVE', 'GIFT_SET')),
  name text not null,
  unit_label text not null default '1팩',
  price integer not null check (price >= 0),
  original_price integer,
  origin text not null default '국산',
  brix text,
  badge_text text,
  description text not null default '',
  images text[] not null default '{}',
  is_limited boolean not null default true,
  total_stock integer not null default 30,
  remain_stock integer not null default 30,
  is_received boolean not null default false,
  is_visible boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- 3. 고객 주문 마스터 (orders)
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_date date not null default current_date,
  kakao_nickname text not null,
  customer_phone_last4 text not null default '',
  total_amount integer not null check (total_amount >= 0),
  status text not null default 'RESERVED' check (status in ('RESERVED', 'READY', 'PICKED_UP', 'CANCELED')),
  is_paid boolean not null default false,
  source text not null default 'WEB' check (source in ('WEB', 'KAKAO_BOT')),
  pickup_time text not null default '오늘 오후 방문',
  memo text not null default '',
  created_at timestamptz not null default now()
);

-- 4. 주문 상세 품목 (order_items)
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  product_name text not null,
  unit_label text not null,
  unit_price integer not null,
  quantity integer not null check (quantity > 0),
  subtotal integer not null
);

create index if not exists idx_products_sale_date on public.products(sale_date, sort_order);
create index if not exists idx_orders_nickname on public.orders(kakao_nickname, created_at desc);
create index if not exists idx_orders_order_date on public.orders(order_date, created_at desc);
create index if not exists idx_order_items_order_id on public.order_items(order_id);
create index if not exists idx_order_items_product_id on public.order_items(product_id);
