import { createClient, type SupabaseClient } from "@supabase/supabase-js";

interface CachedClient {
  url: string;
  key: string;
  client: SupabaseClient;
}

declare global {
  // eslint-disable-next-line no-var
  var __FRUIT_SUPABASE_ADMIN__: CachedClient | undefined;
}

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return Boolean(url && serviceKey);
}

/**
 * 서버 전용 Supabase Admin 클라이언트를 반환합니다 (RLS 우회, service_role 사용).
 * 브라우저 클라이언트 코드에서는 절대 import하지 마세요.
 */
export function getSupabaseAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase 환경변수(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)가 설정되지 않았습니다."
    );
  }

  const cached = globalThis.__FRUIT_SUPABASE_ADMIN__;
  if (cached && cached.url === url && cached.key === serviceKey) {
    return cached.client;
  }

  const client = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  globalThis.__FRUIT_SUPABASE_ADMIN__ = { url, key: serviceKey, client };
  return client;
}
