import type { Order } from "@/types/domain";
import { formatKRW, formatPaymentMethodLabel } from "@/lib/formatters";

/**
 * 신규 주문 발생 시 사장님 텔레그램으로 실시간 푸시 알림을 발송합니다.
 * 환경변수(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)가 설정된 경우에만 동작합니다.
 */
export async function sendTelegramOrderNotification(order: Order): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return false;
  }

  const itemLines = order.items
    .map((item) => `• ${item.product_name} (${item.unit_label}) x ${item.quantity}개`)
    .join("\n");

  const text = [
    `🔔 [신규 과일 주문 접수]`,
    `👤 닉네임: ${order.kakao_nickname}${order.customer_phone_last4 ? ` (${order.customer_phone_last4})` : ""}`,
    `📦 주문내역:\n${itemLines}`,
    `💰 합계금액: ${formatKRW(order.total_amount)}`,
    `💳 결제방식: ${formatPaymentMethodLabel(order.payment_method)}`,
    `⏰ 픽업예정: ${order.pickup_time || "미정"}`,
    order.memo ? `📝 요청사항: ${order.memo}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
