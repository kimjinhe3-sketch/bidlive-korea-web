import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  SOURCE_GROUPS,
  SOURCE_GROUP_ORDER,
  extractSido,
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
  /** 활성 공고 (close_date NULL or 오늘 이후) — KPI 카드 클릭 시 리스트 카운트와 일치 */
  active: number;
  /** DB 누적 (마감 포함) — "누적 N" 부제 표시용 */
  total: number;
}

export interface BidKpiSummary {
  todayTotal: number;
  /** DB 누적 합계 (모든 source × 마감 포함) */
  total: number;
  /** 활성 합계 (모든 source × 활성만) — TODAY 카드 외 사용처 미정 */
  activeTotal: number;
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

  // view 가 active 컬럼 없는 구버전 (마이그레이션 미실행) 일 수도 있어서 optional 처리
  const counts =
    (countsRes.data as { source: string; total: number; active?: number; today: number }[] | null) ?? [];

  // source → {total, active, today}
  const byKey = new Map<string, { total: number; active: number; today: number }>();
  for (const r of counts) {
    byKey.set(r.source, {
      total: Number(r.total),
      active: Number(r.active ?? r.total),  // active 미존재 시 total 로 fallback
      today: Number(r.today),
    });
  }

  const byGroup: BidKpiBreakdown[] = SOURCE_GROUP_ORDER.map((g) => {
    let total = 0, active = 0, today = 0;
    for (const s of SOURCE_GROUPS[g]) {
      const v = byKey.get(s);
      if (v) { total += v.total; active += v.active; today += v.today; }
    }
    return { group: g, total, active, today };
  });

  // 전체 합계
  let totalSum = 0, activeSum = 0, todaySum = 0;
  for (const v of byKey.values()) {
    totalSum += v.total;
    activeSum += v.active;
    todaySum += v.today;
  }

  return {
    todayTotal: todaySum,
    total: totalSum,
    activeTotal: activeSum,
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

export interface BidListResult {
  rows: BidWithAssignees[];
  total: number;
  /** 현재 page/size 가 적용됐는지 (false면 클라이언트 후처리 다 받음) */
  paginated: boolean;
}

/**
 * Server pagination 가능 여부 — regions 만 client 후처리 (extractSido 폴백 필요).
 * keywords/tags 는 server-side OR 절로 옮겨 정확한 count 보장.
 */
function hasClientSideFilters(f: BidListFilter): boolean {
  return !!f.regions?.length;
}

/** PostgREST or() 절 안의 syntax char 만 제거 (값 escape 용) */
function escForOr(s: string): string {
  return s.replace(/[,()]/g, "").trim();
}

export async function getBidList(
  filter: BidListFilter = {},
  limit: number = 1000,
): Promise<BidWithAssignees[]> {
  const result = await getBidListPaged(filter, limit, 1);
  return result.rows;
}

export async function getBidListPaged(
  filter: BidListFilter = {},
  pageSize: number = 50,
  pageNum: number = 1,
): Promise<BidListResult> {
  const supabase = await createClient();

  const sources = filter.groups?.length
    ? filter.groups.flatMap((g) => [...SOURCE_GROUPS[g]])
    : null;

  // 정렬 — 사용자 지정 우선, 없으면 created_at DESC
  const sortCol = filter.sortBy ?? "created_at";
  const sortAsc = filter.sortDir === "asc";

  // regions 만 client 후처리 (extractSido 폴백 필요).
  // client filter 활성 시 50000 cap — 사실상 무한 (Supabase max-rows 안에서 정확한 count).
  const useClientPagination = hasClientSideFilters(filter);
  const fetchSize = useClientPagination ? 50000 : pageSize;
  const startIdx = useClientPagination ? 0 : (pageNum - 1) * pageSize;
  const endIdx = startIdx + fetchSize - 1;

  let q = supabase
    .from("bid_announcements")
    .select("*", { count: useClientPagination ? undefined : "exact" })
    .order(sortCol, { ascending: sortAsc, nullsFirst: false })
    .range(startIdx, endIdx);

  if (sources) q = q.in("source", sources);
  if (filter.bidTypes?.length) q = q.in("bid_type", filter.bidTypes);
  if (filter.keyword) q = q.ilike("title", `%${filter.keyword}%`);
  if (filter.orgKeyword) q = q.ilike("org_name", `%${filter.orgKeyword}%`);
  if (filter.dateFrom) q = q.gte("open_date", filter.dateFrom);
  // dateTo 는 lt next-day — open_date 가 "YYYY-MM-DD HH:MM:SS" 라
  // lte same-day 비교 시 lex 로 "2026-05-11 12:00" > "2026-05-11" → 누락됨.
  if (filter.dateTo) q = q.lt("open_date", addOneDay(filter.dateTo));

  // 활성 공고만 — server-side push (close_date NULL 이거나 오늘 이상, KST 기준)
  // 주의: DB 의 close_date 가 정규화(YYYY-MM-DD)된 상태여야 lex 비교 정상.
  // LH 슬래시 / D2B 디지트 포맷은 normalize_dates.py 로 일괄 정리됨.
  if (filter.activeOnly) {
    const todayKst = todayKstStr();
    q = q.or(`close_date.is.null,close_date.gte.${todayKst}`);
  }

  // D-n 임박 — server-side (KST). lte 는 timestamp 누락 위험이라 lt next-day.
  if (filter.closingWithinDays != null && filter.closingWithinDays > 0) {
    const todayKst = todayKstStr();
    const [y, m, d] = todayKst.split("-").map(Number);
    const limitExclusive = new Date(Date.UTC(y, m - 1, d + filter.closingWithinDays + 1))
      .toISOString().slice(0, 10);
    q = q.gte("close_date", todayKst).lt("close_date", limitExclusive);
  }

  // 금액 — server-side
  if (filter.amountMinEok != null && filter.amountMinEok > 0) {
    q = q.gte("estimated_price", filter.amountMinEok * 1e8);
  }
  if (!filter.amountUnbounded && filter.amountMaxEok != null && filter.amountMaxEok < 9999) {
    q = q.lte("estimated_price", filter.amountMaxEok * 1e8);
  }

  // 포함 키워드 — server-side OR (title.ilike.%k1% OR title.ilike.%k2%)
  if (filter.includeKeywords?.length) {
    const parts = filter.includeKeywords
      .map(escForOr)
      .filter(Boolean)
      .map((k) => `title.ilike.%${k}%`);
    if (parts.length > 0) q = q.or(parts.join(","));
  }

  // 제외 키워드 — server-side AND (title NOT ILIKE %k1% AND ...)
  if (filter.excludeKeywords?.length) {
    for (const raw of filter.excludeKeywords) {
      const k = escForOr(raw);
      if (k) q = q.not("title", "ilike", `%${k}%`);
    }
  }

  // 주목 필터 — server-side OR (new = open_date 3일 이내, closing = close_date D-2 이내)
  if (filter.tags?.length) {
    const tagSet = new Set(filter.tags);
    const todayKst = todayKstStr();
    const [y, m, d] = todayKst.split("-").map(Number);
    const newSince = new Date(Date.UTC(y, m - 1, d - 2)).toISOString().slice(0, 10);
    const closingBefore = new Date(Date.UTC(y, m - 1, d + 3)).toISOString().slice(0, 10);
    const orParts: string[] = [];
    if (tagSet.has("new")) {
      orParts.push(`open_date.gte.${newSince}`);
    }
    if (tagSet.has("closing")) {
      orParts.push(`and(close_date.gte.${todayKst},close_date.lt.${closingBefore})`);
    }
    if (orParts.length > 0) q = q.or(orParts.join(","));
  }

  const { data, error, count: serverCount } = await q;
  if (error) {
    console.error("[bids:getBidList]", JSON.stringify(error, null, 2));
    return { rows: [], total: 0, paginated: false };
  }
  let rows = (data ?? []) as BidAnnouncement[];

  // ── regions 만 client 후처리 — extractSido 폴백이 SQL 로 표현 어려움 ──
  // (keywords/tags 는 위에서 server-side OR 절로 처리됨)
  if (filter.regions?.length) {
    const set = new Set(filter.regions);
    rows = rows.filter((r) => set.has(extractSido(r.org_name, r.region, r.title)));
  }

  // 클라이언트 후처리 후 페이지네이션 (필요 시)
  let total: number;
  if (useClientPagination) {
    total = rows.length;
    const sliceStart = (pageNum - 1) * pageSize;
    rows = rows.slice(sliceStart, sliceStart + pageSize);
  } else {
    total = serverCount ?? rows.length;
  }

  // ── assignees join (별도 쿼리 — 작은 N) ──
  const ids = rows.map((r) => r.id);
  const assigneesByBid = new Map<number, BidAssignee[]>();
  if (ids.length > 0) {
    const { data: aData, error: aError } = await supabase
      .from("bid_assignees")
      .select("*")
      .in("bid_id", ids);
    if (aError) {
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

  return {
    rows: rows.map((r) => ({ ...r, assignees: assigneesByBid.get(r.id) ?? [] })),
    total,
    paginated: !useClientPagination,
  };
}

// ───────────────────── helpers ─────────────────────

/** KST 기준 오늘 — "YYYY-MM-DD" 반환. 자정 직후 UTC 가 어제인 경우 보정. */
function todayKstStr(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  return kst.toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" 의 다음날 "YYYY-MM-DD". timestamp 누락 막기 위한 inclusive→exclusive 변환용. */
function addOneDay(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

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


// ───────────────────── AI 투찰 추천 ─────────────────────

export interface BidRecommendation {
  bid_no: string;
  rec_bid_rate: number;
  rec_bid_amount: number;
  est_lower_rate: number;
  expected_sajeong: number;
  margin: number;
  confidence: "high" | "medium" | "low";
  sample_count: number;
  rationale: Record<string, unknown> | null;
}

/**
 * 현재 페이지 행들의 AI 추천 캐시 조회 — bid_no in(...) 단건 인덱스 조회라 가볍다.
 * (계산은 bid-collector 배치가 매일 저녁 수행 — 웹은 조회만)
 */
export async function getRecommendations(
  bidNos: string[],
): Promise<Record<string, BidRecommendation>> {
  if (bidNos.length === 0) return {};
  // bid_recommendations 는 RLS 로 잠겨 있어 admin client 로 조회 (server-only 파일)
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bid_recommendations")
    .select(
      "bid_no,rec_bid_rate,rec_bid_amount,est_lower_rate,expected_sajeong,margin,confidence,sample_count,rationale",
    )
    .in("bid_no", bidNos);
  if (error) return {}; // 추천 실패해도 대시보드는 정상 (graceful degradation)
  const map: Record<string, BidRecommendation> = {};
  for (const r of (data as BidRecommendation[] | null) ?? []) map[r.bid_no] = r;
  return map;
}
