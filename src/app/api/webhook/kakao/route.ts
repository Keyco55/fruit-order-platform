import { NextRequest, NextResponse } from "next/server";
import {
  createOrder,
  getOrders,
  getProductAggregations,
  getProducts,
} from "@/lib/repository";
import { formatKRW, parseKakaoChatMessage } from "@/lib/formatters";

export const dynamic = "force-dynamic";

/**
 * 오픈카톡방 텍스트 메시지(메신저봇R 웹훅 또는 관리자 시뮬레이터)를 받아
 * 자동으로 품목과 수량을 파싱하고 DB에 주문을 생성합니다.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      sender: string;
      message: string;
      phoneLast4?: string;
    };

    const sender = (body.sender ?? "").trim();
    const message = (body.message ?? "").trim();

    if (!sender || !message) {
      return NextResponse.json(
        { error: "보낸 사람 닉네임과 채팅 메시지가 필요합니다." },
        { status: 400 }
      );
    }

    const products = await getProducts({ includeHidden: false });
    const parsedItems = parseKakaoChatMessage(message, products);

    if (parsedItems.length === 0) {
      return NextResponse.json(
        {
          matched: false,
          reply:
            "일반 대화로 분류되었습니다. (판매 중인 과일명이 포함되지 않음)",
        },
        { status: 200 }
      );
    }

    const order = await createOrder({
      kakao_nickname: sender,
      customer_phone_last4: body.phoneLast4 ?? "",
      source: "KAKAO_BOT",
      pickup_time: "오픈카톡 채팅 예약",
      memo: `원문: ${message.replace(/\s+/g, " ").slice(0, 60)}`,
      items: parsedItems,
    });

    const summaryText = order.items
      .map((i) => `${i.product_name} ${i.quantity}개`)
      .join(", ");

    const [orders, allProducts, aggregations] = await Promise.all([
      getOrders({ includeCanceled: true }),
      getProducts({ includeHidden: true }),
      getProductAggregations(),
    ]);

    return NextResponse.json({
      matched: true,
      order,
      reply: `🍎 [${sender}]님 주문 자동 집계 완료!\n- 내역: ${summaryText}\n- 합계: ${formatKRW(order.total_amount)}`,
      orders,
      products: allProducts,
      aggregations,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "카톡 메시지 파싱 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
