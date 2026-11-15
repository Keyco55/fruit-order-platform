import crypto from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

export const ADMIN_SESSION_COOKIE_NAME = "fruit_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12시간

interface SessionPayload {
  role: "admin";
  exp: number;
}

function getSigningSecret(): string {
  return (
    process.env.ADMIN_SESSION_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.KAKAO_WEBHOOK_SECRET?.trim() ||
    "fruit-order-platform-local-session-secret"
  );
}

function signPayload(encodedPayload: string): string {
  return crypto
    .createHmac("sha256", getSigningSecret())
    .update(encodedPayload)
    .digest("base64url");
}

export function createAdminSessionToken(
  nowSeconds = Math.floor(Date.now() / 1000)
): string {
  const payload: SessionPayload = {
    role: "admin",
    exp: nowSeconds + SESSION_TTL_SECONDS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url"
  );
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyAdminSessionToken(
  token?: string | null,
  nowSeconds = Math.floor(Date.now() / 1000)
): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [encodedPayload, signature] = parts;
  if (!encodedPayload || !signature) return false;

  const expectedSig = signPayload(encodedPayload);
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return false;

  try {
    const decoded = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf-8")
    ) as Partial<SessionPayload>;
    return (
      decoded.role === "admin" &&
      typeof decoded.exp === "number" &&
      decoded.exp > nowSeconds
    );
  } catch {
    return false;
  }
}

export function isAdminRequestAuthenticated(request: NextRequest): boolean {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  return verifyAdminSessionToken(token);
}

function isHttpsRequest(request: NextRequest): boolean {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedProto) {
    return forwardedProto.split(",")[0]?.trim() === "https";
  }
  return request.nextUrl.protocol === "https:";
}

export function setAdminSessionCookie(
  request: NextRequest,
  response: NextResponse
): void {
  const token = createAdminSessionToken();
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
    secure: isHttpsRequest(request),
  });
}

export function clearAdminSessionCookie(
  request: NextRequest,
  response: NextResponse
): void {
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    secure: isHttpsRequest(request),
  });
}
