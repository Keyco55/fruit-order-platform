import { NextRequest, NextResponse } from "next/server";
import { createOrder, getOrders, getProducts } from "@/lib/repository";
import {
  normalizePhoneDigits,
  sanitizeOrdersForPublic,
} from "@/lib/store-helpers";
import { sendTelegramOrderNotification } from "@/lib/telegram";
import type { CreateOrderInput } from "@/types/domain";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const nickname = (searchParams.get("nickname") ?? "").trim();
    const phone = searchParams.get("phone") ?? undefined;
    const phoneLast4 = searchParams.get("phoneLast4") ?? undefined;
    const phoneDigits = normalizePhoneDigits(phone ?? phoneLast4);

    if (!nickname || phoneDigits.length < 4) {
      return NextResponse.json(
        {
          error: "오픈카톡 닉네임과 연락처 뒷 4자리 이상을 입력해 주세요.",
        },
        { status: 400 }
      );
    }

    const orders = await getOrders({
      nickname,
      phone,
      phoneLast4,
      includeCanceled: true,
    });

    return NextResponse.json({ orders: sanitizeOrdersForPublic(orders) });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "주문 조회 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateOrderInput;
    const phoneDigits = normalizePhoneDigits(
      body.customer_phone ?? body.customer_phone_last4
    );
    if (phoneDigits.length < 9 && !body.customer_phone_last4) {
      return NextResponse.json(
        { error: "연락처를 정확히 입력해 주세요." },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { error: "주문할 과일을 1개 이상 선택해 주세요." },
        { status: 400 }
      );
    }

    for (const item of body.items) {
      if (
        !Number.isInteger(item.quantity) ||
        item.quantity <= 0 ||
        item.quantity > 999
      ) {
        return NextResponse.json(
          { error: "주문 수량은 1 이상의 정수로 입력해 주세요." },
          { status: 400 }
        );
      }
    }

    const order = await createOrder({
      ...body,
      fulfillment_type: "PICKUP",
      delivery_address: "",
      source: "WEB",
    });

    void sendTelegramOrderNotification(order);

    const [updatedProducts, myOrders] = await Promise.all([
      getProducts({ includeHidden: false }),
      getOrders({
        nickname: order.kakao_nickname,
        phone: order.customer_phone || order.customer_phone_last4 || undefined,
        includeCanceled: true,
      }),
    ]);

    return NextResponse.json(
      {
        order: sanitizeOrdersForPublic([order])[0],
        products: updatedProducts,
        myOrders: sanitizeOrdersForPublic(myOrders),
      },
      { status: 201 }
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "주문 처리 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
