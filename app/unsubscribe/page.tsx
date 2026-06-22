import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "알림 해지 | 공공입찰 수집 시스템" };
export const dynamic = "force-dynamic";

/**
 * 메일 하단 해지 링크 — /unsubscribe?token=xxx
 * token 으로 구독자 찾아 active=false 처리.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  let result: "ok" | "notfound" | "missing" = "missing";
  let email = "";

  if (token) {
    const supabase = await createClient();
    const updater = supabase as unknown as {
      from: (t: string) => {
        update: (p: Record<string, unknown>) => {
          eq: (c: string, v: string) => {
            select: (s: string) => Promise<{ data: { email: string }[] | null }>;
          };
        };
      };
    };
    const { data } = await updater
      .from("bid_subscribers")
      .update({ active: false })
      .eq("unsubscribe_token", token)
      .select("email");

    if (data && data.length > 0) {
      result = "ok";
      email = data[0].email;
    } else {
      result = "notfound";
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-lg border border-kt-light-gray/40 bg-white p-8 text-center">
        {result === "ok" ? (
          <>
            <div className="text-2xl font-bold text-kt-black mb-2">알림 해지 완료</div>
            <p className="text-sm text-kt-dark-gray">
              <span className="font-medium">{email}</span> 으로의 입찰공고 알림이
              중단되었습니다.
            </p>
            <p className="text-xs text-kt-light-gray mt-3">
              다시 받으시려면 대시보드에서 재등록하세요.
            </p>
          </>
        ) : result === "notfound" ? (
          <>
            <div className="text-2xl font-bold text-kt-black mb-2">링크 만료 또는 오류</div>
            <p className="text-sm text-kt-dark-gray">
              유효하지 않은 해지 링크입니다. 이미 해지되었거나 잘못된 링크일 수 있습니다.
            </p>
          </>
        ) : (
          <>
            <div className="text-2xl font-bold text-kt-black mb-2">잘못된 접근</div>
            <p className="text-sm text-kt-dark-gray">해지 토큰이 없습니다.</p>
          </>
        )}
        <a
          href="/bids"
          className="mt-5 inline-block rounded-md bg-kt-red px-4 py-2 text-sm font-bold text-white hover:bg-kt-red-600"
        >
          대시보드로 이동
        </a>
      </div>
    </div>
  );
}
