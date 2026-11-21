import crypto from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { getStoreSettings } from "@/lib/repository";

export const ADMIN_SESSION_COOKIE_NAME = "fruit_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;
interface SessionPayload {
  role: "admin";
  exp: number;
  version: string;
}

function getSigningSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET?.trim();
  if (!secret || Buffer.byteLength(secret) < 32)
    throw new Error("ADMIN_SESSION_SECRET을 32바이트 이상으로 설정해 주세요.");
  return secret;
}
function signPayload(value: string): string {
  return crypto
    .createHmac("sha256", getSigningSecret())
    .update(value)
    .digest("base64url");
}
export function credentialVersion(credential: string): string {
  return crypto.createHash("sha256").update(credential).digest("hex");
}
export function createAdminSessionToken(
  nowSeconds = Math.floor(Date.now() / 1000),
  credential = "",
): string {
  const payload: SessionPayload = {
    role: "admin",
    exp: nowSeconds + SESSION_TTL_SECONDS,
    version: credentialVersion(credential),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signPayload(encoded)}`;
}
export function verifyAdminSessionToken(
  token?: string | null,
  nowSeconds = Math.floor(Date.now() / 1000),
  credential = "",
): boolean {
  if (!token || token.length > 2048) return false;
  try {
    const [encoded, sig, extra] = token.split(".");
    if (!encoded || !sig || extra !== undefined) return false;
    const actual = Buffer.from(sig);
    const expected = Buffer.from(signPayload(encoded));
    if (
      actual.length !== expected.length ||
      !crypto.timingSafeEqual(actual, expected)
    )
      return false;
    const p = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as SessionPayload;
    return (
      p.role === "admin" &&
      Number.isFinite(p.exp) &&
      p.exp > nowSeconds &&
      p.version === credentialVersion(credential)
    );
  } catch {
    return false;
  }
}
export async function isAdminRequestAuthenticated(
  request: NextRequest,
): Promise<boolean> {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  if (!verifyAdminSessionTokenSignature(token)) return false;
  const settings = await getStoreSettings();
  return verifyAdminSessionToken(token, undefined, settings.admin_pin);
}
// Reject malformed/unsigned cookies before any DB access. Full credential-version validation follows.
function verifyAdminSessionTokenSignature(token?: string): boolean {
  if (!token || token.length > 2048) return false;
  try {
    const [encoded, sig, extra] = token.split(".");
    if (!encoded || !sig || extra !== undefined) return false;
    const expected = Buffer.from(signPayload(encoded)),
      actual = Buffer.from(sig);
    return (
      actual.length === expected.length &&
      crypto.timingSafeEqual(actual, expected)
    );
  } catch {
    return false;
  }
}
function isHttps(request: NextRequest): boolean {
  return (
    request.nextUrl.protocol === "https:" ||
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https"
  );
}
export function setAdminSessionCookie(
  request: NextRequest,
  response: NextResponse,
  credential: string,
): void {
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE_NAME,
    value: createAdminSessionToken(undefined, credential),
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
    secure: isHttps(request),
  });
}
export function clearAdminSessionCookie(
  request: NextRequest,
  response: NextResponse,
): void {
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    secure: isHttps(request),
  });
}
