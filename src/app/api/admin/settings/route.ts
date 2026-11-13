import { NextRequest, NextResponse } from "next/server";
import {
  getOrders,
  getProductAggregations,
  getProducts,
  getStoreSettings,
  resetDemoDatabase,
  updateStoreSettings,
} from "@/lib/store";
import type { StoreSettings } from "@/types/domain";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      action: "verify_pin" | "reset_demo";
      pin?: string;
    };

    if (body.action === "verify_pin") {
      const settings = getStoreSettings();
      const isValid = body.pin === settings.admin_pin;
      if (!isValid) {
        return NextResponse.json(
          { ok: false, error: "PIN 번호가 일치하지 않습니다. (프로토타입 기본값: 1234)" },
          { status: 401 }
        );
      }
      return NextResponse.json({ ok: true });
    }

    if (body.action === "reset_demo") {
      const db = resetDemoDatabase();
      return NextResponse.json({
        ok: true,
        settings: db.settings,
        products: getProducts({ includeHidden: true }),
        orders: getOrders({ includeCanceled: true }),
        aggregations: getProductAggregations(),
      });
    }

    return NextResponse.json({ error: "알 수 없는 요청입니다." }, { status: 400 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "요청 처리에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const patch = (await request.json()) as Partial<StoreSettings>;
    const updated = updateStoreSettings(patch);
    return NextResponse.json({ settings: updated });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "설정 저장에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
