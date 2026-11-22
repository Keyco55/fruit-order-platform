import type {
  Order,
  PaymentMethod,
  Product,
  StoreSettings,
} from "@/types/domain";

const CHOSUNG_LIST = [
  "ㄱ",
  "ㄲ",
  "ㄴ",
  "ㄷ",
  "ㄸ",
  "ㄹ",
  "ㅁ",
  "ㅂ",
  "ㅃ",
  "ㅅ",
  "ㅆ",
  "ㅇ",
  "ㅈ",
  "ㅉ",
  "ㅊ",
  "ㅋ",
  "ㅌ",
  "ㅍ",
  "ㅎ",
] as const;

export function formatKRW(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
}

/**
 * 한글 문자열에서 초성만 추출합니다. (예: "과일사랑" -> "ㄱㅇㅅㄹ")
 */
export function extractChosung(text: string): string {
  let result = "";
  for (const char of text) {
    const code = char.charCodeAt(0) - 0xac00;
    if (code >= 0 && code < 11172) {
      const chosungIndex = Math.floor(code / 588);
      result += CHOSUNG_LIST[chosungIndex] ?? char;
    } else {
      result += char;
    }
  }
  return result;
}

/**
 * 일반 부분 일치 검색과 한글 초성 검색(예: "ㄱㅇㅅㄹ" -> "과일사랑")을 모두 지원합니다.
 */
export function matchesKoreanSearch(target: string, query: string): boolean {
  const cleanQuery = query.trim().toLowerCase().replace(/\s+/g, "");
  if (!cleanQuery) return true;

  const cleanTarget = target.trim().toLowerCase().replace(/\s+/g, "");
  if (cleanTarget.includes(cleanQuery)) return true;

  const targetChosung = extractChosung(cleanTarget);
  return targetChosung.includes(cleanQuery);
}

export function formatPaymentMethodLabel(method?: PaymentMethod): string {
  return method === "ONSITE" ? "현장결제" : "계좌입금";
}

/**
 * 고객이 [주문 전송 및 오픈카톡방 이동] 클릭 시 클립보드에 자동 복사되는 텍스트
 */
export function formatOrderClipboardText(order: Order): string {
  const phoneSuffix = order.customer_phone_last4
    ? ` (${order.customer_phone_last4})`
    : "";
  const fulfillmentLabel =
    order.fulfillment_type === "DELIVERY" ? "🚚 배송" : "🏬 매장 픽업";
  const paymentLabel = formatPaymentMethodLabel(order.payment_method);

  const lines: string[] = [
    `[주문접수] 닉네임: ${order.kakao_nickname}${phoneSuffix} | ${fulfillmentLabel} | ${paymentLabel}`,
    ...order.items.map(
      (item) =>
        `- ${item.product_name} (${item.unit_label}) x ${item.quantity}`,
    ),
    `총 금액: ${formatKRW(order.total_amount)}`,
  ];

  if (order.fulfillment_type === "DELIVERY" && order.delivery_address?.trim()) {
    lines.push(`배송지: ${order.delivery_address.trim()}`);
  } else if (order.pickup_time && order.pickup_time.trim()) {
    lines.push(`픽업예정: ${order.pickup_time.trim()}`);
  }

  if (order.memo && order.memo.trim()) {
    lines.push(`요청사항: ${order.memo.trim()}`);
  }

  return lines.join("\n");
}

/**
 * 사장님이 오픈카톡 공지에 바로 붙여넣을 수 있는 오늘의 과일 홍보 문구 생성
 */
export function formatKakaoNoticeText(
  settings: Omit<StoreSettings, "admin_pin">,
  products: Product[],
  siteOrigin = "https://fruit-order-platform.vercel.app",
): string {
  const visibleProducts = products.filter((p) => p.is_visible);
  const pickupList = visibleProducts.filter((p) => p.category === "PICKUP");
  const deliveryList = visibleProducts.filter((p) => p.category === "DELIVERY");

  const formatLine = (p: Product) => {
    const stockTag =
      p.is_limited && (p.is_sold_out ?? p.remain_stock <= 0)
        ? " [품절]"
        : p.is_limited
          ? " [한정수량]"
          : "";
    const brixTag = p.brix ? ` (${p.brix})` : "";
    return `• ${p.name}${brixTag} ${p.unit_label} : ${formatKRW(p.price)}${stockTag}`;
  };

  const sections: string[] = [
    `🍎 [${settings.store_name}] 오늘의 신선 과일 안내 🍓`,
    settings.notice_text,
    "",
  ];

  if (pickupList.length > 0) {
    sections.push("🏬 [매장 픽업 상품]");
    sections.push(...pickupList.map(formatLine));
    sections.push("");
  }

  if (deliveryList.length > 0) {
    sections.push("🚚 [배송 가능 상품]");
    sections.push(...deliveryList.map(formatLine));
    sections.push("");
  }

  sections.push(`📍 픽업안내: ${settings.pickup_guide}`);
  sections.push(`💳 계좌안내: ${settings.bank_account}`);
  sections.push("");
  sections.push("👇 아래 링크에서 3초 만에 장바구니 담고 예약해 주세요!");
  sections.push(siteOrigin);

  return sections.join("\n");
}

/**
 * 주문 내역을 엑셀 호환 CSV 문자열(UTF-8 BOM 포함)로 변환
 */
export function ordersToCsv(orders: Order[]): string {
  const headers = [
    "주문번호",
    "주문일",
    "주문시각",
    "오픈카톡닉네임",
    "연락처",
    "수령방식",
    "배송지",
    "주문품목내역",
    "총결제금액",
    "결제방식",
    "결제확인",
    "주문상태",
    "픽업예정시간",
    "요청사항",
    "접수경로",
  ];

  const statusLabel: Record<Order["status"], string> = {
    RESERVED: "예약접수",
    READY: "입고완료(준비완료)",
    PICKED_UP: "픽업완료",
    CANCELED: "취소됨",
  };

  const escapeCsv = (val: string | number) => {
    const raw = String(val ?? "");
    const safe = /^[\s\t\r]*[=+@-]/.test(raw) ? `\'${raw}` : raw;
    const str = safe.replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = orders.map((o) => {
    const itemsSummary = o.items
      .map((i) => `${i.product_name}(${i.unit_label}) x${i.quantity}`)
      .join(" / ");
    const timeStr = new Date(o.created_at).toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    return [
      o.id.slice(0, 8),
      o.order_date,
      timeStr,
      o.kakao_nickname,
      o.customer_phone || o.customer_phone_last4 || "-",
      o.fulfillment_type === "DELIVERY" ? "배송" : "픽업",
      o.delivery_address || "-",
      itemsSummary,
      o.total_amount,
      formatPaymentMethodLabel(o.payment_method),
      o.is_paid ? "결제완료" : "미결제",
      statusLabel[o.status] ?? o.status,
      o.pickup_time || "-",
      o.memo || "-",
      o.source === "KAKAO_BOT" ? "오픈카톡봇" : "모바일웹",
    ]
      .map(escapeCsv)
      .join(",");
  });

  return "\uFEFF" + [headers.join(","), ...rows].join("\n");
}

/**
 * 오픈카톡방 텍스트 메시지(예: "설향 딸기 2\n샤인머스켓 1")를 분석하여 상품 ID와 수량을 추출합니다.
 */
export function parseKakaoChatMessage(
  message: string,
  products: Product[],
): Array<{ product_id: string; quantity: number }> {
  if (
    /[?？]|취소|문의|달아요|인가요|있나요|얼마|환불|주문번호:|\[주문접수\]/.test(
      message,
    )
  )
    return [];
  const matchedMap = new Map<string, number>();
  for (const raw of message.split(/\r?\n|,/)) {
    const line = raw.trim();
    // 중량(kg/g), 음수, 소수, 상품명에 포함된 숫자를 수량으로 추정하지 않는다.
    const qty = line.match(
      /(?:[xX*]\s*([1-9]\d*)|([1-9]\d*)\s*(?:팩|박스|세트|개|봉|송이|통|망|다발))\s*(?:예약(?:합니다|이요)?|주문(?:합니다|이요)?|주세요|부탁해요)?[.!]?$/,
    );
    if (!qty) continue;
    const prefix = line.slice(0, qty.index).trim().replace(/\s+/g, "");
    if (!prefix || /[\d.\-]$/.test(prefix)) continue;
    const quantity = Number(qty[1] ?? qty[2]);
    if (!Number.isInteger(quantity) || quantity > 999) continue;
    const candidates = products.filter(
      (p) =>
        p.is_visible &&
        (p.name.replace(/\s+/g, "").includes(prefix) ||
          prefix.includes(p.name.replace(/\s+/g, ""))),
    );
    if (candidates.length !== 1) continue;
    const id = candidates[0].id;
    const total = (matchedMap.get(id) ?? 0) + quantity;
    if (total > 999) return [];
    matchedMap.set(id, total);
  }
  return [...matchedMap].map(([product_id, quantity]) => ({
    product_id,
    quantity,
  }));
}
