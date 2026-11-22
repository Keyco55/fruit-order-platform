import crypto from "node:crypto";
import { orderFingerprint, validateOrderInput } from "@/lib/order-validation";
import type { OrderQuery } from "@/lib/order-period";
import { createInitialSeedData } from "@/lib/store";
import {
  buildProductAggregations,
  enrichAndFilterOrders,
  getKstDateString,
} from "@/lib/store-helpers";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type {
  CreateOrderInput,
  CreateProductInput,
  Order,
  OrderItem,
  OrderStatus,
  Product,
  ProductAggregation,
  StoreSettings,
} from "@/types/domain";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

interface RawProductRow {
  id: string;
  sale_date: string;
  category: Product["category"];
  name: string;
  unit_label: string;
  price: number;
  original_price: number | null;
  origin: string;
  brix: string | null;
  badge_text: string | null;
  description: string;
  images: string[] | null;
  is_limited: boolean;
  total_stock: number;
  remain_stock: number;
  stock_version: number;
  is_received: boolean;
  is_visible: boolean;
  sort_order: number;
  created_at: string;
}

interface RawOrderItemRow {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  unit_label: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
}

interface RawOrderRow {
  id: string;
  order_date: string;
  kakao_nickname: string;
  customer_phone: string | null;
  customer_phone_last4: string;
  fulfillment_type: Order["fulfillment_type"];
  delivery_address: string | null;
  total_amount: number;
  status: OrderStatus;
  is_paid: boolean;
  source: Order["source"];
  pickup_time: string;
  memo: string;
  created_at: string;
  order_items?: RawOrderItemRow[] | null;
}

function mapProductRow(row: RawProductRow): Product {
  return {
    id: row.id,
    sale_date: row.sale_date,
    category: row.category,
    name: row.name,
    unit_label: row.unit_label,
    price: row.price,
    original_price: row.original_price ?? undefined,
    origin: row.origin,
    brix: row.brix ?? undefined,
    badge_text: row.badge_text ?? undefined,
    description: row.description,
    images: Array.isArray(row.images) ? row.images : [],
    is_limited: row.is_limited,
    total_stock: row.total_stock,
    remain_stock: row.remain_stock,
    stock_version: row.stock_version ?? 0,
    is_received: row.is_received,
    is_visible: row.is_visible,
    sort_order: row.sort_order,
    created_at: row.created_at,
  };
}

function mapOrderRow(row: RawOrderRow): Order {
  const items: OrderItem[] = (row.order_items ?? []).map((item) => ({
    id: item.id,
    order_id: item.order_id,
    product_id: item.product_id,
    product_name: item.product_name,
    unit_label: item.unit_label,
    unit_price: item.unit_price,
    quantity: item.quantity,
    subtotal: item.subtotal,
  }));

  return {
    id: row.id,
    order_date: row.order_date,
    kakao_nickname: row.kakao_nickname,
    customer_phone: row.customer_phone ?? "",
    customer_phone_last4: row.customer_phone_last4,
    fulfillment_type: row.fulfillment_type,
    delivery_address: row.delivery_address ?? "",
    total_amount: row.total_amount,
    status: row.status,
    is_paid: row.is_paid,
    source: row.source,
    pickup_time: row.pickup_time,
    memo: row.memo,
    created_at: row.created_at,
    items,
  };
}

function throwIfError(
  error: { message: string } | null,
  fallback: string,
): void {
  if (error) {
    throw new Error(error.message || fallback);
  }
}

export async function migrateAdminCredentialSupabase(
  expected: string,
  hashed: string,
): Promise<StoreSettings> {
  const current = await getStoreSettingsSupabase();
  const { data, error } = await getSupabaseAdminClient()
    .from("store_settings")
    .update({ admin_pin: hashed, updated_at: new Date().toISOString() })
    .eq("id", current.id)
    .eq("admin_pin", expected)
    .select("*")
    .maybeSingle();
  throwIfError(error, "인증 정보를 저장하지 못했습니다.");
  if (!data) throw new Error("인증 정보가 변경됐습니다. 다시 로그인해 주세요.");
  return data as StoreSettings;
}

export async function getStoreSettingsSupabase(): Promise<StoreSettings> {
  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("store_settings")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  throwIfError(error, "매장 설정을 불러오지 못했습니다.");

  if (data) {
    return data as StoreSettings;
  }

  // 최초 부팅 시 store_settings가 비어 있으면 기본 매장 설정 자동 생성
  const seed = createInitialSeedData().settings;
  const { id: _unusedId, ...defaultSettings } = seed;
  const { data: inserted, error: insertError } = await client
    .from("store_settings")
    .upsert(defaultSettings, { onConflict: "branch_code" })
    .select("*")
    .single();

  throwIfError(insertError, "기본 매장 설정을 초기화하지 못했습니다.");
  return inserted as StoreSettings;
}

export async function updateStoreSettingsSupabase(
  patch: Partial<Omit<StoreSettings, "id" | "branch_code">>,
): Promise<StoreSettings> {
  const client = getSupabaseAdminClient();
  const current = await getStoreSettingsSupabase();

  const sanitizedPatch = { ...patch } as Record<string, unknown>;
  delete sanitizedPatch.id;
  delete sanitizedPatch.branch_code;
  sanitizedPatch.updated_at = new Date().toISOString();

  const { data, error } = await client
    .from("store_settings")
    .update(sanitizedPatch)
    .eq("id", current.id)
    .select("*")
    .single();

  throwIfError(error, "매장 설정 저장에 실패했습니다.");
  return data as StoreSettings;
}

export async function getProductsSupabase(options?: {
  includeHidden?: boolean;
}): Promise<Product[]> {
  const client = getSupabaseAdminClient();
  let query = client
    .from("products")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (!options?.includeHidden) {
    query = query.eq("is_visible", true);
  }

  const { data, error } = await query;
  throwIfError(error, "상품 목록을 불러오지 못했습니다.");
  return ((data ?? []) as RawProductRow[]).map(mapProductRow);
}

export async function getOrdersSupabase(
  options?: OrderQuery,
): Promise<Order[]> {
  const client = getSupabaseAdminClient();
  const raw: RawOrderRow[] = [];
  let offset = 0;
  while (true) {
    let query = client
      .from("orders")
      .select("*, order_items(*)", { count: "exact" })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
    if (options?.nickname !== undefined) {
      const nick = options.nickname.trim().toLowerCase().replace(/\s+/g, "");
      if (!nick) return [];
      query = query.eq("nickname_lookup", nick);
    }
    const phone = options?.phone ?? options?.phoneLast4;
    if (phone !== undefined) {
      const digits = phone.replace(/\D/g, "");
      if (!/^(?:\d{4}|\d{9,13})$/.test(digits)) return [];
      query =
        digits.length === 4
          ? query.eq("customer_phone_last4", digits)
          : query.or(
              `phone_lookup.eq.${digits},and(phone_lookup.eq.,customer_phone_last4.eq.${digits.slice(-4)})`,
            );
    }
    if (options?.includeCanceled === false)
      query = query.neq("status", "CANCELED");
    if (options?.fromDate) query = query.gte("order_date", options.fromDate);
    if (options?.toDate) query = query.lte("order_date", options.toDate);
    const { data, count, error } = await query.range(offset, offset + 499);
    throwIfError(error, "주문 내역을 불러오지 못했습니다.");
    const page = (data ?? []) as RawOrderRow[];
    raw.push(...page);
    offset += page.length;
    if (!page.length || (count !== null && offset >= count)) break;
  }
  // 품목이 참조하는 상품만 조회해 상품 목록 자체의 반환 상한에도 영향을 받지 않는다.
  const ids = [
    ...new Set(
      raw.flatMap((o) =>
        (o.order_items ?? [])
          .map((i) => i.product_id)
          .filter((id): id is string => !!id),
      ),
    ),
  ];
  const products: Array<Pick<Product, "id" | "is_received">> = [];
  for (let i = 0; i < ids.length; i += 200) {
    const res = await client
      .from("products")
      .select("id, is_received")
      .in("id", ids.slice(i, i + 200));
    throwIfError(res.error, "상품 입고 상태를 불러오지 못했습니다.");
    products.push(...(res.data ?? []));
  }
  return enrichAndFilterOrders(raw.map(mapOrderRow), products, options);
}

async function getOrderByIdSupabase(orderId: string): Promise<Order> {
  const client = getSupabaseAdminClient();
  const [orderRes, productsRes] = await Promise.all([
    client
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", orderId)
      .single(),
    client.from("products").select("id, is_received"),
  ]);

  throwIfError(orderRes.error, "주문 상세 정보를 불러오지 못했습니다.");
  throwIfError(productsRes.error, "상품 입고 상태를 불러오지 못했습니다.");

  const mapped = mapOrderRow(orderRes.data as RawOrderRow);
  const products = (productsRes.data ?? []) as Array<
    Pick<Product, "id" | "is_received">
  >;
  return enrichAndFilterOrders([mapped], products, {
    includeCanceled: true,
  })[0];
}

export async function getProductAggregationsSupabase(): Promise<
  ProductAggregation[]
> {
  const [products, activeOrders] = await Promise.all([
    getProductsSupabase({ includeHidden: true }),
    getOrdersSupabase({ includeCanceled: false }),
  ]);
  return buildProductAggregations(products, activeOrders);
}

export async function createOrderSupabase(
  input: CreateOrderInput,
): Promise<Order> {
  input = validateOrderInput(input);
  const fingerprint = orderFingerprint(input);
  const nickname = (input.kakao_nickname ?? "").trim();
  if (!nickname) {
    throw new Error("오픈카톡 닉네임을 입력해 주세요.");
  }

  if (!input.items || input.items.length === 0) {
    throw new Error("주문할 과일을 1개 이상 선택해 주세요.");
  }

  const validItems = input.items.filter((i) => i.quantity > 0);
  if (validItems.length === 0) {
    throw new Error("유효한 주문 수량이 없습니다.");
  }

  for (const item of validItems) {
    if (!isValidUuid(item.product_id)) {
      throw new Error("존재하지 않거나 판매 종료된 과일이 포함되어 있습니다.");
    }
  }

  const client = getSupabaseAdminClient();
  const { data: orderId, error } = await client.rpc("create_fruit_order", {
    p_kakao_nickname: nickname,
    p_customer_phone: input.customer_phone ?? "",
    p_customer_phone_last4: input.customer_phone_last4 ?? "",
    p_fulfillment_type: input.fulfillment_type ?? null,
    p_delivery_address: input.delivery_address ?? "",
    p_pickup_time: input.pickup_time ?? null,
    p_memo: input.memo ?? "",
    p_source: input.source ?? "WEB",
    p_items: validItems,
    p_idempotency_key: input.idempotency_key?.trim() || null,
    p_request_fingerprint: fingerprint,
  });

  if (error || !orderId) {
    throw new Error(error?.message || "주문 처리 중 오류가 발생했습니다.");
  }

  return getOrderByIdSupabase(String(orderId));
}

export async function updateOrderAdminSupabase(
  orderId: string,
  patch: {
    status?: OrderStatus;
    is_paid?: boolean;
    memo?: string;
    pickup_time?: string;
  },
): Promise<Order> {
  if (!isValidUuid(orderId)) {
    throw new Error("주문을 찾을 수 없습니다.");
  }

  const client = getSupabaseAdminClient();
  const { error } = await client.rpc("update_fruit_order_admin", {
    p_order_id: orderId,
    p_status: patch.status ?? null,
    p_is_paid: patch.is_paid ?? null,
    p_memo: patch.memo ?? null,
    p_pickup_time: patch.pickup_time ?? null,
  });

  if (error) {
    throw new Error(error.message || "주문 상태 변경에 실패했습니다.");
  }

  return getOrderByIdSupabase(orderId);
}

export async function createProductAdminSupabase(
  input: CreateProductInput,
): Promise<Product> {
  const client = getSupabaseAdminClient();
  const idemKey = input.idempotency_key?.trim() || null;

  if (idemKey) {
    const { data: existing, error: existingErr } = await client
      .from("products")
      .select("*")
      .eq("idempotency_key", idemKey)
      .maybeSingle();
    throwIfError(existingErr, "중복 상품 여부를 확인하지 못했습니다.");
    if (existing) {
      return mapProductRow(existing as RawProductRow);
    }
  }

  const { data: topRows, error: sortErr } = await client
    .from("products")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1);

  throwIfError(sortErr, "상품 정렬 순서를 조회하지 못했습니다.");

  const maxSort = topRows?.[0]?.sort_order ?? 0;
  const totalStock = input.is_limited
    ? Math.max(0, Math.floor(Number(input.total_stock ?? 0)))
    : 999;
  const remainStock = input.is_limited
    ? Math.min(
        totalStock,
        Math.max(0, Math.floor(Number(input.remain_stock ?? totalStock))),
      )
    : 999;

  const insertPayload = {
    sale_date: input.sale_date ?? getKstDateString(),
    category: input.category,
    name: input.name.trim(),
    unit_label: input.unit_label.trim() || "1팩",
    price: Math.max(0, Math.floor(Number(input.price) || 0)),
    original_price: input.original_price
      ? Math.max(0, Math.floor(Number(input.original_price)))
      : null,
    origin: (input.origin ?? "국산").trim(),
    brix: input.brix?.trim() || null,
    badge_text: input.badge_text?.trim() || null,
    description: (input.description ?? "").trim(),
    images:
      input.images && input.images.length > 0
        ? input.images
        : [
            "https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=900&q=80",
          ],
    is_limited: input.is_limited,
    total_stock: totalStock,
    remain_stock: remainStock,
    is_received: input.is_received ?? true,
    is_visible: input.is_visible ?? true,
    sort_order: maxSort + 1,
    idempotency_key: idemKey,
  };

  const { data, error } = await client
    .from("products")
    .insert(insertPayload)
    .select("*")
    .single();

  if (error && error.code === "23505" && idemKey) {
    const { data: dupRow, error: dupErr } = await client
      .from("products")
      .select("*")
      .eq("idempotency_key", idemKey)
      .single();
    throwIfError(dupErr, "중복 등록 상품 조회에 실패했습니다.");
    return mapProductRow(dupRow as RawProductRow);
  }

  throwIfError(error, "상품 등록에 실패했습니다.");
  return mapProductRow(data as RawProductRow);
}

export async function updateProductAdminSupabase(
  productId: string,
  patch: Partial<Omit<Product, "id" | "created_at">>,
  expectedStockVersion?: number,
): Promise<Product> {
  if (!isValidUuid(productId)) {
    throw new Error("상품을 찾을 수 없습니다.");
  }

  const client = getSupabaseAdminClient();
  const sanitizedPatch = { ...patch } as Record<string, unknown>;
  delete sanitizedPatch.id;
  delete sanitizedPatch.created_at;

  delete sanitizedPatch.stock_version;
  const stockChange = ["remain_stock", "total_stock", "is_limited"].some(
    (k) => k in sanitizedPatch,
  );
  if (stockChange && !Number.isInteger(expectedStockVersion))
    throw new Error("재고 수정에는 최신 버전이 필요합니다. 새로고침해 주세요.");
  for (const key of ["remain_stock", "total_stock"]) {
    if (
      sanitizedPatch[key] !== undefined &&
      (!Number.isInteger(sanitizedPatch[key]) ||
        Number(sanitizedPatch[key]) < 0)
    )
      throw new Error("재고는 0 이상의 정수여야 합니다.");
  }
  let query = client
    .from("products")
    .update(sanitizedPatch)
    .eq("id", productId);
  if (stockChange) query = query.eq("stock_version", expectedStockVersion!);
  const { data, error } = await query.select("*").maybeSingle();

  throwIfError(error, "상품 수정에 실패했습니다.");
  if (!data) {
    throw new Error(
      "재고가 변경됐거나 상품이 없습니다. 최신 데이터를 확인한 뒤 다시 저장해 주세요.",
    );
  }
  return mapProductRow(data as RawProductRow);
}

export async function adjustProductStockAdminSupabase(
  productId: string,
  delta: number,
): Promise<Product> {
  if (!isValidUuid(productId)) {
    throw new Error("상품을 찾을 수 없습니다.");
  }

  const client = getSupabaseAdminClient();
  const { data, error } = await client.rpc("adjust_fruit_product_stock", {
    p_product_id: productId,
    p_delta: Math.trunc(delta),
  });

  if (error || !data) {
    throw new Error(error?.message || "재고 수량 조정에 실패했습니다.");
  }

  return mapProductRow(data as RawProductRow);
}

export async function deleteProductAdminSupabase(
  productId: string,
): Promise<void> {
  if (!isValidUuid(productId)) {
    return;
  }

  const client = getSupabaseAdminClient();
  const { error } = await client.from("products").delete().eq("id", productId);

  throwIfError(error, "상품 삭제에 실패했습니다.");
}

export async function reorderProductsAdminSupabase(
  orderedIds: string[],
): Promise<Product[]> {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    throw new Error("정렬할 상품 순서 목록이 필요합니다.");
  }

  const client = getSupabaseAdminClient();
  const { data: currentRows, error: fetchError } = await client
    .from("products")
    .select("id, sort_order")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  throwIfError(fetchError, "현재 상품 순서를 불러오지 못했습니다.");

  const rows = (currentRows ?? []) as Array<{ id: string; sort_order: number }>;
  const existingById = new Map(rows.map((r) => [r.id, r]));

  const seen = new Set<string>();
  const finalOrder: Array<{ id: string; sort_order: number }> = [];
  for (const rawId of orderedIds) {
    const id = typeof rawId === "string" ? rawId.trim() : "";
    if (!id || !isValidUuid(id) || seen.has(id)) continue;
    const matched = existingById.get(id);
    if (matched) {
      seen.add(id);
      finalOrder.push(matched);
    }
  }
  for (const row of rows) {
    if (!seen.has(row.id)) {
      finalOrder.push(row);
    }
  }

  const updates = finalOrder
    .map((row, index) => ({ id: row.id, prev: row.sort_order, next: index + 1 }))
    .filter((entry) => entry.prev !== entry.next);

  if (updates.length > 0) {
    const results = await Promise.all(
      updates.map((entry) =>
        client
          .from("products")
          .update({ sort_order: entry.next })
          .eq("id", entry.id),
      ),
    );
    for (const res of results) {
      throwIfError(res.error, "상품 노출 순서 저장에 실패했습니다.");
    }
  }

  return getProductsSupabase({ includeHidden: true });
}

export async function resetDemoDatabaseSupabase(): Promise<{
  settings: StoreSettings;
  products: Product[];
  orders: Order[];
}> {
  const client = getSupabaseAdminClient();
  const seed = createInitialSeedData();
  const nilUuid = "00000000-0000-0000-0000-000000000000";

  // 1. 기존 데이터 초기화 (FK 순서 준수)
  const delItems = await client.from("order_items").delete().neq("id", nilUuid);
  throwIfError(delItems.error, "기존 주문 품목 초기화 실패");

  const delOrders = await client.from("orders").delete().neq("id", nilUuid);
  throwIfError(delOrders.error, "기존 주문 초기화 실패");

  const delProducts = await client.from("products").delete().neq("id", nilUuid);
  throwIfError(delProducts.error, "기존 상품 초기화 실패");

  const delSettings = await client
    .from("store_settings")
    .delete()
    .neq("id", nilUuid);
  throwIfError(delSettings.error, "기존 매장 설정 초기화 실패");

  // 2. 매장 설정 삽입
  const { id: _seedSettingId, ...settingInsert } = seed.settings;
  const { data: settingsRow, error: settingsErr } = await client
    .from("store_settings")
    .insert(settingInsert)
    .select("*")
    .single();
  throwIfError(settingsErr, "매장 설정 시드 삽입 실패");

  // 3. 시드 상품 ID를 실제 UUID로 매핑하여 삽입
  const productIdMap = new Map<string, string>();
  const productRows = seed.products.map((p) => {
    const newId = crypto.randomUUID();
    productIdMap.set(p.id, newId);
    return {
      id: newId,
      sale_date: p.sale_date,
      category: p.category,
      name: p.name,
      unit_label: p.unit_label,
      price: p.price,
      original_price: p.original_price ?? null,
      origin: p.origin,
      brix: p.brix ?? null,
      badge_text: p.badge_text ?? null,
      description: p.description,
      images: p.images,
      is_limited: p.is_limited,
      total_stock: p.total_stock,
      remain_stock: p.remain_stock,
      is_received: p.is_received,
      is_visible: p.is_visible,
      sort_order: p.sort_order,
      created_at: p.created_at,
    };
  });

  const { data: insertedProducts, error: prodErr } = await client
    .from("products")
    .insert(productRows)
    .select("*")
    .order("sort_order", { ascending: true });
  throwIfError(prodErr, "상품 시드 삽입 실패");

  // 4. 시드 주문 및 주문 품목 삽입
  const orderRows = seed.orders.map((o) => ({
    id: crypto.randomUUID(),
    seedOrderId: o.id,
    order_date: o.order_date,
    kakao_nickname: o.kakao_nickname,
    customer_phone: o.customer_phone ?? "",
    customer_phone_last4: o.customer_phone_last4,
    fulfillment_type: o.fulfillment_type,
    delivery_address: o.delivery_address ?? "",
    total_amount: o.total_amount,
    status: o.status,
    is_paid: o.is_paid,
    source: o.source,
    pickup_time: o.pickup_time,
    memo: o.memo,
    created_at: o.created_at,
    items: o.items,
  }));

  const orderIdMap = new Map<string, string>();
  const ordersToInsert = orderRows.map(
    ({ seedOrderId, items: _items, ...row }) => {
      orderIdMap.set(seedOrderId, row.id);
      return row;
    },
  );

  const { error: ordErr } = await client.from("orders").insert(ordersToInsert);
  throwIfError(ordErr, "주문 시드 삽입 실패");

  const orderItemsToInsert = orderRows.flatMap((o) =>
    o.items.map((item) => ({
      id: crypto.randomUUID(),
      order_id: orderIdMap.get(o.seedOrderId)!,
      product_id: item.product_id
        ? (productIdMap.get(item.product_id) ?? null)
        : null,
      product_name: item.product_name,
      unit_label: item.unit_label,
      unit_price: item.unit_price,
      quantity: item.quantity,
      subtotal: item.subtotal,
    })),
  );

  const { error: itemErr } = await client
    .from("order_items")
    .insert(orderItemsToInsert);
  throwIfError(itemErr, "주문 품목 시드 삽입 실패");

  const mappedProducts = ((insertedProducts ?? []) as RawProductRow[]).map(
    mapProductRow,
  );
  const mappedOrders = await getOrdersSupabase({ includeCanceled: true });

  return {
    settings: settingsRow as StoreSettings,
    products: mappedProducts,
    orders: mappedOrders,
  };
}
