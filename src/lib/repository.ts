import * as demoStore from "@/lib/store";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import * as supabaseStore from "@/lib/supabase-store";
import type {
  CreateOrderInput,
  CreateProductInput,
  Order,
  OrderStatus,
  Product,
  ProductAggregation,
  StoreSettings,
} from "@/types/domain";
import type { OrderQuery } from "@/lib/order-period";
import { hashPassword } from "@/lib/password";

export function getDataSourceMode(): "supabase" | "demo" {
  const deployment = process.env.VERCEL_ENV;
  if (
    !isSupabaseConfigured() &&
    (deployment === "production" ||
      deployment === "preview" ||
      (process.env.NODE_ENV === "production" &&
        process.env.FRUIT_DEMO_MODE !== "true"))
  ) {
    throw new Error(
      "운영 DB 설정이 필요합니다. 실제 예약을 접수할 수 없습니다.",
    );
  }
  return isSupabaseConfigured() ? "supabase" : "demo";
}

export async function getStoreSettings(): Promise<StoreSettings> {
  if (getDataSourceMode() === "supabase") {
    return supabaseStore.getStoreSettingsSupabase();
  }
  return demoStore.getStoreSettings();
}

export async function updateStoreSettings(
  patch: Partial<Omit<StoreSettings, "id" | "branch_code">>,
): Promise<StoreSettings> {
  if (getDataSourceMode() === "supabase") {
    return supabaseStore.updateStoreSettingsSupabase(patch);
  }
  return demoStore.updateStoreSettings(patch);
}

export async function getProducts(options?: {
  includeHidden?: boolean;
}): Promise<Product[]> {
  if (getDataSourceMode() === "supabase") {
    return supabaseStore.getProductsSupabase(options);
  }
  return demoStore.getProducts(options);
}

export async function getOrders(options?: OrderQuery): Promise<Order[]> {
  if (getDataSourceMode() === "supabase") {
    return supabaseStore.getOrdersSupabase(options);
  }
  return demoStore.getOrders(options);
}

export async function getProductAggregations(): Promise<ProductAggregation[]> {
  if (getDataSourceMode() === "supabase") {
    return supabaseStore.getProductAggregationsSupabase();
  }
  return demoStore.getProductAggregations();
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  if (getDataSourceMode() === "supabase") {
    return supabaseStore.createOrderSupabase(input);
  }
  return demoStore.createOrder(input);
}

export async function updateOrderAdmin(
  orderId: string,
  patch: {
    status?: OrderStatus;
    is_paid?: boolean;
    memo?: string;
    pickup_time?: string;
  },
): Promise<Order> {
  if (getDataSourceMode() === "supabase") {
    return supabaseStore.updateOrderAdminSupabase(orderId, patch);
  }
  return demoStore.updateOrderAdmin(orderId, patch);
}

export async function createProductAdmin(
  input: CreateProductInput,
): Promise<Product> {
  if (getDataSourceMode() === "supabase") {
    return supabaseStore.createProductAdminSupabase(input);
  }
  return demoStore.createProductAdmin(input);
}

export async function updateProductAdmin(
  productId: string,
  patch: Partial<Omit<Product, "id" | "created_at">>,
  expectedStockVersion?: number,
): Promise<Product> {
  if (getDataSourceMode() === "supabase") {
    return supabaseStore.updateProductAdminSupabase(
      productId,
      patch,
      expectedStockVersion,
    );
  }
  return demoStore.updateProductAdmin(productId, patch, expectedStockVersion);
}

export async function migrateAdminCredential(
  expected: string,
  password: string,
): Promise<StoreSettings> {
  const hashed = hashPassword(password);
  if (getDataSourceMode() === "supabase")
    return supabaseStore.migrateAdminCredentialSupabase(expected, hashed);
  if (demoStore.getStoreSettings().admin_pin !== expected)
    throw new Error("인증 정보가 변경됐습니다. 다시 로그인해 주세요.");
  return demoStore.updateStoreSettings({ admin_pin: hashed });
}

export async function adjustProductStockAdmin(
  productId: string,
  delta: number,
): Promise<Product> {
  if (getDataSourceMode() === "supabase") {
    return supabaseStore.adjustProductStockAdminSupabase(productId, delta);
  }
  return demoStore.adjustProductStockAdmin(productId, delta);
}

export async function deleteProductAdmin(productId: string): Promise<void> {
  if (getDataSourceMode() === "supabase") {
    return supabaseStore.deleteProductAdminSupabase(productId);
  }
  demoStore.deleteProductAdmin(productId);
}

export async function reorderProductsAdmin(
  orderedIds: string[],
): Promise<Product[]> {
  if (getDataSourceMode() === "supabase") {
    return supabaseStore.reorderProductsAdminSupabase(orderedIds);
  }
  return demoStore.reorderProductsAdmin(orderedIds);
}

export async function resetDemoDatabase(): Promise<{
  settings: StoreSettings;
  products: Product[];
  orders: Order[];
}> {
  if (getDataSourceMode() === "supabase") {
    throw new Error("실운영 DB 모드에서는 전체 초기화를 실행할 수 없습니다.");
  }
  return demoStore.resetDemoDatabase();
}
