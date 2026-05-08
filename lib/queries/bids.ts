import "server-only";

import { createClient } from "@/lib/supabase/server";
import { SOURCE_GROUPS, type SourceGroup } from "@/types/domain";
import type { BidAnnouncement } from "@/types/database";

export interface BidKpiBreakdown {
  group: SourceGroup;
  today: number;
  week: number;
  total: number;
}

export interface BidKpiSummary {
  today: number;
  week: number;
  total: number;
  byGroup: BidKpiBreakdown[];
  /** 마지막 created_at (가장 최근 적재 시각) */
  lastCollectedAt: string | null;
}

/**
 * 핵심 KPI 한 번에 계산.
 * - 오늘 (KST 기준 자정~)
 * - 이번주 (지난 7일)
 * - 누적 (전체)
 * - 그룹별 분포 (today/week/total)
 */
export async function getBidKpis(): Promise<BidKpiSummary> {
  const supabase = await createClient();

  const todayStartIso = startOfDayKstIso();
  const weekStartIso = nDaysAgoIso(7);

  // 한 번의 쿼리로 source 별 카운트 가져옴 (today / week / total 각각)
  // Supabase 는 group by 를 직접 제공하지 않으므로 source 별로 head:true count
  // 가 가장 효율적이지만 source 가 ~20개라 raw select 후 클라 측 집계가 더 빠름.

  const [todayRows, weekRows, totalRows, lastRow] = await Promise.all([
    supabase
      .from("bid_announcements")
      .select("source", { count: "exact" })
      .gte("created_at", todayStartIso),
    supabase
      .from("bid_announcements")
      .select("source", { count: "exact" })
      .gte("created_at", weekStartIso),
    supabase
      .from("bid_announcements")
      .select("source", { count: "exact" }),
    supabase
      .from("bid_announcements")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const todayBySource = countBySourceFromRows(todayRows.data as { source: string }[] | null);
  const weekBySource = countBySourceFromRows(weekRows.data as { source: string }[] | null);
  const totalBySource = countBySourceFromRows(totalRows.data as { source: string }[] | null);
  const lastCreatedAt = (lastRow.data as { created_at: string } | null)?.created_at ?? null;

  const groups: SourceGroup[] = ["나라장터", "누리장터", "기타"];
  const byGroup: BidKpiBreakdown[] = groups.map((g) => {
    const sources = SOURCE_GROUPS[g];
    return {
      group: g,
      today: sumForSources(todayBySource, sources),
      week: sumForSources(weekBySource, sources),
      total: sumForSources(totalBySource, sources),
    };
  });

  return {
    today: todayRows.count ?? 0,
    week: weekRows.count ?? 0,
    total: totalRows.count ?? 0,
    byGroup,
    lastCollectedAt: lastCreatedAt,
  };
}

function countBySourceFromRows(rows: { source: string }[] | null) {
  const m = new Map<string, number>();
  if (!rows) return m;
  for (const r of rows) m.set(r.source, (m.get(r.source) ?? 0) + 1);
  return m;
}

function sumForSources(byMap: Map<string, number>, sources: readonly string[]) {
  let n = 0;
  for (const s of sources) n += byMap.get(s) ?? 0;
  return n;
}

export interface BidListFilter {
  groups?: SourceGroup[];
  bidTypes?: string[];
  keyword?: string;
  orgKeyword?: string;
  region?: string[];
  amountMinEok?: number;
  amountMaxEok?: number;
  activeOnly?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

/**
 * 페이지의 메인 리스트.
 * Supabase 쿼리는 server-side 필터링, 추가 정제 (region 등) 는 메모리.
 */
export async function getBidList(
  filter: BidListFilter = {},
  limit: number = 1000,
): Promise<BidAnnouncement[]> {
  const supabase = await createClient();

  const sources = filter.groups?.length
    ? filter.groups.flatMap((g) => [...SOURCE_GROUPS[g]])
    : null;

  let q = supabase
    .from("bid_announcements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (sources) q = q.in("source", sources);
  if (filter.bidTypes?.length) q = q.in("bid_type", filter.bidTypes);
  if (filter.keyword) q = q.ilike("title", `%${filter.keyword}%`);
  if (filter.orgKeyword) q = q.ilike("org_name", `%${filter.orgKeyword}%`);
  if (filter.dateFrom) q = q.gte("open_date", filter.dateFrom);
  if (filter.dateTo) q = q.lte("open_date", filter.dateTo);

  const { data, error } = await q;
  if (error) {
    console.error("[bids:getBidList]", error);
    return [];
  }
  let rows = (data ?? []) as BidAnnouncement[];

  // 진행중 (마감일 ≥ 오늘)
  if (filter.activeOnly) {
    const today = new Date().toISOString().slice(0, 10);
    rows = rows.filter((r) => !r.close_date || r.close_date.slice(0, 10) >= today);
  }

  // 금액 (억 단위) — server-side 어렵게 가능하지만 클라가 더 단순
  if (filter.amountMinEok != null && filter.amountMinEok > 0) {
    const min = filter.amountMinEok * 1e8;
    rows = rows.filter((r) => (r.estimated_price ?? 0) >= min);
  }
  if (filter.amountMaxEok != null && filter.amountMaxEok < 9999) {
    const max = filter.amountMaxEok * 1e8;
    rows = rows.filter((r) => (r.estimated_price ?? Number.POSITIVE_INFINITY) <= max);
  }

  return rows;
}

/** 일별 수집 추이 (최근 N일) — 차트용 */
export async function getDailyTrend(days: number = 14): Promise<{ date: string; n: number }[]> {
  const supabase = await createClient();
  const fromIso = nDaysAgoIso(days);

  const { data, error } = await supabase
    .from("bid_announcements")
    .select("created_at")
    .gte("created_at", fromIso);

  if (error || !data) {
    console.error("[bids:getDailyTrend]", error);
    return [];
  }

  const byDate = new Map<string, number>();
  const typedData = data as { created_at: string }[];
  for (const r of typedData) {
    const d = r.created_at.slice(0, 10);
    byDate.set(d, (byDate.get(d) ?? 0) + 1);
  }

  // 빈 날짜도 0 으로 채워서 반환
  const result: { date: string; n: number }[] = [];
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() - i);
    const iso = d.toISOString().slice(0, 10);
    result.push({ date: iso, n: byDate.get(iso) ?? 0 });
  }
  return result;
}

// ───────────────────────── helpers ─────────────────────────

function startOfDayKstIso(): string {
  const now = new Date();
  // KST = UTC+9
  const kstNow = new Date(now.getTime() + 9 * 3600 * 1000);
  kstNow.setUTCHours(0, 0, 0, 0);
  return new Date(kstNow.getTime() - 9 * 3600 * 1000).toISOString();
}

function nDaysAgoIso(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

/**
 * D-day 라벨 ("D-day", "D-1", ..., "D-7", null = 7일 초과 또는 마감 지남).
 *
 * "마감" = 이미 마감일 지남.
 */
export function dDayLabel(closeDate: string | null, today: Date = new Date()): string | null {
  if (!closeDate) return null;
  const close = new Date(closeDate.slice(0, 10));
  const todayMidnight = new Date(today);
  todayMidnight.setHours(0, 0, 0, 0);
  const diffMs = close.getTime() - todayMidnight.getTime();
  const diff = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diff < 0) return "마감";
  if (diff === 0) return "D-day";
  if (diff <= 7) return `D-${diff}`;
  return null;
}
