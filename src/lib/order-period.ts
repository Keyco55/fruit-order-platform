import type { Order } from "@/types/domain";
export interface OrderQuery {
  nickname?: string;
  phone?: string;
  phoneLast4?: string;
  includeCanceled?: boolean;
  fromDate?: string;
  toDate?: string;
}

export function filterOrderPeriod(
  orders: Order[],
  from?: string,
  to?: string,
): Order[] {
  return orders.filter(
    (o) => (!from || o.order_date >= from) && (!to || o.order_date <= to),
  );
}

export function readPeriod(params: URLSearchParams): {
  fromDate?: string;
  toDate?: string;
} {
  const fromDate = params.get("from") || undefined;
  const toDate = params.get("to") || undefined;
  for (const value of [fromDate, toDate])
    if (
      value &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        Number.isNaN(Date.parse(value)) ||
        new Date(value).toISOString().slice(0, 10) !== value)
    )
      throw new Error("조회 날짜가 올바르지 않습니다.");
  if (fromDate && toDate && fromDate > toDate)
    throw new Error("시작일은 종료일보다 늦을 수 없습니다.");
  return { fromDate, toDate };
}
