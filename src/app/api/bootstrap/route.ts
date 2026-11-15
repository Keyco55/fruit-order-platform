import { NextRequest, NextResponse } from "next/server";
import {
  getOrders,
  getProductAggregations,
  getProducts,
  getStoreSettings,
} from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const isAdmin = searchParams.get("admin") === "1";
  const nickname = searchParams.get("nickname") ?? undefined;
  const phone = searchParams.get("phone") ?? undefined;
  const phoneLast4 = searchParams.get("phoneLast4") ?? undefined;

  const settings = getStoreSettings();
  const products = getProducts({ includeHidden: isAdmin });

  if (isAdmin) {
    const orders = getOrders({ includeCanceled: true });
    const aggregations = getProductAggregations();
    return NextResponse.json({
      settings,
      products,
      orders,
      aggregations,
    });
  }

  const myOrders =
    nickname || phone || phoneLast4
      ? getOrders({ nickname, phone, phoneLast4, includeCanceled: true })
      : [];

  const { admin_pin: _pin, ...publicSettings } = settings;

  return NextResponse.json({
    settings: publicSettings,
    products,
    myOrders,
  });
}
