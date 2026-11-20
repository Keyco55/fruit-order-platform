import { NextRequest, NextResponse } from "next/server";
import { isAdminRequestAuthenticated } from "@/lib/admin-auth";
import {
  getDataSourceMode,
  getOrders,
  getProductAggregations,
  getProducts,
  getStoreSettings,
} from "@/lib/repository";
import {
  normalizePhoneDigits,
  sanitizeOrdersForPublic,
} from "@/lib/store-helpers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isAdmin = searchParams.get("admin") === "1";

    if (isAdmin && !isAdminRequestAuthenticated(request)) {
      return NextResponse.json(
        { error: "관리자 인증이 필요합니다." },
        { status: 401 }
      );
    }

    const nickname = searchParams.get("nickname") ?? undefined;
    const phone = searchParams.get("phone") ?? undefined;
    const phoneLast4 = searchParams.get("phoneLast4") ?? undefined;

    const [settings, products] = await Promise.all([
      getStoreSettings(),
      getProducts({ includeHidden: isAdmin }),
    ]);

    if (isAdmin) {
      const [orders, aggregations] = await Promise.all([
        getOrders({ includeCanceled: true }),
        getProductAggregations(),
      ]);
      return NextResponse.json({
        mode: getDataSourceMode(),
        settings,
        products,
        orders,
        aggregations,
      });
    }

    const hasValidLookupQuery =
      Boolean(nickname?.trim()) &&
      normalizePhoneDigits(phone ?? phoneLast4).length >= 4;

    const myOrders = hasValidLookupQuery
      ? sanitizeOrdersForPublic(
          await getOrders({ nickname, phone, phoneLast4, includeCanceled: true })
        )
      : [];

    const { admin_pin: _pin, ...publicSettings } = settings;

    return NextResponse.json({
      mode: getDataSourceMode(),
      settings: publicSettings,
      products,
      myOrders,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "초기 데이터를 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
