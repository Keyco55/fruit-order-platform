import { NextRequest, NextResponse } from "next/server";
import {
  getDataSourceMode,
  getOrders,
  getProductAggregations,
  getProducts,
  getStoreSettings,
} from "@/lib/repository";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isAdmin = searchParams.get("admin") === "1";
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

    const myOrders =
      nickname || phone || phoneLast4
        ? await getOrders({ nickname, phone, phoneLast4, includeCanceled: true })
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
