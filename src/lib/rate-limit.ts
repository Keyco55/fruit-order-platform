import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { getDataSourceMode } from "@/lib/repository";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const buckets = new Map<string, { count: number; until: number }>();

export async function consumeRateLimit(
  request: NextRequest,
  scope: string,
  limit: number,
  windowSeconds = 600,
): Promise<boolean> {
  // Vercel overwrites x-vercel-forwarded-for; do not trust a caller's x-forwarded-for there.
  const ip = process.env.VERCEL
    ? request.headers.get("x-vercel-forwarded-for")
    : process.env.TRUST_PROXY === "true"
      ? request.headers.get("x-forwarded-for")
      : null;
  const key = createHash("sha256")
    .update(`${scope}:${ip?.split(",")[0]?.trim() || "shared"}`)
    .digest("hex");
  if (getDataSourceMode() === "supabase") {
    const { data, error } = await getSupabaseAdminClient().rpc(
      "consume_fruit_rate_limit",
      { p_key: key, p_limit: limit, p_window: windowSeconds },
    );
    if (error)
      throw new Error(
        "요청 제한 저장소를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.",
      );
    return data === true;
  }
  const now = Date.now();
  for (const [k, v] of buckets) if (v.until <= now) buckets.delete(k);
  if (buckets.size > 10000 && !buckets.has(key)) return false;
  const bucket = buckets.get(key) ?? {
    count: 0,
    until: now + windowSeconds * 1000,
  };
  buckets.set(key, bucket);
  return ++bucket.count <= limit;
}
