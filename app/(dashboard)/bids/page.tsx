import { getBidKpis, getBidList } from "@/lib/queries/bids";
import { BidKpiGrid } from "@/components/bids/bid-kpi-grid";
import { BidSourceTabs } from "@/components/bids/bid-source-tabs";
import { BidTable } from "@/components/bids/bid-table";
import { BidFilterToolbar } from "@/components/bids/bid-filter-toolbar";
import { BidCollectButton } from "@/components/bids/bid-collect-button";
import { BidExportButton } from "@/components/bids/bid-export-button";
import {
  SOURCE_GROUPS,
  SORTABLE_COLUMNS,
  type SourceGroup,
  type Sido,
  type TagValue,
  type SortColumn,
  type SortDir,
} from "@/types/domain";

export const metadata = { title: "대시보드 | BIDLIVE Korea" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

function parseList(s: string | undefined) {
  if (!s) return [];
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

export default async function BidsPage({ searchParams }: PageProps) {
  const sp = await searchParams;

  // group → SourceGroup[] 매핑 (segment tab)
  const groupParam = sp.group;
  const groups: SourceGroup[] | undefined =
    groupParam && groupParam in SOURCE_GROUPS
      ? [groupParam as SourceGroup]
      : undefined;

  // sort 검증 — SORTABLE_COLUMNS 의 키만 허용
  const sortBy: SortColumn | undefined =
    sp.sort && sp.sort in SORTABLE_COLUMNS ? (sp.sort as SortColumn) : undefined;
  const sortDir: SortDir | undefined =
    sp.dir === "asc" ? "asc" : sp.dir === "desc" ? "desc" : undefined;

  const filter = {
    groups,
    keyword: sp.q,
    orgKeyword: sp.org,
    bidTypes: parseList(sp.types),
    regions: parseList(sp.regions) as (Sido | "전국/기타")[],
    tags: parseList(sp.tags) as TagValue[],
    activeOnly: sp.active !== "0",
    closingWithinDays: sp.dday ? Number(sp.dday) : undefined,
    amountMinEok: sp.amin ? Number(sp.amin) : undefined,
    amountMaxEok: sp.amax ? Number(sp.amax) : undefined,
    amountUnbounded: sp.aopen === "1",
    dateFrom: sp.from,
    dateTo: sp.to,
    includeKeywords: parseList(sp.inc),
    excludeKeywords: parseList(sp.exc),
    sortBy,
    sortDir,
  };

  // cleanup (close_date 7일 지나면 자동 삭제) 으로 활성 row 줄어듦 → limit 풀어도 OK
  const LIST_LIMIT = 1500;
  const [kpis, rows] = await Promise.all([
    getBidKpis(),
    getBidList(filter, LIST_LIMIT),
  ]);

  // KPI 카드 클릭 → 오늘 공고 리스트 (open_date = 오늘) 로 이동할 때 사용
  const todayKst = new Date(new Date().getTime() + 9 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);

  return (
    <div className="space-y-5">
      {/* 1. 페이지 헤더 + 액션 */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-kt-black">
            국내 입찰공고 대시보드
          </h1>
          <p className="text-xs text-kt-dark-gray">
            나라장터 · LH · KEPCO · 기타(누리장터·방위사업청·K-water·ALIO·도로공사) — 매일 18시 자동 수집
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BidExportButton rows={rows} />
          <BidCollectButton />
        </div>
      </div>

      {/* 2. KPI — TODAY 거대 + 4 그룹 누적 (클릭 → 필터 리스트) */}
      <BidKpiGrid kpis={kpis} today={todayKst} />

      {/* 3. 필터 툴바 — 표 위 한 줄 */}
      <BidFilterToolbar />

      {/* 4. 소스 segment + 결과 카운트 + 테이블 */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <BidSourceTabs />
          <span className="text-xs font-medium text-kt-dark-gray">
            결과 <span className="font-bold text-kt-black num">{rows.length.toLocaleString("ko-KR")}</span>건
            {rows.length === LIST_LIMIT && (
              <span className="ml-1 text-[11px] text-kt-red">(최대 {LIST_LIMIT}건 — 필터로 좁히세요)</span>
            )}
          </span>
        </div>
        <BidTable
          rows={rows}
          sort={sortBy ?? null}
          dir={sortDir ?? null}
          searchParams={sp}
        />
      </section>
    </div>
  );
}
