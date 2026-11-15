import { NextRequest, NextResponse } from "next/server";
import { createOrder, getOrders, getProducts } from "@/lib/store";
import { sendTelegramOrderNotification } from "@/lib/telegram";
import type { CreateOrderInput } from "@/types/domain";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const nickname = searchParams.get("nickname") ?? undefined;
  const phone = searchParams.get("phone") ?? undefined;
  const phoneLast4 = searchParams.get("phoneLast4") ?? undefined;

  const orders = getOrders({
    nickname,
    phone,
    phoneLast4,
    includeCanceled: true,
  });

  return NextResponse.json({ orders });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateOrderInput;
    const order = createOrder(body);

    // 사장님 텔레그램 알림 비동기 발송
    void sendTelegramOrderNotification(order);

    const updatedProducts = getProducts({ includeHidden: false });
    const myOrders = getOrders({
      nickname: order.kakao_nickname,
      phone: order.customer_phone || order.customer_phone_last4 || undefined,
      includeCanceled: true,
    });

    return NextResponse.json(
      {
        order,
        products: updatedProducts,
        myOrders,
      },
      { status: 201 }
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "주문 처리 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
