import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
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

interface StoreDatabase {
  settings: StoreSettings;
  products: Product[];
  orders: Order[];
}

const TMP_STORE_PATH = path.join("/tmp", "fruit-order-platform-store-v1.json");

function getTodayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function createInitialSeedData(): StoreDatabase {
  const today = getTodayDateStr();
  const nowIso = new Date().toISOString();

  const settings: StoreSettings = {
    id: "store-main",
    branch_code: "main",
    store_name: "우리동네 과일가게",
    subtitle: "매일 새벽 가락시장 경매 1등품 직송",
    notice_text:
      "🍓 오늘 주문건은 오후 2시 이후 매장 픽업 가능합니다. 주문 후 오픈카톡방에 복사된 주문서를 꼭 붙여넣어 주세요!",
    pickup_guide: "매일 10:00 ~ 20:30 (매장 앞 잠시 정차 픽업 가능)",
    bank_account: "카카오뱅크 3333-01-2345678 (예금주: 우리동네청과)",
    kakao_openchat_url: "https://open.kakao.com",
    admin_pin: "1234",
    show_price: true,
    show_stock: true,
    updated_at: nowIso,
  };

  const products: Product[] = [
    {
      id: "prod-strawberry-1",
      sale_date: today,
      category: "TODAY",
      name: "논산 설향 딸기 (특품)",
      unit_label: "500g 1팩",
      price: 12900,
      original_price: 15900,
      origin: "충남 논산",
      brix: "14.5 Brix",
      badge_text: "오늘 경매 1등품",
      description:
        "오늘 새벽 가락시장 경매에서 가장 향이 진하고 알이 굵은 설향 특품만 골라왔습니다. 무른 알 없이 끝까지 달콤합니다.",
      images: [
        "https://images.unsplash.com/photo-1464965911861-746a04b4bca6?auto=format&fit=crop&w=900&q=80",
        "https://images.unsplash.com/photo-1543528176-61b239494933?auto=format&fit=crop&w=900&q=80",
      ],
      is_limited: true,
      total_stock: 30,
      remain_stock: 9,
      is_received: true,
      is_visible: true,
      sort_order: 1,
      created_at: nowIso,
    },
    {
      id: "prod-shine-2",
      sale_date: today,
      category: "TODAY",
      name: "김천 고당도 샤인머스켓",
      unit_label: "2kg 1박스 (2~3수)",
      price: 18500,
      original_price: 24000,
      origin: "경북 김천",
      brix: "18 Brix 보장",
      badge_text: "망고향 가득",
      description:
        "껍질이 얇고 아삭한 식감에 망고향이 올라오는 수출용 등급 샤인머스켓입니다. 알 크기가 큼직해 선물용으로도 좋습니다.",
      images: [
        "https://images.unsplash.com/photo-1596363505729-4190a9506133?auto=format&fit=crop&w=900&q=80",
      ],
      is_limited: true,
      total_stock: 25,
      remain_stock: 5,
      is_received: true,
      is_visible: true,
      sort_order: 2,
      created_at: nowIso,
    },
    {
      id: "prod-tangerine-3",
      sale_date: today,
      category: "TODAY",
      name: "제주 서귀포 타이벡 꿀감귤",
      unit_label: "3kg 1박스 (로얄과)",
      price: 15000,
      original_price: 18500,
      origin: "제주 서귀포",
      brix: "13.5 Brix",
      badge_text: "새콤달콤 로얄과",
      description:
        "타이벡 농법으로 햇빛을 듬뿍 받고 자란 서귀포 노지 로얄과(S~M) 감귤입니다. 신맛은 적고 진한 단맛이 일품입니다.",
      images: [
        "https://images.unsplash.com/photo-1611080626919-7cf5a9dbab5b?auto=format&fit=crop&w=900&q=80",
      ],
      is_limited: true,
      total_stock: 40,
      remain_stock: 18,
      is_received: true,
      is_visible: true,
      sort_order: 3,
      created_at: nowIso,
    },
    {
      id: "prod-apple-4",
      sale_date: today,
      category: "TODAY",
      name: "청송 얼음골 꿀 부사 사과",
      unit_label: "5과 1봉 (특대과)",
      price: 11500,
      origin: "경북 청송",
      brix: "15 Brix",
      badge_text: "아삭한 식감",
      description:
        "일교차가 큰 청송 산지에서 수확해 과육이 단단하고 꿀이 꽉 찬 부사 사과입니다.",
      images: [
        "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=900&q=80",
      ],
      is_limited: false,
      total_stock: 999,
      remain_stock: 999,
      is_received: true,
      is_visible: true,
      sort_order: 4,
      created_at: nowIso,
    },
    {
      id: "prod-redhyang-5",
      sale_date: today,
      category: "RESERVE",
      name: "[내일입고 예약] 제주 첫수확 레드향",
      unit_label: "2.5kg 1박스",
      price: 22000,
      original_price: 27000,
      origin: "제주 애월",
      brix: "15.5 Brix",
      badge_text: "선주문 5천원 할인",
      description:
        "내일 새벽 제주 산지 직송으로 입고되는 첫수확 레드향입니다. 사전 예약 고객님께만 특가로 드립니다.",
      images: [
        "https://images.unsplash.com/photo-1582979512210-99b6a53386f9?auto=format&fit=crop&w=900&q=80",
      ],
      is_limited: true,
      total_stock: 20,
      remain_stock: 12,
      is_received: false,
      is_visible: true,
      sort_order: 5,
      created_at: nowIso,
    },
    {
      id: "prod-giftset-6",
      sale_date: today,
      category: "GIFT_SET",
      name: "[단톡방 특가] 온가족 제철 과일 3종 세트",
      unit_label: "딸기1팩 + 샤인1송이 + 감귤1.5kg",
      price: 26900,
      original_price: 33500,
      origin: "국내산 특선",
      brix: "프리미엄 선별",
      badge_text: "🔥 단톡방 1위 인기",
      description:
        "오늘 가장 맛있는 설향 딸기 1팩, 김천 샤인머스켓 1송이(700g), 타이벡 꿀감귤 1.5kg을 한 번에 맛보실 수 있는 실속 묶음 세트입니다.",
      images: [
        "https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=900&q=80",
      ],
      is_limited: true,
      total_stock: 15,
      remain_stock: 4,
      is_received: true,
      is_visible: true,
      sort_order: 6,
      created_at: nowIso,
    },
  ];

  const orders: Order[] = [
    {
      id: "ord-demo-1001",
      order_date: today,
      kakao_nickname: "과일사랑",
      customer_phone_last4: "1234",
      total_amount: 44300,
      status: "READY",
      is_paid: true,
      source: "WEB",
      pickup_time: "오늘 18:00 퇴근길",
      memo: "딸기 단단한 걸로 부탁드려요!",
      created_at: new Date(Date.now() - 1000 * 60 * 85).toISOString(),
      items: [
        {
          id: "item-101",
          order_id: "ord-demo-1001",
          product_id: "prod-strawberry-1",
          product_name: "논산 설향 딸기 (특품)",
          unit_label: "500g 1팩",
          unit_price: 12900,
          quantity: 2,
          subtotal: 25800,
        },
        {
          id: "item-102",
          order_id: "ord-demo-1001",
          product_id: "prod-shine-2",
          product_name: "김천 고당도 샤인머스켓",
          unit_label: "2kg 1박스 (2~3수)",
          unit_price: 18500,
          quantity: 1,
          subtotal: 18500,
        },
      ],
    },
    {
      id: "ord-demo-1002",
      order_date: today,
      kakao_nickname: "홍제동맘",
      customer_phone_last4: "5678",
      total_amount: 41500,
      status: "RESERVED",
      is_paid: true,
      source: "WEB",
      pickup_time: "오늘 16:30 방문",
      memo: "아이 간식용이에요 감사합니다",
      created_at: new Date(Date.now() - 1000 * 60 * 52).toISOString(),
      items: [
        {
          id: "item-103",
          order_id: "ord-demo-1002",
          product_id: "prod-tangerine-3",
          product_name: "제주 서귀포 타이벡 꿀감귤",
          unit_label: "3kg 1박스 (로얄과)",
          unit_price: 15000,
          quantity: 2,
          subtotal: 30000,
        },
        {
          id: "item-104",
          order_id: "ord-demo-1002",
          product_id: "prod-apple-4",
          product_name: "청송 얼음골 꿀 부사 사과",
          unit_label: "5과 1봉 (특대과)",
          unit_price: 11500,
          quantity: 1,
          subtotal: 11500,
        },
      ],
    },
    {
      id: "ord-demo-1003",
      order_date: today,
      kakao_nickname: "단골손님김씨",
      customer_phone_last4: "9012",
      total_amount: 39800,
      status: "PICKED_UP",
      is_paid: true,
      source: "WEB",
      pickup_time: "오늘 14:00 방문",
      memo: "",
      created_at: new Date(Date.now() - 1000 * 60 * 140).toISOString(),
      items: [
        {
          id: "item-105",
          order_id: "ord-demo-1003",
          product_id: "prod-giftset-6",
          product_name: "[단톡방 특가] 온가족 제철 과일 3종 세트",
          unit_label: "딸기1팩 + 샤인1송이 + 감귤1.5kg",
          unit_price: 26900,
          quantity: 1,
          subtotal: 26900,
        },
        {
          id: "item-106",
          order_id: "ord-demo-1003",
          product_id: "prod-strawberry-1",
          product_name: "논산 설향 딸기 (특품)",
          unit_label: "500g 1팩",
          unit_price: 12900,
          quantity: 1,
          subtotal: 12900,
        },
      ],
    },
    {
      id: "ord-demo-1004",
      order_date: today,
      kakao_nickname: "초코우유",
      customer_phone_last4: "3456",
      total_amount: 44000,
      status: "RESERVED",
      is_paid: false,
      source: "WEB",
      pickup_time: "내일 오후 픽업",
      memo: "입고되면 알림 부탁드려요",
      created_at: new Date(Date.now() - 1000 * 60 * 28).toISOString(),
      items: [
        {
          id: "item-107",
          order_id: "ord-demo-1004",
          product_id: "prod-redhyang-5",
          product_name: "[내일입고 예약] 제주 첫수확 레드향",
          unit_label: "2.5kg 1박스",
          unit_price: 22000,
          quantity: 2,
          subtotal: 44000,
        },
      ],
    },
    {
      id: "ord-demo-1005",
      order_date: today,
      kakao_nickname: "햇살가득",
      customer_phone_last4: "7788",
      total_amount: 25800,
      status: "RESERVED",
      is_paid: false,
      source: "KAKAO_BOT",
      pickup_time: "오늘 저녁 방문",
      memo: "오픈카톡 채팅 자동인식 주문",
      created_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
      items: [
        {
          id: "item-108",
          order_id: "ord-demo-1005",
          product_id: "prod-strawberry-1",
          product_name: "논산 설향 딸기 (특품)",
          unit_label: "500g 1팩",
          unit_price: 12900,
          quantity: 2,
          subtotal: 25800,
        },
      ],
    },
  ];

  return { settings, products, orders };
}

declare global {
  // eslint-disable-next-line no-var
  var __FRUIT_STORE_DB__: StoreDatabase | undefined;
}

function loadDb(): StoreDatabase {
  if (globalThis.__FRUIT_STORE_DB__) {
    return globalThis.__FRUIT_STORE_DB__;
  }

  try {
    if (fs.existsSync(TMP_STORE_PATH)) {
      const raw = fs.readFileSync(TMP_STORE_PATH, "utf-8");
      const parsed = JSON.parse(raw) as StoreDatabase;
      if (parsed && parsed.settings && Array.isArray(parsed.products)) {
        globalThis.__FRUIT_STORE_DB__ = parsed;
        return parsed;
      }
    }
  } catch {
    // Ignore file read errors and fallback to initial seed
  }

  const initial = createInitialSeedData();
  globalThis.__FRUIT_STORE_DB__ = initial;
  saveDb(initial);
  return initial;
}

function saveDb(db: StoreDatabase): void {
  globalThis.__FRUIT_STORE_DB__ = db;
  try {
    fs.writeFileSync(TMP_STORE_PATH, JSON.stringify(db, null, 2), "utf-8");
  } catch {
    // Ignore write failure on restricted environments
  }
}

export function resetDemoDatabase(): StoreDatabase {
  const fresh = createInitialSeedData();
  saveDb(fresh);
  return fresh;
}

export function getStoreSettings(): StoreSettings {
  return loadDb().settings;
}

export function updateStoreSettings(
  patch: Partial<Omit<StoreSettings, "id" | "branch_code">>
): StoreSettings {
  const db = loadDb();
  db.settings = {
    ...db.settings,
    ...patch,
    updated_at: new Date().toISOString(),
  };
  saveDb(db);
  return db.settings;
}

export function getProducts(options?: { includeHidden?: boolean }): Product[] {
  const db = loadDb();
  const list = [...db.products].sort((a, b) => a.sort_order - b.sort_order);
  if (options?.includeHidden) {
    return list;
  }
  return list.filter((p) => p.is_visible);
}

export function getOrders(options?: {
  nickname?: string;
  phoneLast4?: string;
  includeCanceled?: boolean;
}): Order[] {
  const db = loadDb();
  const productReceivedMap = new Map<string, boolean>(
    db.products.map((p) => [p.id, p.is_received])
  );

  let orders = db.orders.map((order) => ({
    ...order,
    items: order.items.map((item) => ({
      ...item,
      is_received: productReceivedMap.get(item.product_id) ?? true,
    })),
  }));

  if (options?.nickname) {
    const targetNick = options.nickname.trim().toLowerCase().replace(/\s+/g, "");
    orders = orders.filter(
      (o) =>
        o.kakao_nickname.trim().toLowerCase().replace(/\s+/g, "") === targetNick
    );
  }

  if (options?.phoneLast4 && options.phoneLast4.trim()) {
    const targetPhone = options.phoneLast4.trim();
    orders = orders.filter(
      (o) => !o.customer_phone_last4 || o.customer_phone_last4 === targetPhone
    );
  }

  if (options?.includeCanceled === false) {
    orders = orders.filter((o) => o.status !== "CANCELED");
  }

  return orders.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export function getProductAggregations(): ProductAggregation[] {
  const db = loadDb();
  const activeOrders = db.orders.filter((o) => o.status !== "CANCELED");

  return db.products
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((product) => {
      let ordered_quantity = 0;
      let order_count = 0;
      let ordered_amount = 0;
      let picked_up_quantity = 0;

      for (const order of activeOrders) {
        const matchedItems = order.items.filter(
          (i) => i.product_id === product.id
        );
        if (matchedItems.length > 0) {
          order_count += 1;
          for (const item of matchedItems) {
            ordered_quantity += item.quantity;
            ordered_amount += item.subtotal;
            if (order.status === "PICKED_UP") {
              picked_up_quantity += item.quantity;
            }
          }
        }
      }

      return {
        product_id: product.id,
        product_name: product.name,
        unit_label: product.unit_label,
        price: product.price,
        category: product.category,
        is_limited: product.is_limited,
        total_stock: product.total_stock,
        remain_stock: product.remain_stock,
        is_received: product.is_received,
        is_visible: product.is_visible,
        ordered_quantity,
        order_count,
        ordered_amount,
        picked_up_quantity,
      };
    });
}

export function createOrder(input: CreateOrderInput): Order {
  const db = loadDb();
  const nickname = input.kakao_nickname.trim();

  if (!nickname) {
    throw new Error("오픈카톡 닉네임을 입력해 주세요.");
  }

  if (!input.items || input.items.length === 0) {
    throw new Error("주문할 과일을 1개 이상 선택해 주세요.");
  }

  // 1. 재고 및 상품 유효성 사전 검증 (원자적 처리)
  const validatedItems: Array<{ product: Product; quantity: number }> = [];

  for (const reqItem of input.items) {
    if (reqItem.quantity <= 0) continue;
    const product = db.products.find((p) => p.id === reqItem.product_id);
    if (!product || !product.is_visible) {
      throw new Error("존재하지 않거나 판매 종료된 과일이 포함되어 있습니다.");
    }
    if (product.is_limited && product.remain_stock < reqItem.quantity) {
      throw new Error(
        `'${product.name}' 상품의 남은 수량(${product.remain_stock}개)이 부족합니다.`
      );
    }
    validatedItems.push({ product, quantity: reqItem.quantity });
  }

  if (validatedItems.length === 0) {
    throw new Error("유효한 주문 수량이 없습니다.");
  }

  // 2. 재고 차감 및 주문 항목 생성
  const orderId = `ord-${crypto.randomUUID().slice(0, 8)}`;
  let totalAmount = 0;

  const orderItems: OrderItem[] = validatedItems.map(({ product, quantity }) => {
    if (product.is_limited) {
      product.remain_stock = Math.max(0, product.remain_stock - quantity);
    }
    const subtotal = product.price * quantity;
    totalAmount += subtotal;

    return {
      id: `item-${crypto.randomUUID().slice(0, 8)}`,
      order_id: orderId,
      product_id: product.id,
      product_name: product.name,
      unit_label: product.unit_label,
      unit_price: product.price,
      quantity,
      subtotal,
      is_received: product.is_received,
    };
  });

  const newOrder: Order = {
    id: orderId,
    order_date: getTodayDateStr(),
    kakao_nickname: nickname,
    customer_phone_last4: (input.customer_phone_last4 ?? "").trim(),
    total_amount: totalAmount,
    status: "RESERVED",
    is_paid: false,
    source: input.source ?? "WEB",
    pickup_time: (input.pickup_time ?? "오늘 오후 방문").trim(),
    memo: (input.memo ?? "").trim(),
    created_at: new Date().toISOString(),
    items: orderItems,
  };

  db.orders.unshift(newOrder);
  saveDb(db);
  return newOrder;
}

export function updateOrderAdmin(
  orderId: string,
  patch: {
    status?: OrderStatus;
    is_paid?: boolean;
    memo?: string;
    pickup_time?: string;
  }
): Order {
  const db = loadDb();
  const order = db.orders.find((o) => o.id === orderId);
  if (!order) {
    throw new Error("주문을 찾을 수 없습니다.");
  }

  const prevStatus = order.status;
  const nextStatus = patch.status ?? prevStatus;

  // 취소로 변경 시 한정 수량 재고 복원
  if (prevStatus !== "CANCELED" && nextStatus === "CANCELED") {
    for (const item of order.items) {
      const product = db.products.find((p) => p.id === item.product_id);
      if (product && product.is_limited) {
        product.remain_stock = Math.min(
          product.total_stock,
          product.remain_stock + item.quantity
        );
      }
    }
  }

  // 취소 상태에서 다시 활성 상태로 복구 시 재고 재차감
  if (prevStatus === "CANCELED" && nextStatus !== "CANCELED") {
    for (const item of order.items) {
      const product = db.products.find((p) => p.id === item.product_id);
      if (product && product.is_limited) {
        if (product.remain_stock < item.quantity) {
          throw new Error(
            `'${product.name}' 재고가 부족하여 주문을 복구할 수 없습니다.`
          );
        }
        product.remain_stock -= item.quantity;
      }
    }
  }

  if (patch.status !== undefined) order.status = patch.status;
  if (patch.is_paid !== undefined) order.is_paid = patch.is_paid;
  if (patch.memo !== undefined) order.memo = patch.memo;
  if (patch.pickup_time !== undefined) order.pickup_time = patch.pickup_time;

  saveDb(db);
  return order;
}

export function createProductAdmin(input: CreateProductInput): Product {
  const db = loadDb();
  const maxSort = db.products.reduce(
    (max, p) => (p.sort_order > max ? p.sort_order : max),
    0
  );

  const totalStock = input.is_limited ? Math.max(0, input.total_stock) : 999;
  const remainStock = input.is_limited
    ? Math.max(0, input.remain_stock ?? totalStock)
    : 999;

  const newProduct: Product = {
    id: `prod-${crypto.randomUUID().slice(0, 8)}`,
    sale_date: input.sale_date ?? getTodayDateStr(),
    category: input.category,
    name: input.name.trim(),
    unit_label: input.unit_label.trim() || "1팩",
    price: Math.max(0, Number(input.price) || 0),
    original_price: input.original_price
      ? Math.max(0, Number(input.original_price))
      : undefined,
    origin: (input.origin ?? "국산").trim(),
    brix: input.brix?.trim() || undefined,
    badge_text: input.badge_text?.trim() || undefined,
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
    created_at: new Date().toISOString(),
  };

  db.products.unshift(newProduct);
  saveDb(db);
  return newProduct;
}

export function updateProductAdmin(
  productId: string,
  patch: Partial<Omit<Product, "id" | "created_at">>
): Product {
  const db = loadDb();
  const product = db.products.find((p) => p.id === productId);
  if (!product) {
    throw new Error("상품을 찾을 수 없습니다.");
  }

  Object.assign(product, patch);
  saveDb(db);
  return product;
}

export function deleteProductAdmin(productId: string): void {
  const db = loadDb();
  db.products = db.products.filter((p) => p.id !== productId);
  saveDb(db);
}
