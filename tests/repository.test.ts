import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  buildProductAggregations,
  enrichAndFilterOrders,
  normalizePhoneDigits,
} from "../src/lib/store-helpers";
import {
  getDataSourceMode,
  getProducts,
  getStoreSettings,
  resetDemoDatabase,
} from "../src/lib/repository";
import { isSupabaseConfigured } from "../src/lib/supabase-admin";
import type { Order, Product } from "../src/types/domain";

describe("리포지토리 및 공통 스토어 헬퍼 검증", () => {
  const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const prevKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterEach(() => {
    if (prevUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
    else delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (prevKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = prevKey;
    else delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it("Supabase 환경변수가 없으면 demo 모드로 안전하게 동작해야 한다", async () => {
    assert.equal(isSupabaseConfigured(), false);
    assert.equal(getDataSourceMode(), "demo");

    await resetDemoDatabase();
    const settings = await getStoreSettings();
    const products = await getProducts();

    assert.equal(settings.branch_code, "yucheon");
    assert.ok(products.length > 0);
  });

  it("Supabase 환경변수가 모두 설정되면 supabase 모드로 전환되어야 한다", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-secret";

    assert.equal(isSupabaseConfigured(), true);
    assert.equal(getDataSourceMode(), "supabase");
  });

  it("전화번호 정규화 및 주문 필터링/입고여부 매핑이 정확히 동작해야 한다", () => {
    assert.equal(normalizePhoneDigits("010-1234-5678"), "01012345678");

    const products: Array<Pick<Product, "id" | "is_received">> = [
      { id: "p1", is_received: false },
    ];
    const orders: Order[] = [
      {
        id: "o1",
        order_date: "2026-11-15",
        kakao_nickname: "후르츠 팬",
        customer_phone: "010-1234-5678",
        customer_phone_last4: "5678",
        fulfillment_type: "PICKUP",
        total_amount: 10000,
        status: "RESERVED",
        is_paid: false,
        source: "WEB",
        pickup_time: "오늘",
        memo: "",
        created_at: "2026-11-15T01:00:00.000Z",
        items: [
          {
            id: "i1",
            order_id: "o1",
            product_id: "p1",
            product_name: "딸기",
            unit_label: "1팩",
            unit_price: 10000,
            quantity: 1,
            subtotal: 10000,
          },
        ],
      },
      {
        id: "o2",
        order_date: "2026-11-15",
        kakao_nickname: "취소고객",
        customer_phone: "010-9999-0000",
        customer_phone_last4: "0000",
        fulfillment_type: "PICKUP",
        total_amount: 10000,
        status: "CANCELED",
        is_paid: false,
        source: "WEB",
        pickup_time: "오늘",
        memo: "",
        created_at: "2026-11-15T02:00:00.000Z",
        items: [],
      },
    ];

    const matched = enrichAndFilterOrders(orders, products, {
      nickname: "후르츠팬",
      phone: "5678",
      includeCanceled: false,
    });

    assert.equal(matched.length, 1);
    assert.equal(matched[0].id, "o1");
    assert.equal(matched[0].items[0].is_received, false);
  });

  it("품목별 집계 헬퍼는 취소된 주문을 제외하고 수량/금액을 합산해야 한다", () => {
    const products: Product[] = [
      {
        id: "p1",
        sale_date: "2026-11-15",
        category: "PICKUP",
        name: "딸기",
        unit_label: "1팩",
        price: 10000,
        origin: "논산",
        description: "",
        images: [],
        is_limited: true,
        total_stock: 10,
        remain_stock: 8,
        is_received: true,
        is_visible: true,
        sort_order: 1,
        created_at: "2026-11-15T00:00:00.000Z",
      },
    ];

    const orders: Order[] = [
      {
        id: "o1",
        order_date: "2026-11-15",
        kakao_nickname: "A",
        customer_phone_last4: "1111",
        fulfillment_type: "PICKUP",
        total_amount: 20000,
        status: "PICKED_UP",
        is_paid: true,
        source: "WEB",
        pickup_time: "오늘",
        memo: "",
        created_at: "2026-11-15T01:00:00.000Z",
        items: [
          {
            id: "i1",
            order_id: "o1",
            product_id: "p1",
            product_name: "딸기",
            unit_label: "1팩",
            unit_price: 10000,
            quantity: 2,
            subtotal: 20000,
          },
        ],
      },
      {
        id: "o2",
        order_date: "2026-11-15",
        kakao_nickname: "B",
        customer_phone_last4: "2222",
        fulfillment_type: "PICKUP",
        total_amount: 30000,
        status: "CANCELED",
        is_paid: false,
        source: "WEB",
        pickup_time: "오늘",
        memo: "",
        created_at: "2026-11-15T02:00:00.000Z",
        items: [
          {
            id: "i2",
            order_id: "o2",
            product_id: "p1",
            product_name: "딸기",
            unit_label: "1팩",
            unit_price: 10000,
            quantity: 3,
            subtotal: 30000,
          },
        ],
      },
    ];

    const aggs = buildProductAggregations(products, orders);
    assert.equal(aggs.length, 1);
    assert.equal(aggs[0].ordered_quantity, 2);
    assert.equal(aggs[0].ordered_amount, 20000);
    assert.equal(aggs[0].picked_up_quantity, 2);
    assert.equal(aggs[0].order_count, 1);
  });
});
