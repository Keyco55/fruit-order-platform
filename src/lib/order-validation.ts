import { createHash } from "node:crypto";
import type { CreateOrderInput } from "@/types/domain";

export function validateOrderInput(input: CreateOrderInput): CreateOrderInput {
  if (!input || typeof input !== "object")
    throw new Error("올바른 주문 정보가 필요합니다.");
  if (
    typeof input.kakao_nickname !== "string" ||
    !input.kakao_nickname.trim() ||
    input.kakao_nickname.length > 60
  )
    throw new Error("닉네임은 1~60자로 입력해 주세요.");
  for (const [value, max] of [
    [input.memo, 500],
    [input.pickup_time, 120],
    [input.delivery_address, 300],
  ] as const) {
    if (
      value !== undefined &&
      (typeof value !== "string" || value.length > max)
    )
      throw new Error("주문 입력 형식 또는 길이를 확인해 주세요.");
  }
  if (
    input.idempotency_key !== undefined &&
    (typeof input.idempotency_key !== "string" ||
      !/^[a-zA-Z0-9_-]{7,160}$/.test(input.idempotency_key))
  )
    throw new Error("주문 요청키가 올바르지 않습니다.");
  if (
    !Array.isArray(input.items) ||
    !input.items.length ||
    input.items.length > 100
  )
    throw new Error("주문 품목은 1~100개로 선택해 주세요.");
  const quantities = new Map<string, number>();
  for (const item of input.items) {
    if (
      !item ||
      typeof item.product_id !== "string" ||
      !item.product_id ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 999
    )
      throw new Error("주문 수량은 1~999의 정수여야 합니다.");
    const total = (quantities.get(item.product_id) ?? 0) + item.quantity;
    if (total > 999) throw new Error("상품별 최대 주문 수량은 999개입니다.");
    quantities.set(item.product_id, total);
  }
  return {
    ...input,
    kakao_nickname: input.kakao_nickname.trim(),
    items: [...quantities]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([product_id, quantity]) => ({ product_id, quantity })),
  };
}

export function orderFingerprint(input: CreateOrderInput): string {
  const normalized = validateOrderInput(input);
  return createHash("sha256")
    .update(
      JSON.stringify({
        nickname: normalized.kakao_nickname,
        phone: (normalized.customer_phone ?? "").replace(/\D/g, ""),
        last4: normalized.customer_phone_last4 ?? "",
        fulfillment: normalized.fulfillment_type ?? "PICKUP",
        address: normalized.delivery_address?.trim() ?? "",
        pickup: normalized.pickup_time?.trim() ?? "",
        memo: normalized.memo?.trim() ?? "",
        source: normalized.source ?? "WEB",
        items: normalized.items,
      }),
    )
    .digest("hex");
}

export function validateContact(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[\d\s()+-]+$/.test(value) ||
    value.length > 30
  )
    throw new Error("연락처는 숫자 9~13자리로 입력해 주세요.");
  const digits = value.replace(/\D/g, "");
  if (!/^\d{9,13}$/.test(digits))
    throw new Error("연락처는 숫자 9~13자리로 입력해 주세요.");
  return digits;
}

export function validLookup(nickname: unknown, phone: unknown): boolean {
  return (
    typeof nickname === "string" &&
    nickname.trim().length > 0 &&
    nickname.length <= 60 &&
    typeof phone === "string" &&
    /^[\d\s()+-]+$/.test(phone) &&
    /^(?:\d{4}|\d{9,13})$/.test(phone.replace(/\D/g, ""))
  );
}
