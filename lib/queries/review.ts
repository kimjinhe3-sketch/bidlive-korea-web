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

/**
 * 판정 = 오차(추천 − 실제 낙찰률, %p) 크기의 구간 등급 (2026-08-25 확정).
 * 적중(0) → 적중권 → 근접 → 보통 → 이탈권 → 이탈 → 부정확(±1%p 이상).
 * "적중"은 오차 0(완전 일치)에만 부여. 실제 낙찰가보다 크게 낮은 추천은
 * 낙찰되더라도 저가 수주(원가 리스크)라 성공이 아니다 — 방향(저가/고가
 * 제안)은 요약 카드에 별도 표기.
 * 낙찰방식별 적중권: 최적가(적격심사) ±0.0005%p / 최저가는 낙찰가 직하
 * 0.0001~0.0010%p (현재 추천 대상은 적격심사뿐이라 적격 규칙만 실사용).
 */
export const TIERS = [
  { key: "exact", label: "적중", max: 0 },
  { key: "near", label: "적중권", max: 0.0005 },
  { key: "n005", label: "근접", max: 0.005 },
  { key: "n01", label: "보통", max: 0.01 },
  { key: "n1", label: "이탈권", max: 0.1 },
  { key: "n10", label: "이탈", max: 1.0 },
] as const;

export type TierKey = (typeof TIERS)[number]["key"] | "far";

export function tierOf(diff: number, method: "적격" | "최저가" = "적격"): TierKey {
  if (method === "최저가") {
    // 최저가 낙찰제: 낙찰가 바로 아래(0.0001~0.0010%p 낮게)가 적중권
    if (diff === 0) return "exact";
    if (diff <= -0.0001 && diff >= -0.001) return "near";
  } else if (Math.abs(diff) <= 0.0005) {
    return diff === 0 ? "exact" : "near";
  }
  const a = Math.abs(diff);
  for (const t of TIERS) {
    if (t.max > 0 && a <= t.max) return t.key;
  }
  return "far"; // 부정확 — ±1%p 이상 차이
}

export interface ScoreSummary {
  n: number;
  /** 등급별 비율(%) — TIERS 순서 + low(저가)/high(고가) */
  tierPcts: Record<TierKey, number>;
  /** |오차| ≤ 0.01%p 누적 비율 */
  cum01: number;
  /** |오차| ≤ 0.1%p 누적 비율 */
  cum1: number;
  /** 오차 < -0.5%p — 저가 제안 (낙찰돼도 저가 수주 위험) */
  lowPct: number;
  /** 오차 > +0.5%p — 고가 제안 (순위 밀림) */
  highPct: number;
  /** 하한 미달(무효) 비율 — 사정율 추첨 영향, 참고용 */
  underPct: number;
  /** 오차 중앙값(%p) — 치우침 방향 (음수=낮게, 양수=높게 제안하는 경향) */
  medDiff: number;
}

export interface DailyScore extends ScoreSummary {
  date: string;
}

export interface ReviewData {
  scope: "ours" | "all";
  /** 상세 테이블 개찰일 필터 — "all" 또는 "YYYY-MM-DD" */
  dateFilter: string;
  /** 개찰일 칩 목록 (전체 이력, 최신순) */
  dates: { date: string; n: number }[];
  /** 필터 전 전체 채점 수 (scope 무관) */
  totalAll: number;
  today: ScoreSummary | null;
  d7: ScoreSummary | null;
  d30: ScoreSummary | null;
  daily: DailyScore[];       // 최근 30일 일별
  weekly: DailyScore[];      // 최근 12주 주별 (date = 주 시작일)
  monthly: DailyScore[];     // 월별 (date = YYYY-MM)
  recent: RecScore[];        // 채점 상세 (dateFilter 적용, DETAIL_CAP 상한)
  /** dateFilter 적용 후 총 건수 (CAP 이전) */
  recentTotal: number;
  totalScored: number;
}

function summarize(rows: RecScore[]): ScoreSummary | null {
  if (rows.length === 0) return null;
  const n = rows.length;
  const pct = (c: number) => Math.round((c / n) * 1000) / 10;
  const diffs = rows.map((r) => Number(r.diff)).sort((a, b) => a - b);
  const mid = Math.floor(n / 2);
  const med = n % 2 ? diffs[mid] : (diffs[mid - 1] + diffs[mid]) / 2;
  const counts = {} as Record<TierKey, number>;
  for (const r of rows) {
    const k = tierOf(Number(r.diff));
    counts[k] = (counts[k] ?? 0) + 1;
  }
  const tierPcts = {} as Record<TierKey, number>;
  for (const k of [...TIERS.map((t) => t.key), "far"] as TierKey[]) {
    tierPcts[k] = pct(counts[k] ?? 0);
  }
  const cumOf = (max: number) => pct(diffs.filter((d) => Math.abs(d) <= max).length);
  return {
    n,
    tierPcts,
    cum01: cumOf(0.01),
    cum1: cumOf(0.1),
    lowPct: pct(diffs.filter((d) => d < -0.5).length),
    highPct: pct(diffs.filter((d) => d > 0.5).length),
    underPct: pct(rows.filter((r) => r.outcome === "under").length),
    medDiff: Math.round(med * 100) / 100,
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

/** 상세 테이블 '전체' 선택 시 렌더 상한 (페이지 무게 보호) */
export const DETAIL_CAP = 300;

export async function getReviewData(
  scope: "ours" | "all" = "ours",
  dateFilter: string = "all",
): Promise<ReviewData> {
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

  // 상세 테이블 — 개찰일 선택(기본 전체). 날짜 칩 목록은 전체 이력 기준.
  const dateMap = new Map<string, number>();
  for (const r of rows) {
    const d2 = (r.open_result_date ?? "").slice(0, 10);
    if (!d2) continue;
    dateMap.set(d2, (dateMap.get(d2) ?? 0) + 1);
  }
  const dates = [...dateMap.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, n]) => ({ date, n }));
  const filtered = dateFilter !== "all"
    ? rows.filter((r) => (r.open_result_date ?? "").startsWith(dateFilter))
    : rows;

  return {
    scope,
    dateFilter,
    dates,
    totalAll: allRows.length,
    today: summarize(rows.filter((r) => (r.open_result_date ?? "").startsWith(today))),
    d7: summarize(byDate(since(7))),
    d30: summarize(byDate(since(30))),
    daily,
    weekly,
    monthly,
    recent: filtered.slice(0, DETAIL_CAP),
    recentTotal: filtered.length,
    totalScored: rows.length,
  };
}
