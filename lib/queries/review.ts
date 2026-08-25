import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * AI 추천 리뷰보드 데이터 — bid_rec_scores (추천 vs 실제 개찰 결과 채점) 집계.
 * 채점은 bid-collector 의 score_recommendations 배치가 매일 저녁 수행.
 */

export interface RecScore {
  bid_no: string;
  title: string | null;
  org_name: string | null;
  grp: string | null;
  rec_bid_rate: number;
  est_lower_rate: number | null;
  confidence: string | null;
  actual_win_rate: number;
  actual_lower: number | null;
  eff_rate: number | null;
  outcome: "win" | "under" | "beaten";
  outcome_v2: string | null;
  diff: number;
  lower_hit: boolean | null;
  open_result_date: string | null;
}

export interface ScoreSummary {
  n: number;
  winPct: number;
  underPct: number;
  beatenPct: number;
  hit03Pct: number;
  lowerHitPct: number;
  /** ③ 섀도우 모델(기관 사정율 편향) 낙찰권 % — v2 채점이 있는 표본 기준 */
  v2N: number;
  v2WinPct: number | null;
  /** 낙찰권 건에서 실제 낙찰률 - 유효율 중앙값(%p) — 이겼지만 더 받을 수 있었던 폭 */
  marginLeftMed: number | null;
}

export interface DailyScore extends ScoreSummary {
  date: string;
}

export interface ReviewData {
  scope: "ours" | "all";
  /** 필터 전 전체 채점 수 (scope 무관) */
  totalAll: number;
  today: ScoreSummary | null;
  d7: ScoreSummary | null;
  d30: ScoreSummary | null;
  daily: DailyScore[];       // 최근 30일 일별
  weekly: DailyScore[];      // 최근 12주 주별 (date = 주 시작일)
  monthly: DailyScore[];     // 월별 (date = YYYY-MM)
  recent: RecScore[];        // 최근 채점 상세
  totalScored: number;
}

function summarize(rows: RecScore[]): ScoreSummary | null {
  if (rows.length === 0) return null;
  const n = rows.length;
  const pct = (c: number) => Math.round((c / n) * 1000) / 10;
  return {
    n,
    winPct: pct(rows.filter((r) => r.outcome === "win").length),
    underPct: pct(rows.filter((r) => r.outcome === "under").length),
    beatenPct: pct(rows.filter((r) => r.outcome === "beaten").length),
    hit03Pct: pct(rows.filter((r) => Math.abs(Number(r.diff)) <= 0.3).length),
    lowerHitPct: pct(rows.filter((r) => r.lower_hit).length),
    v2N: rows.filter((r) => r.outcome_v2).length,
    v2WinPct: (() => {
      const v2 = rows.filter((r) => r.outcome_v2);
      if (v2.length === 0) return null;
      return Math.round((v2.filter((r) => r.outcome_v2 === "win").length / v2.length) * 1000) / 10;
    })(),
    marginLeftMed: (() => {
      const ms = rows
        .filter((r) => r.outcome === "win" && r.eff_rate != null)
        .map((r) => Number(r.actual_win_rate) - Number(r.eff_rate))
        .sort((a, b) => a - b);
      if (ms.length === 0) return null;
      const mid = Math.floor(ms.length / 2);
      const med = ms.length % 2 ? ms[mid] : (ms[mid - 1] + ms[mid]) / 2;
      return Math.round(med * 1000) / 1000;
    })(),
  };
}

function kstToday(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

/** ISO 주 시작일(월요일) */
function weekStart(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const dow = (d.getUTCDay() + 6) % 7; // 월=0
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

export async function getReviewData(scope: "ours" | "all" = "ours"): Promise<ReviewData> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bid_rec_scores")
    .select(
      "bid_no,title,org_name,grp,rec_bid_rate,est_lower_rate,confidence,actual_win_rate,actual_lower,eff_rate,outcome,outcome_v2,diff,lower_hit,open_result_date",
    )
    .order("open_result_date", { ascending: false })
    .limit(20000);

  const allRows = ((error ? [] : data) as RecScore[] | null) ?? [];
  // 기본: 우리 회사 관심그룹(다이제스트 키워드) 매칭 건만 — '-' = 비매칭
  const rows = scope === "ours"
    ? allRows.filter((r) => r.grp && r.grp !== "-")
    : allRows;
  const today = kstToday();
  const since = (days: number) =>
    new Date(Date.now() + 9 * 3600 * 1000 - days * 86400000).toISOString().slice(0, 10);

  const byDate = (from: string) =>
    rows.filter((r) => (r.open_result_date ?? "") >= from);

  // 일별 (최근 30일)
  const dailyMap = new Map<string, RecScore[]>();
  for (const r of byDate(since(30))) {
    const d = (r.open_result_date ?? "").slice(0, 10);
    if (!d) continue;
    if (!dailyMap.has(d)) dailyMap.set(d, []);
    dailyMap.get(d)!.push(r);
  }
  const daily = [...dailyMap.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, rs]) => ({ date, ...(summarize(rs) as ScoreSummary) }));

  // 주별 (최근 12주)
  const weekMap = new Map<string, RecScore[]>();
  for (const r of byDate(since(84))) {
    const d = (r.open_result_date ?? "").slice(0, 10);
    if (!d) continue;
    const w = weekStart(d);
    if (!weekMap.has(w)) weekMap.set(w, []);
    weekMap.get(w)!.push(r);
  }
  const weekly = [...weekMap.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, rs]) => ({ date, ...(summarize(rs) as ScoreSummary) }));

  // 월별 (전체)
  const monthMap = new Map<string, RecScore[]>();
  for (const r of rows) {
    const m = (r.open_result_date ?? "").slice(0, 7);
    if (!m) continue;
    if (!monthMap.has(m)) monthMap.set(m, []);
    monthMap.get(m)!.push(r);
  }
  const monthly = [...monthMap.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, rs]) => ({ date, ...(summarize(rs) as ScoreSummary) }));

  return {
    scope,
    totalAll: allRows.length,
    today: summarize(rows.filter((r) => (r.open_result_date ?? "").startsWith(today))),
    d7: summarize(byDate(since(7))),
    d30: summarize(byDate(since(30))),
    daily,
    weekly,
    monthly,
    recent: rows.slice(0, 30),
    totalScored: rows.length,
  };
}
