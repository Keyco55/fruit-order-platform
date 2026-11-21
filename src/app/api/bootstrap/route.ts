import { NextRequest, NextResponse } from "next/server";
import { consumeRateLimit } from "@/lib/rate-limit";
import { validLookup } from "@/lib/order-validation";
import { readPeriod } from "@/lib/order-period";
import { buildProductAggregations } from "@/lib/store-helpers";
import { isAdminRequestAuthenticated } from "@/lib/admin-auth";
import {
  getDataSourceMode,
  getOrders,
  getProducts,
  getStoreSettings,
} from "@/lib/repository";
import { sanitizeOrdersForPublic } from "@/lib/store-helpers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isAdmin = searchParams.get("admin") === "1";

    if (isAdmin && !(await isAdminRequestAuthenticated(request))) {
      return NextResponse.json(
        { error: "관리자 인증이 필요합니다." },
        { status: 401 },
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
      const [orders] = await Promise.all([
        getOrders({ includeCanceled: true, ...readPeriod(searchParams) }),
      ]);
      return NextResponse.json({
        mode: getDataSourceMode(),
        settings: (({ admin_pin: _credential, ...safe }) => safe)(settings),
        products,
        orders,
        aggregations: buildProductAggregations(products, orders),
      });
    }

    const hasValidLookupQuery = validLookup(nickname, phone ?? phoneLast4);

    if (
      hasValidLookupQuery &&
      !(await consumeRateLimit(request, "customer-lookup", 30))
    )
      return NextResponse.json(
        { error: "조회가 많습니다. 10분 후 다시 시도해 주세요." },
        { status: 429 },
      );
    const myOrders = hasValidLookupQuery
      ? sanitizeOrdersForPublic(
          await getOrders({
            nickname,
            phone,
            phoneLast4,
            includeCanceled: true,
          }),
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
