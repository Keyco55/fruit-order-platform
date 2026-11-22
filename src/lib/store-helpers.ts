import type { Order, Product, ProductAggregation } from "@/types/domain";
import { filterOrderPeriod, type OrderQuery } from "@/lib/order-period";

export function normalizePhoneDigits(value?: string): string {
  return typeof value === "string" ? value.replace(/\D/g, "") : "";
}

export function getKstDateString(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * 주문 품목에 상품의 현재 매장 입고 여부(is_received)를 매핑하고,
 * 닉네임(정규화 정확 일치) / 연락처(4자리 이상) / 취소 포함 여부 조건으로 필터링 및 최신순 정렬합니다.
 */
export function enrichAndFilterOrders(
  rawOrders: Order[],
  products: Array<Pick<Product, "id" | "is_received">>,
  options?: OrderQuery,
): Order[] {
  const productReceivedMap = new Map<string, boolean>(
    products.map((p) => [p.id, p.is_received]),
  );

  let orders = rawOrders.map((order) => ({
    ...order,
    items: order.items.map((item) => ({
      ...item,
      is_received: item.product_id
        ? (productReceivedMap.get(item.product_id) ?? true)
        : true,
    })),
  }));

  if (options?.nickname !== undefined) {
    const targetNick = options.nickname
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
    if (!targetNick) {
      return [];
    }
    orders = orders.filter(
      (o) =>
        o.kakao_nickname.trim().toLowerCase().replace(/\s+/g, "") ===
        targetNick,
    );
  }

  const rawPhoneFilter = options?.phone ?? options?.phoneLast4;
  if (rawPhoneFilter !== undefined) {
    const queryPhoneDigits = normalizePhoneDigits(rawPhoneFilter);
    if (!/^(?:\d{4}|\d{9,13})$/.test(queryPhoneDigits)) {
      return [];
    }
    orders = orders.filter((o) => {
      const storedDigits = normalizePhoneDigits(o.customer_phone);
      const last4Digits = normalizePhoneDigits(o.customer_phone_last4);
      if (storedDigits) {
        return (
          storedDigits === queryPhoneDigits ||
          (queryPhoneDigits.length === 4 &&
            storedDigits.endsWith(queryPhoneDigits))
        );
      }
      if (last4Digits) {
        return (
          last4Digits === queryPhoneDigits ||
          queryPhoneDigits.endsWith(last4Digits)
        );
      }
      return false;
    });
  }

  if (options?.includeCanceled === false) {
    orders = orders.filter((o) => o.status !== "CANCELED");
  }

  return filterOrderPeriod(orders, options?.fromDate, options?.toDate).sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

/**
 * 공개 스토어프론트 응답에서 정확한 잔여/전체 재고 수량을 숨기고 품절 여부만 제공합니다.
 */
export function sanitizeProductsForPublic(products: Product[]): Product[] {
  return products.map((product) => {
    const isSoldOut =
      product.is_sold_out ?? (product.is_limited && product.remain_stock <= 0);
    return {
      ...product,
      total_stock: 0,
      remain_stock: 0,
      stock_version: undefined,
      is_sold_out: isSoldOut,
    };
  });
}

/**
 * 공개 주문 오류 메시지에서 정확한 잔여 재고 수량 숫자를 마스킹합니다.
 */
export function sanitizePublicOrderErrorMessage(message: string): string {
  return message.replace(
    /남은 수량\(\s*\d+\s*개?\)\s*이 부족합니다\.?/g,
    "주문 가능 수량이 부족합니다.",
  );
}

/**
 * 공개 고객 조회 응답에서 전체 연락처/배송지 등 불필요한 개인정보를 제거합니다.
 */
export function sanitizeOrdersForPublic(orders: Order[]): Order[] {
  return orders.map((order) => ({
    id: order.id,
    order_date: order.order_date,
    kakao_nickname: order.kakao_nickname,
    customer_phone_last4: "",
    fulfillment_type: order.fulfillment_type,
    total_amount: order.total_amount,
    status: order.status,
    is_paid: order.is_paid,
    source: order.source,
    pickup_time: order.pickup_time,
    memo: "",
    created_at: order.created_at,
    items: order.items.map((i) => ({
      id: i.id,
      order_id: i.order_id,
      product_id: i.product_id,
      product_name: i.product_name,
      unit_label: i.unit_label,
      unit_price: i.unit_price,
      quantity: i.quantity,
      subtotal: i.subtotal,
      is_received: i.is_received,
    })),
  }));
}

/**
 * 취소되지 않은 유효 주문을 기준으로 상품별 총 주문 수량/건수/금액을 집계합니다.
 */
export function buildProductAggregations(
  products: Product[],
  orders: Order[],
): ProductAggregation[] {
  const activeOrders = orders.filter((o) => o.status !== "CANCELED");

  return products
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((product) => {
      let ordered_quantity = 0;
      let order_count = 0;
      let ordered_amount = 0;
      let picked_up_quantity = 0;

      for (const order of activeOrders) {
        const matchedItems = order.items.filter(
          (i) => i.product_id === product.id,
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
