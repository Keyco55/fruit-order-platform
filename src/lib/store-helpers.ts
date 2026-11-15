import type {
  Order,
  Product,
  ProductAggregation,
} from "@/types/domain";

export function normalizePhoneDigits(value?: string): string {
  return (value ?? "").replace(/\D/g, "");
}

/**
 * 주문 품목에 상품의 현재 매장 입고 여부(is_received)를 매핑하고,
 * 닉네임 / 연락처 / 취소 포함 여부 조건으로 필터링 및 최신순 정렬합니다.
 */
export function enrichAndFilterOrders(
  rawOrders: Order[],
  products: Array<Pick<Product, "id" | "is_received">>,
  options?: {
    nickname?: string;
    phone?: string;
    phoneLast4?: string;
    includeCanceled?: boolean;
  }
): Order[] {
  const productReceivedMap = new Map<string, boolean>(
    products.map((p) => [p.id, p.is_received])
  );

  let orders = rawOrders.map((order) => ({
    ...order,
    items: order.items.map((item) => ({
      ...item,
      is_received: productReceivedMap.get(item.product_id) ?? true,
    })),
  }));

  if (options?.nickname && options.nickname.trim()) {
    const targetNick = options.nickname.trim().toLowerCase().replace(/\s+/g, "");
    orders = orders.filter((o) =>
      o.kakao_nickname.trim().toLowerCase().replace(/\s+/g, "").includes(targetNick)
    );
  }

  const queryPhoneDigits = normalizePhoneDigits(options?.phone ?? options?.phoneLast4);
  if (queryPhoneDigits) {
    orders = orders.filter((o) => {
      const storedDigits = normalizePhoneDigits(o.customer_phone);
      const last4Digits = normalizePhoneDigits(o.customer_phone_last4);
      if (storedDigits) {
        return (
          storedDigits === queryPhoneDigits ||
          storedDigits.endsWith(queryPhoneDigits)
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

  return orders.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

/**
 * 취소되지 않은 유효 주문을 기준으로 상품별 총 주문 수량/건수/금액을 집계합니다.
 */
export function buildProductAggregations(
  products: Product[],
  orders: Order[]
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
