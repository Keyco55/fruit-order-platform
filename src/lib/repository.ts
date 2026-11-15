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

export function getDataSourceMode(): "supabase" | "demo" {
  return isSupabaseConfigured() ? "supabase" : "demo";
}

export async function getStoreSettings(): Promise<StoreSettings> {
  if (isSupabaseConfigured()) {
    return supabaseStore.getStoreSettingsSupabase();
  }
  return demoStore.getStoreSettings();
}

export async function updateStoreSettings(
  patch: Partial<Omit<StoreSettings, "id" | "branch_code">>
): Promise<StoreSettings> {
  if (isSupabaseConfigured()) {
    return supabaseStore.updateStoreSettingsSupabase(patch);
  }
  return demoStore.updateStoreSettings(patch);
}

export async function getProducts(options?: {
  includeHidden?: boolean;
}): Promise<Product[]> {
  if (isSupabaseConfigured()) {
    return supabaseStore.getProductsSupabase(options);
  }
  return demoStore.getProducts(options);
}

export async function getOrders(options?: {
  nickname?: string;
  phone?: string;
  phoneLast4?: string;
  includeCanceled?: boolean;
}): Promise<Order[]> {
  if (isSupabaseConfigured()) {
    return supabaseStore.getOrdersSupabase(options);
  }
  return demoStore.getOrders(options);
}

export async function getProductAggregations(): Promise<ProductAggregation[]> {
  if (isSupabaseConfigured()) {
    return supabaseStore.getProductAggregationsSupabase();
  }
  return demoStore.getProductAggregations();
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  if (isSupabaseConfigured()) {
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
  }
): Promise<Order> {
  if (isSupabaseConfigured()) {
    return supabaseStore.updateOrderAdminSupabase(orderId, patch);
  }
  return demoStore.updateOrderAdmin(orderId, patch);
}

export async function createProductAdmin(
  input: CreateProductInput
): Promise<Product> {
  if (isSupabaseConfigured()) {
    return supabaseStore.createProductAdminSupabase(input);
  }
  return demoStore.createProductAdmin(input);
}

export async function updateProductAdmin(
  productId: string,
  patch: Partial<Omit<Product, "id" | "created_at">>
): Promise<Product> {
  if (isSupabaseConfigured()) {
    return supabaseStore.updateProductAdminSupabase(productId, patch);
  }
  return demoStore.updateProductAdmin(productId, patch);
}

export async function deleteProductAdmin(productId: string): Promise<void> {
  if (isSupabaseConfigured()) {
    return supabaseStore.deleteProductAdminSupabase(productId);
  }
  demoStore.deleteProductAdmin(productId);
}

export async function resetDemoDatabase(): Promise<{
  settings: StoreSettings;
  products: Product[];
  orders: Order[];
}> {
  if (isSupabaseConfigured()) {
    return supabaseStore.resetDemoDatabaseSupabase();
  }
  return demoStore.resetDemoDatabase();
}
