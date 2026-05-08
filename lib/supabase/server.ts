import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * RSC(Server Component) / Route Handler / Server Action 용 Supabase 클라이언트.
 * Next.js 15부터 cookies()는 async — 반드시 await으로 사용한다.
 *
 * RSC에서는 setAll 호출 시 쿠키 쓰기가 불가능하므로 try/catch로 감싼다.
 * (미들웨어가 세션 갱신을 책임지므로 RSC의 set 실패는 정상 흐름)
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(SUPABASE_URL(), SUPABASE_ANON_KEY(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }: CookieToSet) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // RSC는 쿠키를 쓸 수 없다 — 미들웨어가 갱신을 처리하므로 무시
        }
      },
    },
  });
}
