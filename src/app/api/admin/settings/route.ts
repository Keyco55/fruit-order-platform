import { NextRequest, NextResponse } from "next/server";
import {
  clearAdminSessionCookie,
  isAdminRequestAuthenticated,
  setAdminSessionCookie,
} from "@/lib/admin-auth";
import {
  getOrders,
  getProducts,
  getStoreSettings,
  migrateAdminCredential,
  resetDemoDatabase,
  updateStoreSettings,
} from "@/lib/repository";
import { isSupabaseConfigured } from "@/lib/supabase-admin";
import { hashPassword, verifyPassword } from "@/lib/password";
import { consumeRateLimit } from "@/lib/rate-limit";
import { buildProductAggregations } from "@/lib/store-helpers";
import type { StoreSettings } from "@/types/domain";

export const dynamic = "force-dynamic";
function safeSettings(settings: StoreSettings) {
  const { admin_pin: _credential, ...safe } = settings;
  return safe;
}
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (body.action === "verify_pin") {
      if (!(await consumeRateLimit(request, "admin-login", 8)))
        return NextResponse.json(
          { error: "로그인 시도가 많습니다. 10분 후 다시 시도해 주세요." },
          { status: 429, headers: { "Retry-After": "600" } },
        );
      let settings = await getStoreSettings();
      const stored = settings.admin_pin;
      const initial =
        stored === "!unconfigured"
          ? process.env.ADMIN_INITIAL_PASSWORD
          : undefined;
      const pin = typeof body.pin === "string" ? body.pin : "";
      if (
        !pin ||
        !(initial ? verifyPassword(pin, initial) : verifyPassword(pin, stored))
      )
        return NextResponse.json(
          { error: "관리자 비밀번호가 일치하지 않습니다." },
          { status: 401 },
        );
      // Validate the independent signing secret before mutating a legacy credential.
      setAdminSessionCookie(request, NextResponse.json({}), stored);
      if (!stored.startsWith("scrypt$"))
        settings = await migrateAdminCredential(stored, pin);
      const response = NextResponse.json({ ok: true });
      setAdminSessionCookie(request, response, settings.admin_pin);
      return response;
    }
    if (body.action === "logout") {
      const response = NextResponse.json({ ok: true });
      clearAdminSessionCookie(request, response);
      return response;
    }
    if (!(await isAdminRequestAuthenticated(request)))
      return NextResponse.json(
        { error: "관리자 인증이 필요합니다." },
        { status: 401 },
      );
    if (body.action === "reset_demo") {
      if (isSupabaseConfigured())
        return NextResponse.json(
          { error: "실운영 DB 모드에서는 전체 초기화를 실행할 수 없습니다." },
          { status: 403 },
        );
      const db = await resetDemoDatabase();
      const [products, orders] = await Promise.all([
        getProducts({ includeHidden: true }),
        getOrders({ includeCanceled: true }),
      ]);
      const response = NextResponse.json({
        ok: true,
        settings: safeSettings(db.settings),
        products,
        orders,
        aggregations: buildProductAggregations(products, orders),
      });
      clearAdminSessionCookie(request, response);
      return response;
    }
    return NextResponse.json(
      { error: "알 수 없는 요청입니다." },
      { status: 400 },
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "요청 처리에 실패했습니다.",
      },
      { status: 400 },
    );
  }
}
export async function PATCH(request: NextRequest) {
  try {
    if (!(await isAdminRequestAuthenticated(request)))
      return NextResponse.json(
        { error: "관리자 인증이 필요합니다." },
        { status: 401 },
      );
    const body = await request.json();
    if (body.action === "change_password") {
      if (!(await consumeRateLimit(request, "admin-password", 8)))
        return NextResponse.json(
          { error: "잠시 후 다시 시도해 주세요." },
          { status: 429 },
        );
      const settings = await getStoreSettings();
      if (
        typeof body.current_password !== "string" ||
        !verifyPassword(body.current_password, settings.admin_pin)
      )
        return NextResponse.json(
          { error: "현재 비밀번호가 일치하지 않습니다." },
          { status: 400 },
        );
      if (
        typeof body.new_password !== "string" ||
        body.new_password.length < 12 ||
        body.new_password.length > 128
      )
        return NextResponse.json(
          { error: "새 비밀번호는 12~128자로 입력해 주세요." },
          { status: 400 },
        );
      await migrateAdminCredential(settings.admin_pin, body.new_password);
      const response = NextResponse.json({ ok: true, requireLogin: true });
      clearAdminSessionCookie(request, response);
      return response;
    }
    const allowed = [
      "store_name",
      "subtitle",
      "notice_text",
      "pickup_guide",
      "bank_account",
      "kakao_openchat_url",
    ] as const;
    const patch: Partial<StoreSettings> = {};
    for (const key of allowed) {
      if (body[key] === undefined) continue;
      if (typeof body[key] !== "string" || body[key].length > 1000)
        throw new Error("설정 값의 형식 또는 길이가 올바르지 않습니다.");
      patch[key] = body[key].trim();
    }
    if (patch.store_name === "")
      throw new Error("상호명은 비워둘 수 없습니다.");
    if (
      patch.kakao_openchat_url &&
      new URL(patch.kakao_openchat_url).protocol !== "https:"
    )
      throw new Error("공구방 주소는 https URL로 입력해 주세요.");
    if (body.admin_pin !== undefined)
      throw new Error("비밀번호 전용 변경 폼을 사용해 주세요.");
    const updated = await updateStoreSettings(patch);
    return NextResponse.json({ settings: safeSettings(updated) });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "설정 저장에 실패했습니다.",
      },
      { status: 400 },
    );
  }
}
