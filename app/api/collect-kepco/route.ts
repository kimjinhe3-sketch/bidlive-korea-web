import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * KEPCO 수집 프록시 — 진단 모드 (POST 최소화).
 * 502 원인 확정 후 정식 로직 복원.
 */

/** GET — 환경변수 + admin client 진단 */
export async function GET() {
  const env = {
    KEPCO_API_KEY:             !!process.env.KEPCO_API_KEY,
    COLLECT_SECRET:            !!process.env.COLLECT_SECRET,
    NEXT_PUBLIC_SUPABASE_URL:  !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  let admin: Record<string, unknown> = { tested: false };
  try {
    const supabase = createAdminClient();
    const start = Date.now();
    const { count, error } = await supabase
      .from("bid_announcements")
      .select("*", { count: "exact", head: true });
    admin = {
      tested: true,
      query_ms: Date.now() - start,
      total_count: count ?? null,
      error: error ? error.message : null,
    };
  } catch (e) {
    admin = {
      tested: true,
      exception: e instanceof Error ? e.message : String(e),
    };
  }

  return NextResponse.json({
    version: "minimal-v2",
    env,
    admin,
    node: process.version,
  });
}

/** POST — 진단 단계: 미니멀 응답만. 502 원인 좁히기. */
export async function POST(req: Request) {
  return NextResponse.json({
    ok: true,
    diag: "minimal-post-v2",
    reached_at: new Date().toISOString(),
    has_secret_header: !!req.headers.get("x-collect-secret"),
    has_lookback: !!req.headers.get("x-lookback-days"),
  });
}
