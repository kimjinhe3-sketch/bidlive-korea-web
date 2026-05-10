import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  SOURCE_GROUPS,
  SOURCE_GROUP_ORDER,
  extractSido,
  isFreshOpen,
  isClosingSoon,
  type SourceGroup,
  type Sido,
  type SortColumn,
  type SortDir,
  type TagValue,
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

  // 1) source 별 누적/오늘 카운트 — Postgres view 가 사전 집계
  //    (Supabase JS 의 1000 row select 제한 우회).
  const [countsRes, lastRow] = await Promise.all([
    supabase.from("bid_source_counts").select("*"),
    supabase
      .from("bid_announcements")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const counts =
    (countsRes.data as { source: string; total: number; today: number }[] | null) ?? [];

  // source → {total, today}
  const byKey = new Map<string, { total: number; today: number }>();
  for (const r of counts) byKey.set(r.source, { total: Number(r.total), today: Number(r.today) });

  const byGroup: BidKpiBreakdown[] = SOURCE_GROUP_ORDER.map((g) => {
    let total = 0, today = 0;
    for (const s of SOURCE_GROUPS[g]) {
      const v = byKey.get(s);
      if (v) { total += v.total; today += v.today; }
    }
    return { group: g, total, today };
  });

  // 전체 합계
  let totalSum = 0, todaySum = 0;
  for (const v of byKey.values()) {
    totalSum += v.total;
    todaySum += v.today;
  }

  return {
    todayTotal: todaySum,
    total: totalSum,
    byGroup,
    lastCollectedAt: (lastRow.data as { created_at: string } | null)?.created_at ?? null,
  };
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
  tags?: TagValue[];              // 주목 필터: 신규(new) / 마감임박(closing) — OR
  sortBy?: SortColumn;            // 정렬 컬럼 (없으면 created_at)
  sortDir?: SortDir;              // asc / desc (없으면 desc)
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

  // 정렬 — 사용자 지정 우선, 없으면 created_at DESC
  const sortCol = filter.sortBy ?? "created_at";
  const sortAsc = filter.sortDir === "asc";

  let q = supabase
    .from("bid_announcements")
    .select("*")
    .order(sortCol, { ascending: sortAsc, nullsFirst: false })
    .limit(limit);

  if (sources) q = q.in("source", sources);
  if (filter.bidTypes?.length) q = q.in("bid_type", filter.bidTypes);
  if (filter.keyword) q = q.ilike("title", `%${filter.keyword}%`);
  if (filter.orgKeyword) q = q.ilike("org_name", `%${filter.orgKeyword}%`);
  if (filter.dateFrom) q = q.gte("open_date", filter.dateFrom);
  if (filter.dateTo) q = q.lte("open_date", filter.dateTo);

  // 활성 공고만 — server-side push (close_date NULL 이거나 오늘 이상)
  if (filter.activeOnly) {
    const today = new Date().toISOString().slice(0, 10);
    q = q.or(`close_date.is.null,close_date.gte.${today}`);
  }

  // D-n 임박 — server-side
  if (filter.closingWithinDays != null && filter.closingWithinDays > 0) {
    const today = new Date();
    const limit = new Date(today);
    limit.setDate(limit.getDate() + filter.closingWithinDays);
    q = q.gte("close_date", today.toISOString().slice(0, 10))
         .lte("close_date", limit.toISOString().slice(0, 10));
  }

  // 금액 — server-side
  if (filter.amountMinEok != null && filter.amountMinEok > 0) {
    q = q.gte("estimated_price", filter.amountMinEok * 1e8);
  }
  if (!filter.amountUnbounded && filter.amountMaxEok != null && filter.amountMaxEok < 9999) {
    q = q.lte("estimated_price", filter.amountMaxEok * 1e8);
  }

  const { data, error } = await q;
  if (error) {
    console.error("[bids:getBidList]", JSON.stringify(error, null, 2));
    return [];
  }
  let rows = (data ?? []) as BidAnnouncement[];

  // ── Server-side 표현 어려운 필터만 client 후처리 ──
  // (activeOnly / closingWithinDays / amount 는 위에서 server-side 처리됨)

  if (filter.regions?.length) {
    const set = new Set(filter.regions);
    rows = rows.filter((r) => set.has(extractSido(r.org_name, r.region)));
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

  // 주목 필터 — new (공고일 3일 이내) / closing (D-2 이내). OR 결합.
  if (filter.tags?.length) {
    const tagSet = new Set(filter.tags);
    rows = rows.filter((r) => {
      if (tagSet.has("new") && isFreshOpen(r.open_date)) return true;
      if (tagSet.has("closing") && isClosingSoon(r.close_date)) return true;
      return false;
    });
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
