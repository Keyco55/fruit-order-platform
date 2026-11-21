import type { CreateOrderInput } from "@/types/domain";

export const ORDER_ATTEMPT_KEY = "fruit_pending_order_v1";
interface Attempt {
  key: string;
  signature: string;
}
export async function getOrderAttempt(
  input: Omit<CreateOrderInput, "idempotency_key">,
  storage: Pick<Storage, "getItem" | "setItem">,
): Promise<Attempt> {
  let previous: Attempt | null = null;
  try {
    previous = JSON.parse(storage.getItem(ORDER_ATTEMPT_KEY) || "null");
  } catch (err) {
    if (!(err instanceof SyntaxError)) throw err;
  }
  const key = previous?.key || crypto.randomUUID();
  const canonical = JSON.stringify({
    nickname: input.kakao_nickname,
    phone: input.customer_phone,
    fulfillment: input.fulfillment_type,
    pickup: input.pickup_time,
    memo: input.memo,
    items: [...input.items].sort((a, b) =>
      a.product_id.localeCompare(b.product_id),
    ),
  });
  // 미확정 요청 복구 정보에 연락처·닉네임 원문을 추가 저장하지 않는다.
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(key + ":" + canonical),
  );
  const signature = [...new Uint8Array(digest)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
  if (previous) {
    if (previous.signature === signature) return previous;
    throw new Error(
      "이전 주문의 접수 여부가 확정되지 않았습니다. 예약 내역을 먼저 확인한 뒤 미접수 주문 해제를 선택해 주세요.",
    );
  }
  const attempt = { key, signature };
  storage.setItem(ORDER_ATTEMPT_KEY, JSON.stringify(attempt));
  return attempt;
}
