/**
 * Supabase 환경변수 안전 로더.
 *
 * ⚠️ 중요 (Next.js 인라인 동작):
 *   Next.js는 클라이언트 번들 빌드 시 webpack DefinePlugin 으로
 *   `process.env.NEXT_PUBLIC_*` 의 **리터럴 접근만** 컴파일 타임에 인라인한다.
 *   `process.env[someVar]` 처럼 변수로 접근하면 인라인되지 않아
 *   브라우저에서 항상 undefined 가 된다.
 *
 *   따라서 각 환경변수는 반드시 리터럴로 직접 읽고,
 *   유효성 검증만 헬퍼 함수에 위임한다.
 */

function requireValue(name: string, value: string | undefined): string {
  if (!value) {
    if (typeof window === "undefined") {
      console.error(`[KTE CRM env] ${name} 비어있음 (server side)`);
    } else {
      console.error(`[KTE CRM env] ${name} 비어있음 (client side)`);
    }
    throw new Error(
      `[KTE CRM] 환경변수 ${name} 가 설정되지 않았습니다. .env.local 파일을 확인하세요.`,
    );
  }
  return value;
}

/* ==========================================================
 *  각 환경변수: 반드시 process.env.<리터럴> 형태로 직접 접근.
 *  변수로 접근하면 클라이언트 번들에서 인라인되지 않는다.
 * ========================================================== */

export const SUPABASE_URL = (): string =>
  requireValue(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );

export const SUPABASE_ANON_KEY = (): string =>
  requireValue(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

export const SUPABASE_SERVICE_ROLE_KEY = (): string =>
  requireValue(
    "SUPABASE_SERVICE_ROLE_KEY",
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

/**
 * 호환을 위한 일반 헬퍼 — 리터럴 접근이 가능한 곳에서만 사용해야 한다.
 * 클라이언트 번들에서 동적으로 호출하면 undefined 가 된다.
 */
export function requireEnv(name: string): string {
  return requireValue(name, process.env[name]);
}
