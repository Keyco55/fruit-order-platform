import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import {
  createOrder,
  getProducts,
  getOrders,
  getStoreSettings,
  resetDemoDatabase,
  updateOrderAdmin,
  updateProductAdmin,
  updateStoreSettings,
} from "../src/lib/store";
import { getDataSourceMode } from "../src/lib/repository";
import {
  validateContact,
  validateOrderInput,
  validLookup,
  orderFingerprint,
} from "../src/lib/order-validation";
import { filterOrderPeriod, readPeriod } from "../src/lib/order-period";
import {
  getKstDateString,
  sanitizeOrdersForPublic,
  sanitizeProductsForPublic,
} from "../src/lib/store-helpers";
import { getOrderAttempt, ORDER_ATTEMPT_KEY } from "../src/lib/order-attempt";
import {
  formatKakaoNoticeText,
  ordersToCsv,
  parseKakaoChatMessage,
} from "../src/lib/formatters";
import { verifyPassword } from "../src/lib/password";
import {
  ADMIN_SESSION_COOKIE_NAME,
  createAdminSessionToken,
  verifyAdminSessionToken,
} from "../src/lib/admin-auth";
import {
  GET as ordersGET,
  POST as ordersPOST,
} from "../src/app/api/orders/route";
import { GET as bootstrapGET } from "../src/app/api/bootstrap/route";
import {
  POST as adminProductsPOST,
  PATCH as adminProductsPATCH,
} from "../src/app/api/admin/products/route";
import {
  POST as settingsPOST,
  PATCH as settingsPATCH,
} from "../src/app/api/admin/settings/route";
import { POST as webhookPOST } from "../src/app/api/webhook/kakao/route";

const body = () => ({
  kakao_nickname: "QA 고객",
  customer_phone: "00000000000",
  idempotency_key: randomUUID(),
  items: [{ product_id: "prod-strawberry-1", quantity: 1 }],
});
const request = (
  path: string,
  value?: unknown,
  cookie?: string,
  client = randomUUID(),
  method = "POST",
) =>
  new NextRequest("http://localhost" + path, {
    method: value === undefined ? "GET" : method,
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": client,
      ...(cookie ? { cookie } : {}),
    },
    ...(value === undefined ? {} : { body: JSON.stringify(value) }),
  });
const cookie = () =>
  ADMIN_SESSION_COOKIE_NAME +
  "=" +
  createAdminSessionToken(undefined, getStoreSettings().admin_pin);

describe("2차 QA 기능·보안 회귀", () => {
  beforeEach(() => {
    process.env.TRUST_PROXY = "true";
    resetDemoDatabase();
  });

  it("동일 키·동일 내용은 한 번만 차감하고 다른 고객·품목·메모는 거절한다", () => {
    const input = body(),
      before = getProducts()[0].remain_stock;
    const first = createOrder(input);
    assert.equal(createOrder(input).id, first.id);
    assert.equal(getProducts()[0].remain_stock, before - 1);
    for (const changed of [
      { ...input, kakao_nickname: "다른 고객" },
      { ...input, memo: "변경" },
      {
        ...input,
        items: [{ product_id: input.items[0].product_id, quantity: 2 }],
      },
    ])
      assert.throws(() => createOrder(changed), /요청키/);
  });

  it("분할 품목의 순서와 전화 구분자에 관계없이 서버 fingerprint는 정규화한다", () => {
    const input = body();
    assert.equal(
      orderFingerprint({
        ...input,
        items: [
          { product_id: "p2", quantity: 1 },
          { product_id: "p1", quantity: 1 },
          { product_id: "p1", quantity: 2 },
        ],
      }),
      orderFingerprint({
        ...input,
        items: [
          { product_id: "p1", quantity: 3 },
          { product_id: "p2", quantity: 1 },
        ],
      }),
    );
  });

  it("브라우저 재시도·새로고침에 같은 키 유지, 미확정 요청 내용 변경은 차단한다", async () => {
    const map = new Map<string, string>();
    const storage = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
    };
    const input = body();
    const first = await getOrderAttempt(input, storage);
    assert.equal((await getOrderAttempt(input, storage)).key, first.key);
    await assert.rejects(
      () => getOrderAttempt({ ...input, kakao_nickname: "다른 시도" }, storage),
      /이전 주문/,
    );
    map.delete(ORDER_ATTEMPT_KEY);
    assert.notEqual((await getOrderAttempt(input, storage)).key, first.key);
    assert.ok(
      !storage.getItem(ORDER_ATTEMPT_KEY)!.includes(input.kakao_nickname),
    );
    assert.ok(
      !storage.getItem(ORDER_ATTEMPT_KEY)!.includes(input.customer_phone),
    );
  });

  it("닉네임 수정은 최신 재고를 유지하며 오래된 절대 재고 수정은 거절한다", () => {
    const product = { ...getProducts()[0] },
      version = product.stock_version ?? 0;
    createOrder(body());
    const changed = updateProductAdmin(product.id, { name: "QA 이름 변경" });
    assert.equal(changed.remain_stock, product.remain_stock - 1);
    assert.throws(
      () =>
        updateProductAdmin(
          product.id,
          { remain_stock: product.remain_stock },
          version,
        ),
      /재고가 변경/,
    );
    assert.equal(getProducts()[0].remain_stock, product.remain_stock - 1);
  });

  it("취소·복구도 재고 버전을 변경한다", () => {
    const order = createOrder(body()),
      product = getProducts()[0];
    const version = product.stock_version!;
    updateOrderAdmin(order.id, { status: "CANCELED" });
    assert.ok(product.stock_version! > version);
    const canceledVersion = product.stock_version!;
    updateOrderAdmin(order.id, { status: "RESERVED" });
    assert.ok(product.stock_version! > canceledVersion);
  });

  it("연락처는 9~13자리만 접수하고 last4·객체·문자·과대 길이는 거절한다", () => {
    assert.equal(validateContact("000-0000-0000"), "00000000000");
    for (const value of [
      null,
      1234,
      {},
      "x",
      "0000",
      "12345678",
      "12345678901234",
      "abc00000000000",
    ])
      assert.throws(() => validateContact(value));
    assert.equal(validLookup("QA", "0000"), true);
    assert.equal(validLookup("QA", "00000"), false);
    assert.equal(validLookup("QA", "x0000"), false);
    assert.throws(() =>
      validateOrderInput({
        ...body(),
        items: [{ product_id: "p", quantity: 0.5 }],
      }),
    );
  });

  it("공개 응답은 임의 내부 필드·원시 메모·전화·주소를 노출하지 않는다", () => {
    const order = createOrder({
      ...body(),
      memo: "QA 내부 메모",
      delivery_address: "QA 주소",
    });
    const safe = sanitizeOrdersForPublic([
      { ...order, internal_secret: "QA 내부 필드" } as typeof order,
    ])[0];
    assert.equal(safe.customer_phone, undefined);
    assert.equal(safe.delivery_address, undefined);
    assert.equal(safe.memo, "");
    assert.equal(safe.customer_phone_last4, "");
    assert.equal("internal_secret" in safe, false);
  });

  it("오늘·기간·전체와 KST 자정이 일관된다", () => {
    assert.equal(
      getKstDateString(new Date("2026-11-19T15:00:00Z")),
      "2026-11-20",
    );
    const order = createOrder(body());
    const list = [
      { ...order, order_date: "2026-11-19" },
      { ...order, order_date: "2026-11-20" },
      { ...order, order_date: "2026-11-21" },
    ];
    assert.equal(filterOrderPeriod(list, "2026-11-20", "2026-11-20").length, 1);
    assert.equal(filterOrderPeriod(list).length, 3);
    assert.throws(() =>
      readPeriod(new URLSearchParams({ from: "2026-02-30" })),
    );
    assert.throws(() =>
      readPeriod(new URLSearchParams({ from: "2026-11-21", to: "2026-11-20" })),
    );
  });

  it("문의·취소·0·음수·소수·중량·기존 공유·모호한 상품은 자동 접수하지 않는다", () => {
    const products = getProducts();
    for (const text of [
      "딸기 달아요?",
      "딸기 취소해주세요",
      "딸기 0개",
      "딸기 -2개",
      "딸기 1.5개",
      "딸기 500g",
      "주문번호: QA\n딸기 2팩",
    ])
      assert.deepEqual(parseKakaoChatMessage(text, products), []);
    assert.deepEqual(
      parseKakaoChatMessage("딸기 2팩", [
        ...products,
        { ...products[0], id: "duplicate-name" },
      ]),
      [],
    );
    assert.equal(parseKakaoChatMessage("딸기 2팩", products)[0].quantity, 2);
  });

  it("CSV의 수식 시작과 공백 뒤 수식을 문자열로 escape한다", () => {
    const order = createOrder(body());
    for (const value of ["=1+1", "+1", "-1", "@SUM(1)", "  =1+1"]) {
      const csv = ordersToCsv([{ ...order, kakao_nickname: value }]);
      assert.ok(csv.includes('"' + "'" + value + '"'));
    }
  });

  it("서명키 누락·짧은 키·다른 credential 버전은 세션을 거절한다", () => {
    const previous = process.env.ADMIN_SESSION_SECRET;
    try {
      const token = createAdminSessionToken(100, "QA-old-version");
      assert.equal(
        verifyAdminSessionToken(token, 101, "QA-new-version"),
        false,
      );
      delete process.env.ADMIN_SESSION_SECRET;
      assert.throws(() => createAdminSessionToken());
      assert.equal(
        verifyAdminSessionToken(token, 101, "QA-old-version"),
        false,
      );
      process.env.ADMIN_SESSION_SECRET = "too-short";
      assert.throws(() => createAdminSessionToken());
    } finally {
      process.env.ADMIN_SESSION_SECRET = previous;
    }
  });

  it("평문 기존 비밀번호는 성공한 로그인에서만 hash로 전환하고 응답에서 제외한다", async () => {
    const legacy = "QA-legacy-only-password";
    updateStoreSettings({ admin_pin: legacy });
    const response = await settingsPOST(
      request("/api/admin/settings", { action: "verify_pin", pin: legacy }),
    );
    assert.equal(response.status, 200);
    assert.ok(getStoreSettings().admin_pin.startsWith("scrypt$"));
    assert.ok(verifyPassword(legacy, getStoreSettings().admin_pin));
    const session = response.headers.get("set-cookie")!.split(";")[0];
    const admin = await bootstrapGET(
      request("/api/bootstrap?admin=1", undefined, session),
    );
    assert.equal(admin.status, 200);
    assert.equal("admin_pin" in (await admin.json()).settings, false);
  });

  it("비밀번호 변경 후 모든 이전 세션은 무효화되고 새 비밀번호가 유효하다", async () => {
    const session = cookie();
    const response = await settingsPATCH(
      request(
        "/api/admin/settings",
        {
          action: "change_password",
          current_password: process.env.ADMIN_INITIAL_PASSWORD,
          new_password: "QA-next-only-password",
        },
        session,
        undefined,
        "PATCH",
      ),
    );
    assert.equal(response.status, 200);
    assert.equal(
      (
        await bootstrapGET(
          request("/api/bootstrap?admin=1", undefined, session),
        )
      ).status,
      401,
    );
    assert.ok(
      verifyPassword("QA-next-only-password", getStoreSettings().admin_pin),
    );
  });

  it("연락처 last4 우회는 400, 동일 웹 요청은 한 건, 공개 메모는 비운다", async () => {
    const input = body();
    const invalid = await ordersPOST(
      request("/api/orders", {
        ...input,
        customer_phone: undefined,
        customer_phone_last4: "x",
      }),
    );
    assert.equal(invalid.status, 400);
    const first = await ordersPOST(
      request("/api/orders", { ...input, memo: "QA 내부" }),
    );
    const second = await ordersPOST(
      request("/api/orders", { ...input, memo: "QA 내부" }),
    );
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    const a = await first.json(),
      b = await second.json();
    assert.equal(a.order.id, b.order.id);
    assert.equal(a.order.memo, "");
    assert.equal(
      getOrders({ nickname: input.kakao_nickname, phone: input.customer_phone })
        .length,
      1,
    );
  });

  it("무인증 웹훅은 401, messageId 누락은 400, 재전송·기존 공유는 추가 접수하지 않는다", async () => {
    const payload = {
      sender: "QA bot",
      message: "딸기 1팩",
      messageId: randomUUID(),
    };
    assert.equal(
      (await webhookPOST(request("/api/webhook/kakao", payload))).status,
      401,
    );
    const session = cookie();
    assert.equal(
      (
        await webhookPOST(
          request(
            "/api/webhook/kakao",
            { ...payload, messageId: undefined },
            session,
          ),
        )
      ).status,
      400,
    );
    const a = await (
      await webhookPOST(request("/api/webhook/kakao", payload, session))
    ).json();
    const b = await (
      await webhookPOST(request("/api/webhook/kakao", payload, session))
    ).json();
    assert.equal(a.order.id, b.order.id);
    const shared = await webhookPOST(
      request(
        "/api/webhook/kakao",
        {
          ...payload,
          messageId: randomUUID(),
          message: "주문번호: QA\n딸기 1팩",
        },
        session,
      ),
    );
    assert.equal((await shared.json()).matched, false);
  });

  it("고객 조회와 로그인 요청 제한을 서버에서 적용한다", async () => {
    const client = randomUUID();
    for (let i = 0; i < 8; i++)
      assert.equal(
        (
          await settingsPOST(
            request(
              "/api/admin/settings",
              { action: "verify_pin", pin: "QA-wrong" },
              undefined,
              client,
            ),
          )
        ).status,
        401,
      );
    assert.equal(
      (
        await settingsPOST(
          request(
            "/api/admin/settings",
            { action: "verify_pin", pin: "QA-wrong" },
            undefined,
            client,
          ),
        )
      ).status,
      429,
    );
    const lookupClient = randomUUID();
    for (let i = 0; i < 30; i++)
      assert.equal(
        (
          await ordersGET(
            request(
              "/api/orders?nickname=QA&phone=0000",
              undefined,
              undefined,
              lookupClient,
            ),
          )
        ).status,
        200,
      );
    assert.equal(
      (
        await ordersGET(
          request(
            "/api/orders?nickname=QA&phone=0000",
            undefined,
            undefined,
            lookupClient,
          ),
        )
      ).status,
      429,
    );
  });

  it("production·preview에서 DB가 없으면 명시적 demo 옵션도 운영 접수를 허용하지 않는다", () => {
    try {
      for (const deployment of ["production", "preview"]) {
        process.env.VERCEL_ENV = deployment;
        assert.throws(() => getDataSourceMode(), /운영 DB/);
      }
    } finally {
      delete process.env.VERCEL_ENV;
    }
  });

  it("손님 공개 응답은 잔여 수량 숫자를 숨기고 관리자 응답에만 노출한다", async () => {
    const publicRes = await bootstrapGET(request("/api/bootstrap"));
    assert.equal(publicRes.status, 200);
    const publicJson = await publicRes.json();
    const publicStrawberry = publicJson.products.find(
      (p: { id: string }) => p.id === "prod-strawberry-1",
    );
    assert.ok(publicStrawberry);
    assert.equal(publicStrawberry.remain_stock, 0);
    assert.equal(publicStrawberry.total_stock, 0);
    assert.equal(publicStrawberry.is_sold_out, false);
    assert.equal("stock_version" in publicStrawberry, false);

    const session = cookie();
    const adminRes = await bootstrapGET(
      request("/api/bootstrap?admin=1", undefined, session),
    );
    assert.equal(adminRes.status, 200);
    const adminJson = await adminRes.json();
    const adminStrawberry = adminJson.products.find(
      (p: { id: string }) => p.id === "prod-strawberry-1",
    );
    assert.ok(adminStrawberry.remain_stock > 0);
    assert.ok(adminStrawberry.total_stock > 0);

    const notice = formatKakaoNoticeText(
      adminJson.settings,
      adminJson.products,
    );
    assert.equal(/\[한정 \d+개\]/.test(notice), false);

    const sanitizedSoldOut = sanitizeProductsForPublic([
      { ...adminStrawberry, is_limited: true, remain_stock: 0 },
    ])[0];
    assert.equal(sanitizedSoldOut.is_sold_out, true);
    assert.equal(sanitizedSoldOut.remain_stock, 0);

    const overStockRes = await ordersPOST(
      request("/api/orders", {
        ...body(),
        items: [{ product_id: "prod-strawberry-1", quantity: 999 }],
      }),
    );
    assert.equal(overStockRes.status, 400);
    const overStockErr = await overStockRes.json();
    assert.equal(/\(\d+개\)/.test(overStockErr.error), false);
    assert.match(overStockErr.error, /부족합니다/);
  });

  it("관리자가 등록한 상품명·산지와 노출 순서가 손님 화면 데이터에 정확히 반영된다", async () => {
    const session = cookie();
    const createdRes = await adminProductsPOST(
      request(
        "/api/admin/products",
        {
          category: "PICKUP",
          name: "설향 딸기 3x5",
          unit_label: "500g 1팩",
          price: 17900,
          origin: "충남 논산",
          is_limited: true,
          total_stock: 20,
          idempotency_key: randomUUID(),
        },
        session,
      ),
    );
    assert.equal(createdRes.status, 201);
    const createdJson = await createdRes.json();
    const newProduct = createdJson.product;
    assert.equal(newProduct.name, "설향 딸기 3x5");
    assert.equal(newProduct.origin, "충남 논산");

    const allIds = (createdJson.products as Array<{ id: string }>).map(
      (p) => p.id,
    );
    const nextOrder = [
      newProduct.id,
      ...allIds.filter((id) => id !== newProduct.id),
    ];

    const reorderRes = await adminProductsPATCH(
      request(
        "/api/admin/products",
        { reorder_ids: nextOrder },
        session,
        undefined,
        "PATCH",
      ),
    );
    assert.equal(reorderRes.status, 200);

    const publicRes = await bootstrapGET(request("/api/bootstrap"));
    assert.equal(publicRes.status, 200);
    const publicJson = await publicRes.json();
    assert.equal(publicJson.products[0].id, newProduct.id);
    assert.equal(publicJson.products[0].name, "설향 딸기 3x5");
    assert.equal(publicJson.products[0].origin, "충남 논산");
  });
});
