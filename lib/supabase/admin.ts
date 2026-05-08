import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "./env";

/**
 * service_role 키를 사용하는 어드민 전용 Supabase 클라이언트.
 * RLS를 우회하므로 반드시 서버 환경에서만 호출되어야 한다.
 *
 * import 'server-only' 가이드: 클라이언트 컴포넌트에서 잘못 import 하면
 * 빌드 타임에 즉시 에러가 발생하여 service_role 키 유출을 차단한다.
 *
 * 사용처:
 * - 사용자 초대(이메일 발송 + auth.users 생성)
 * - 시스템 작업(스케줄러, 일괄 갱신)
 * - Admin Panel 의 권한·조직 관리 일부 작업
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    SUPABASE_URL(),
    SUPABASE_SERVICE_ROLE_KEY(),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
