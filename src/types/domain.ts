export type ProductCategory = "PICKUP" | "DELIVERY";

export type FulfillmentType = "PICKUP" | "DELIVERY";

export type OrderStatus = "RESERVED" | "READY" | "PICKED_UP" | "CANCELED";

export type OrderSource = "WEB" | "KAKAO_BOT";

export interface StoreSettings {
  id: string;
  branch_code: string;
  store_name: string;
  subtitle: string;
  notice_text: string;
  pickup_guide: string;
  bank_account: string;
  kakao_openchat_url: string;
  admin_pin: string;
  show_price: boolean;
  show_stock: boolean;
  updated_at: string;
}

export interface Product {
  id: string;
  sale_date: string; // YYYY-MM-DD
  category: ProductCategory;
  name: string;
  unit_label: string;
  price: number;
  original_price?: number;
  origin: string;
  brix?: string;
  badge_text?: string;
  description: string;
  images: string[];
  is_limited: boolean;
  total_stock: number;
  remain_stock: number;
  is_received: boolean; // 매장 입고 완료 여부
  is_visible: boolean;
  sort_order: number;
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  unit_label: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
  is_received?: boolean; // 해당 상품의 현재 매장 입고 여부 (조인/매핑 결과)
}

export interface Order {
  id: string;
  order_date: string; // YYYY-MM-DD
  kakao_nickname: string;
  customer_phone?: string;
  customer_phone_last4: string;
  fulfillment_type: FulfillmentType;
  delivery_address?: string;
  total_amount: number;
  status: OrderStatus;
  is_paid: boolean;
  source: OrderSource;
  pickup_time: string;
  memo: string;
  created_at: string;
  items: OrderItem[];
}

export interface ProductAggregation {
  product_id: string;
  product_name: string;
  unit_label: string;
  price: number;
  category: ProductCategory;
  is_limited: boolean;
  total_stock: number;
  remain_stock: number;
  is_received: boolean;
  is_visible: boolean;
  ordered_quantity: number;
  order_count: number;
  ordered_amount: number;
  picked_up_quantity: number;
}

export interface CreateOrderInput {
  kakao_nickname: string;
  customer_phone?: string;
  customer_phone_last4?: string;
  fulfillment_type?: FulfillmentType;
  delivery_address?: string;
  pickup_time?: string;
  memo?: string;
  source?: OrderSource;
  idempotency_key?: string;
  items: Array<{
    product_id: string;
    quantity: number;
  }>;
}

export interface CreateProductInput {
  sale_date?: string;
  category: ProductCategory;
  name: string;
  unit_label: string;
  price: number;
  original_price?: number;
  origin?: string;
  brix?: string;
  badge_text?: string;
  description?: string;
  images?: string[];
  is_limited: boolean;
  total_stock: number;
  remain_stock?: number;
  is_received?: boolean;
  is_visible?: boolean;
  idempotency_key?: string;
}
