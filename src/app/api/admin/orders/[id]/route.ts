import { NextRequest, NextResponse } from "next/server";
import { isAdminRequestAuthenticated } from "@/lib/admin-auth";
import {
  getOrders,
  getProductAggregations,
  getProducts,
  updateOrderAdmin,
} from "@/lib/repository";
import type { OrderStatus } from "@/types/domain";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    if (!(await isAdminRequestAuthenticated(request))) {
      return NextResponse.json(
        { error: "관리자 인증이 필요합니다." },
        { status: 401 },
      );
    }
    const { id } = await context.params;
    const body = (await request.json()) as {
      status?: OrderStatus;
      is_paid?: boolean;
      memo?: string;
      pickup_time?: string;
    };

    const order = await updateOrderAdmin(id, body);
    const [orders, products, aggregations] = await Promise.all([
      getOrders({ includeCanceled: true }),
      getProducts({ includeHidden: true }),
      getProductAggregations(),
    ]);

    return NextResponse.json({
      order,
      orders,
      products,
      aggregations,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "주문 상태 변경에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
