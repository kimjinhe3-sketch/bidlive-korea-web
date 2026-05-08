import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

/**
 * 브라우저(Client Component)용 Supabase 클라이언트.
 * 모듈 평가 시점이 아닌 호출 시점에 인스턴스를 생성하여 SSR 환경에서도 안전.
 */
export function createClient() {
  return createBrowserClient<Database>(SUPABASE_URL(), SUPABASE_ANON_KEY());
}
