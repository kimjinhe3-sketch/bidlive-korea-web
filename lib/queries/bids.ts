import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  SOURCE_GROUPS,
  SOURCE_GROUP_ORDER,
  extractSido,
  type SourceGroup,
  type Sido,
} from "@/types/domain";
import type { BidAnnouncement, BidAssignee } from "@/types/database";

// ───────────────────── KPI ─────────────────────

export interface BidKpiBreakdown {
  group: SourceGroup;
  today: number;
  total: number;
}

export interface BidKpiSummary {
  todayTotal: number;
  total: number;
  byGroup: BidKpiBreakdown[];
  lastCollectedAt: string | null;
}

export async function getBidKpis(): Promise<BidKpiSummary> {
  const supabase = await createClient();
  const todayStartIso = startOfDayKstIso();

  const [todayRows, totalRows, lastRow] = await Promise.all([
    supabase
      .from("bid_announcements")
      .select("source")
      .gte("created_at", todayStartIso),
    supabase
      .from("bid_announcements")
      .select("source"),
    supabase
      .from("bid_announcements")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const todayMap = countBySource(todayRows.data as { source: string }[] | null);
  const totalMap = countBySource(totalRows.data as { source: string }[] | null);

  const byGroup: BidKpiBreakdown[] = SOURCE_GROUP_ORDER.map((g) => ({
    group: g,
    today: sumForSources(todayMap, SOURCE_GROUPS[g]),
    total: sumForSources(totalMap, SOURCE_GROUPS[g]),
  }));

  let totalSum = 0;
  for (const v of totalMap.values()) totalSum += v;
  const todaySum = todayRows.data?.length ?? 0;

  return {
    todayTotal: todaySum,
    total: totalSum,
    byGroup,
    lastCollectedAt: (lastRow.data as { created_at: string } | null)?.created_at ?? null,
  };
}

function countBySource(rows: { source: string }[] | null) {
  const m = new Map<string, number>();
  if (!rows) return m;
  for (const r of rows) m.set(r.source, (m.get(r.source) ?? 0) + 1);
  return m;
}

function sumForSources(m: Map<string, number>, sources: readonly string[]) {
  let n = 0;
  for (const s of sources) n += m.get(s) ?? 0;
  return n;
}

// ───────────────────── List + Filter ─────────────────────

export interface BidListFilter {
  groups?: SourceGroup[];
  bidTypes?: string[];
  keyword?: string;
  orgKeyword?: string;
  regions?: (Sido | "전국/기타")[];
  amountMinEok?: number;
  amountMaxEok?: number;
  amountUnbounded?: boolean;
  activeOnly?: boolean;
  closingWithinDays?: number;     // D-n 임계 (1~14)
  dateFrom?: string;
  dateTo?: string;
  includeKeywords?: string[];     // 제목에 하나라도 있으면 통과
  excludeKeywords?: string[];     // 제목에 하나라도 있으면 제외
}

export interface BidWithAssignees extends BidAnnouncement {
  assignees: BidAssignee[];
}

export async function getBidList(
  filter: BidListFilter = {},
  limit: number = 1000,
): Promise<BidWithAssignees[]> {
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
    console.error("[bids:getBidList]", JSON.stringify(error, null, 2));
    return [];
  }
  let rows = (data ?? []) as BidAnnouncement[];

  // ── Python-side 필터 (Supabase WHERE 로 표현 어려운 것) ──
  const today = new Date();

  if (filter.activeOnly) {
    const todayIso = today.toISOString().slice(0, 10);
    rows = rows.filter((r) => !r.close_date || r.close_date.slice(0, 10) >= todayIso);
  }

  if (filter.closingWithinDays != null && filter.closingWithinDays > 0) {
    const limit = filter.closingWithinDays;
    rows = rows.filter((r) => {
      if (!r.close_date) return false;
      const close = new Date(r.close_date.slice(0, 10));
      const diff = Math.round((close.getTime() - todayMidnight(today)) / 86400000);
      return diff >= 0 && diff <= limit;
    });
  }

  if (filter.amountMinEok != null && filter.amountMinEok > 0) {
    const min = filter.amountMinEok * 1e8;
    rows = rows.filter((r) => (r.estimated_price ?? 0) >= min);
  }
  if (!filter.amountUnbounded && filter.amountMaxEok != null && filter.amountMaxEok < 9999) {
    const max = filter.amountMaxEok * 1e8;
    rows = rows.filter((r) => (r.estimated_price ?? Number.POSITIVE_INFINITY) <= max);
  }

  if (filter.regions?.length) {
    const set = new Set(filter.regions);
    rows = rows.filter((r) => set.has(extractSido(r.org_name)));
  }

  if (filter.includeKeywords?.length) {
    const kws = filter.includeKeywords.map((k) => k.toLowerCase());
    rows = rows.filter((r) =>
      kws.some((k) => (r.title ?? "").toLowerCase().includes(k))
    );
  }
  if (filter.excludeKeywords?.length) {
    const kws = filter.excludeKeywords.map((k) => k.toLowerCase());
    rows = rows.filter((r) =>
      !kws.some((k) => (r.title ?? "").toLowerCase().includes(k))
    );
  }

  // ── assignees join (별도 쿼리 — 작은 N) ──
  const ids = rows.map((r) => r.id);
  let assigneesByBid = new Map<number, BidAssignee[]>();
  if (ids.length > 0) {
    const { data: aData, error: aError } = await supabase
      .from("bid_assignees")
      .select("*")
      .in("bid_id", ids);
    if (aError) {
      // 테이블 없으면 무시 (사용자가 SQL 미적용)
      console.warn("[bids:getBidList] assignees skip:", aError.message);
    } else {
      const arr = (aData ?? []) as BidAssignee[];
      for (const a of arr) {
        const list = assigneesByBid.get(a.bid_id) ?? [];
        list.push(a);
        assigneesByBid.set(a.bid_id, list);
      }
    }
  }

  return rows.map((r) => ({ ...r, assignees: assigneesByBid.get(r.id) ?? [] }));
}

// ───────────────────── helpers ─────────────────────

function startOfDayKstIso(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  kst.setUTCHours(0, 0, 0, 0);
  return new Date(kst.getTime() - 9 * 3600 * 1000).toISOString();
}

function todayMidnight(today: Date) {
  const d = new Date(today);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// dDayLabel 은 client 에서도 사용 가능하도록 types/domain.ts 로 이동.
// 마감임박 카운트 (KPI 보조용 — 향후 사용)
export async function getClosingSoonCount(within: number = 2): Promise<number> {
  const supabase = await createClient();
  const today = new Date();
  const limit = new Date(today);
  limit.setDate(limit.getDate() + within);
  const todayIso = today.toISOString().slice(0, 10);
  const limitIso = limit.toISOString().slice(0, 10);

  const { count, error } = await supabase
    .from("bid_announcements")
    .select("*", { count: "exact", head: true })
    .gte("close_date", todayIso)
    .lte("close_date", limitIso);
  if (error) return 0;
  return count ?? 0;
}
