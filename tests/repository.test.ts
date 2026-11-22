import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  buildProductAggregations,
  enrichAndFilterOrders,
  normalizePhoneDigits,
  sanitizeOrdersForPublic,
} from "../src/lib/store-helpers";
import {
  adjustProductStockAdmin,
  createOrder,
  createProductAdmin,
  deleteProductAdmin,
  getDataSourceMode,
  getOrders,
  getProducts,
  getStoreSettings,
  reorderProductsAdmin,
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
        payment_method: "BANK_TRANSFER",
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
        payment_method: "BANK_TRANSFER",
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
        payment_method: "BANK_TRANSFER",
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
        payment_method: "BANK_TRANSFER",
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

  it("부분 닉네임·4자리 미만 전화번호 조회는 차단되고 공개 응답에서 전화번호 원문은 제거되어야 한다", () => {
    const orders: Order[] = [
      {
        id: "o1",
        order_date: "2026-11-20",
        kakao_nickname: "단골맘",
        customer_phone: "010-1234-5678",
        customer_phone_last4: "5678",
        fulfillment_type: "PICKUP",
        delivery_address: "비공개주소",
        total_amount: 10000,
        status: "RESERVED",
        is_paid: false,
        payment_method: "BANK_TRANSFER",
        source: "WEB",
        pickup_time: "오늘",
        memo: "",
        created_at: "2026-11-20T01:00:00.000Z",
        items: [],
      },
    ];

    assert.equal(
      enrichAndFilterOrders(orders, [], { nickname: "단골", phone: "5678" })
        .length,
      0,
    );
    assert.equal(
      enrichAndFilterOrders(orders, [], { nickname: "단골맘", phone: "78" })
        .length,
      0,
    );
    assert.equal(
      enrichAndFilterOrders(orders, [], { nickname: "", phone: "5678" }).length,
      0,
    );

    const exact = enrichAndFilterOrders(orders, [], {
      nickname: "단골맘",
      phone: "5678",
    });
    assert.equal(exact.length, 1);

    const sanitized = sanitizeOrdersForPublic(exact);
    assert.equal(sanitized[0].customer_phone, undefined);
    assert.equal(sanitized[0].delivery_address, undefined);
    assert.equal(sanitized[0].customer_phone_last4, "");
  });

  it("동일 idempotency_key로 중복 상품 등록·주문을 요청해도 1건만 생성되어야 한다", async () => {
    await resetDemoDatabase();

    const p1 = await createProductAdmin({
      category: "PICKUP",
      name: "테스트 무화과",
      unit_label: "1팩",
      price: 9000,
      is_limited: true,
      total_stock: 0,
      idempotency_key: "prod-idem-1",
    });
    assert.equal(p1.total_stock, 0);
    assert.equal(p1.remain_stock, 0);

    const p2 = await createProductAdmin({
      category: "PICKUP",
      name: "테스트 무화과",
      unit_label: "1팩",
      price: 9000,
      is_limited: true,
      total_stock: 0,
      idempotency_key: "prod-idem-1",
    });
    assert.equal(p1.id, p2.id);

    const adjusted = await adjustProductStockAdmin(p1.id, 5);
    assert.equal(adjusted.remain_stock, 5);
    assert.equal(adjusted.total_stock, 5);

    const o1 = await createOrder({
      kakao_nickname: "중복방지고객",
      customer_phone: "010-5555-6666",
      idempotency_key: "order-idem-1",
      items: [{ product_id: p1.id, quantity: 2 }],
    });
    const o2 = await createOrder({
      kakao_nickname: "중복방지고객",
      customer_phone: "010-5555-6666",
      idempotency_key: "order-idem-1",
      items: [{ product_id: p1.id, quantity: 2 }],
    });
    assert.equal(o1.id, o2.id);

    const afterProducts = await getProducts({ includeHidden: true });
    const target = afterProducts.find((p) => p.id === p1.id)!;
    assert.equal(target.remain_stock, 3);

    // 주문이 연결된 상품도 삭제 가능하며 주문 기록은 보존되어야 함
    await deleteProductAdmin(p1.id);
    const afterDeleteProducts = await getProducts({ includeHidden: true });
    assert.equal(
      afterDeleteProducts.some((p) => p.id === p1.id),
      false,
    );

    const preservedOrders = await getOrders({
      nickname: "중복방지고객",
      phone: "6666",
    });
    assert.equal(preservedOrders.length, 1);
    assert.equal(preservedOrders[0].items[0].product_id, null);
  });

  it("관리자 상품 노출 순서 변경(reorderProductsAdmin)이 sort_order를 영속 반영한다", async () => {
    await resetDemoDatabase();

    const before = await getProducts({ includeHidden: true });
    assert.ok(before.length >= 3);
    const first = before[0];
    const last = before[before.length - 1];

    const reorderedIds = [
      last.id,
      ...before.slice(0, before.length - 1).map((p) => p.id),
    ];
    const after = await reorderProductsAdmin(reorderedIds);
    assert.equal(after[0].id, last.id);
    assert.equal(after[0].sort_order, 1);
    assert.equal(after[1].id, first.id);
    assert.equal(after[1].sort_order, 2);

    const visible = await getProducts({ includeHidden: false });
    assert.equal(visible[0].id, last.id);
  });
});
