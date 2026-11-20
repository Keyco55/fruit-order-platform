import { NextRequest, NextResponse } from "next/server";
import {
  clearAdminSessionCookie,
  isAdminRequestAuthenticated,
  setAdminSessionCookie,
} from "@/lib/admin-auth";
import {
  getOrders,
  getProductAggregations,
  getProducts,
  getStoreSettings,
  resetDemoDatabase,
  updateStoreSettings,
} from "@/lib/repository";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import type { StoreSettings } from "@/types/domain";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      action: "verify_pin" | "logout" | "reset_demo";
      pin?: string;
    };

    if (body.action === "verify_pin") {
      const settings = await getStoreSettings();
      const isValid = body.pin === settings.admin_pin;
      if (!isValid) {
        return NextResponse.json(
          { ok: false, error: "관리자 비밀번호가 일치하지 않습니다." },
          { status: 401 }
        );
      }
      const response = NextResponse.json({ ok: true });
      setAdminSessionCookie(request, response);
      return response;
    }

    if (body.action === "logout") {
      const response = NextResponse.json({ ok: true });
      clearAdminSessionCookie(request, response);
      return response;
    }

    if (!isAdminRequestAuthenticated(request)) {
      return NextResponse.json(
        { error: "관리자 인증이 필요합니다." },
        { status: 401 }
      );
    }

    if (body.action === "reset_demo") {
      if (isSupabaseConfigured()) {
        return NextResponse.json(
          { error: "실운영 DB 모드에서는 전체 초기화를 실행할 수 없습니다." },
          { status: 403 }
        );
      }

      const db = await resetDemoDatabase();
      const [products, orders, aggregations] = await Promise.all([
        getProducts({ includeHidden: true }),
        getOrders({ includeCanceled: true }),
        getProductAggregations(),
      ]);

      return NextResponse.json({
        ok: true,
        settings: db.settings,
        products,
        orders,
        aggregations,
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
  if (!isAdminRequestAuthenticated(request)) {
    return NextResponse.json(
      { error: "관리자 인증이 필요합니다." },
      { status: 401 }
    );
  }

  try {
    const patch = (await request.json()) as Partial<StoreSettings>;
    if (patch.admin_pin !== undefined && !patch.admin_pin.trim()) {
      return NextResponse.json(
        { error: "관리자 비밀번호는 비워둘 수 없습니다." },
        { status: 400 }
      );
    }
    const updated = await updateStoreSettings(patch);
    return NextResponse.json({ settings: updated });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "설정 저장에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
