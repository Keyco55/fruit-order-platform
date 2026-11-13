import { NextRequest, NextResponse } from "next/server";
import {
  getOrders,
  getProductAggregations,
  getProducts,
  updateOrderAdmin,
} from "@/lib/store";
import type { OrderStatus } from "@/types/domain";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      status?: OrderStatus;
      is_paid?: boolean;
      memo?: string;
      pickup_time?: string;
    };

    const order = updateOrderAdmin(id, body);
    return NextResponse.json({
      order,
      orders: getOrders({ includeCanceled: true }),
      products: getProducts({ includeHidden: true }),
      aggregations: getProductAggregations(),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "주문 상태 변경에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
