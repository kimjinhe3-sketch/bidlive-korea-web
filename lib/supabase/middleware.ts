import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * 보호 라우트 prefix. 미인증 사용자가 접근하면 /login 으로 리다이렉트한다.
 * 추가 라우트가 생기면 여기에 등록.
 */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/pipeline",
  "/contracts",
  "/activities",
  "/reports",
  "/admin",
  "/notifications",
];

/**
 * 인증된 사용자가 진입하면 /dashboard 로 리다이렉트할 라우트 (로그인 페이지 등).
 */
const AUTH_REDIRECT_PREFIXES = ["/login"];

function isProtectedRoute(pathname: string) {
  return PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
}

function isAuthRoute(pathname: string) {
  return AUTH_REDIRECT_PREFIXES.some((p) => pathname.startsWith(p));
}

/**
 * Next.js 미들웨어에서 호출하는 세션 갱신 + 라우트 가드 헬퍼.
 *
 * 핵심:
 * 1. supabase.auth.getUser() 사용 — getSession은 JWT 검증을 하지 않으므로 위조 가능
 * 2. 갱신된 쿠키는 동일한 response 객체에 set — 새 NextResponse를 만들면 쿠키 유실
 * 3. 보호/인증 라우트 체크는 getUser 결과를 기반으로 수행
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    SUPABASE_URL(),
    SUPABASE_ANON_KEY(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }: CookieToSet) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }: CookieToSet) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && isProtectedRoute(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
