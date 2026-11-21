import { NextRequest, NextResponse } from "next/server";
import { createOrder, getOrders, getProducts } from "@/lib/repository";
import { sanitizeOrdersForPublic } from "@/lib/store-helpers";
import { sendTelegramOrderNotification } from "@/lib/telegram";
import { consumeRateLimit } from "@/lib/rate-limit";
import {
  validLookup,
  validateContact,
  validateOrderInput,
} from "@/lib/order-validation";
import type { CreateOrderInput } from "@/types/domain";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const nickname = (searchParams.get("nickname") ?? "").trim();
    const phone = searchParams.get("phone") ?? undefined;
    const phoneLast4 = searchParams.get("phoneLast4") ?? undefined;

    if (!validLookup(nickname, phone ?? phoneLast4)) {
      return NextResponse.json(
        {
          error: "오픈카톡 닉네임과 연락처 뒷 4자리 이상을 입력해 주세요.",
        },
        { status: 400 },
      );
    }

    if (!(await consumeRateLimit(request, "customer-lookup", 30)))
      return NextResponse.json(
        { error: "조회가 많습니다. 10분 후 다시 시도해 주세요." },
        { status: 429 },
      );
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
    if (!(await consumeRateLimit(request, "web-order", 30)))
      return NextResponse.json(
        { error: "접수 요청이 많습니다. 잠시 후 다시 시도해 주세요." },
        { status: 429 },
      );
    const raw = await request.json();
    const phone = validateContact(raw.customer_phone);
    const body = validateOrderInput({
      ...raw,
      customer_phone: phone,
      customer_phone_last4: phone.slice(-4),
    } as CreateOrderInput);
    if (!body.idempotency_key)
      throw new Error("주문 요청키가 필요합니다. 화면을 새로고침해 주세요.");
    const order = await createOrder({
      ...body,
      fulfillment_type: "PICKUP",
      delivery_address: "",
      source: "WEB",
    });

    void sendTelegramOrderNotification(order);

    const [productResult, orderResult] = await Promise.allSettled([
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
        products:
          productResult.status === "fulfilled"
            ? productResult.value
            : undefined,
        myOrders:
          orderResult.status === "fulfilled"
            ? sanitizeOrdersForPublic(orderResult.value)
            : [sanitizeOrdersForPublic([order])[0]],
        refreshRequired:
          productResult.status === "rejected" ||
          orderResult.status === "rejected",
      },
      { status: 201 },
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "주문 처리 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
