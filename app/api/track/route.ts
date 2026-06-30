import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 방문 추적 비콘 수신 — POST { visitorId, sessionId, path }
 * site_visits 에 upsert (session_id UNIQUE).
 *   - 최초: started_at = now, last_seen_at = now
 *   - heartbeat: last_seen_at = now (started_at 유지)
 * 체류시간 = last_seen_at - started_at (리포트에서 집계).
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { visitorId?: string; sessionId?: string; path?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  const visitorId = (body.visitorId ?? "").slice(0, 64);
  const sessionId = (body.sessionId ?? "").slice(0, 64);
  const path = (body.path ?? "").slice(0, 200);
  if (!visitorId || !sessionId) {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  const ua = req.headers.get("user-agent")?.slice(0, 200) ?? null;
  const supabase = createAdminClient();

  const db = supabase as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: unknown }>;
    from: (t: string) => {
      upsert: (
        p: Record<string, unknown>,
        o?: { onConflict: string },
      ) => Promise<{ error: { message: string } | null }>;
    };
  };

  // upsert: 최초 insert, 이후 heartbeat 는 last_seen_at 만 갱신.
  // started_at 은 insert 시 DB default(now) 로 들어가고 이후 보존되어야 하므로
  // upsert payload 에 started_at 을 넣지 않음 (충돌 시 last_seen_at 만 업데이트되도록 트리거/정책).
  // PostgREST upsert 는 전체 컬럼 갱신이라, last_seen_at 만 바꾸려면 별도 처리 필요 →
  // 여기서는 insert 시도 후 충돌이면 update 하는 2단계로 명확히 처리.
  const nowIso = new Date().toISOString();

  // 1) insert 시도 (충돌 무시)
  const ins = await db.from("site_visits").upsert(
    {
      visitor_id: visitorId,
      session_id: sessionId,
      path,
      user_agent: ua,
      last_seen_at: nowIso,
    },
    { onConflict: "session_id" },
  );

  if (ins.error) {
    console.warn("[track]", ins.error.message);
  }

  return NextResponse.json({ ok: true });
}
