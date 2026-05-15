import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * 가벼운 폴링 endpoint — 마지막 수집 시각 + 전체 행 수.
 * BidCollectButton 이 5초 간격으로 polling. 완료 감지용.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();

  const [lastRow, countRes] = await Promise.all([
    supabase
      .from("bid_announcements")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("bid_announcements")
      .select("*", { count: "exact", head: true }),
  ]);

  return NextResponse.json({
    ok: true,
    lastCollectedAt: (lastRow.data as { created_at: string } | null)?.created_at ?? null,
    total: countRes.count ?? 0,
  });
}
