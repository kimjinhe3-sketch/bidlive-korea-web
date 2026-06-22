import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import crypto from "node:crypto";

/**
 * 메일 알림 구독 등록.
 *  - POST { email } → bid_subscribers 테이블 insert
 *  - 중복 이메일이면 active=true 로 재활성 (해지 후 재구독 시나리오)
 *  - unsubscribe_token 발급 (해지 링크용)
 */
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  let body: { email?: string; preferences?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 요청" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "이메일 형식 오류" }, { status: 400 });
  }

  // preferences — alerts[] / keywords[] / regions[] / amountMinEok
  const prefs = (body.preferences ?? {}) as {
    alerts?: string[];
    keywords?: string[];
    regions?: string[];
    amountMinEok?: number | null;
  };
  const preferences = {
    alerts: Array.isArray(prefs.alerts) && prefs.alerts.length ? prefs.alerts : ["new"],
    keywords: Array.isArray(prefs.keywords) ? prefs.keywords.slice(0, 30) : [],
    regions: Array.isArray(prefs.regions) ? prefs.regions.slice(0, 20) : [],
    amountMinEok:
      typeof prefs.amountMinEok === "number" && prefs.amountMinEok > 0
        ? prefs.amountMinEok
        : null,
  };

  // service_role 어드민 클라이언트 — RLS 우회 (anon insert 정책 불필요).
  const supabase = createAdminClient();
  const token = crypto.randomBytes(24).toString("base64url");

  // bid_subscribers 는 별도 마이그레이션 (public/_sql/bid_subscribers.sql) 으로 생성됨.
  // database.ts 의 Database 타입에 아직 미반영 — payload 캐스팅.
  const payload: Record<string, unknown> = {
    email,
    active: true,
    unsubscribe_token: token,
    preferences,
  };
  const { error } = await (supabase as unknown as {
    from: (t: string) => {
      upsert: (p: Record<string, unknown>, o?: { onConflict: string }) => Promise<{ error: { message: string } | null }>;
    };
  })
    .from("bid_subscribers")
    .upsert(payload, { onConflict: "email" });

  if (error) {
    console.error("[subscribe]", error);
    return NextResponse.json(
      { ok: false, error: "등록 실패 (DB)" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, email });
}
