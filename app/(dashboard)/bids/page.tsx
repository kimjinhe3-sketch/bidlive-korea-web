import { getBidKpis, getBidList } from "@/lib/queries/bids";
import { BidKpiGrid } from "@/components/bids/bid-kpi-grid";
import { BidSourceTabs } from "@/components/bids/bid-source-tabs";
import { BidTable } from "@/components/bids/bid-table";
import { BidFilterPanel } from "@/components/bids/bid-filter-panel";
import { BidCollectButton } from "@/components/bids/bid-collect-button";
import { BidExportButton } from "@/components/bids/bid-export-button";
import { SOURCE_GROUPS, type SourceGroup, type Sido } from "@/types/domain";

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

  const filter = {
    groups,
    keyword: sp.q,
    orgKeyword: sp.org,
    bidTypes: parseList(sp.types),
    regions: parseList(sp.regions) as (Sido | "전국/기타")[],
    activeOnly: sp.active !== "0",
    closingWithinDays: sp.dday ? Number(sp.dday) : undefined,
    amountMinEok: sp.amin ? Number(sp.amin) : undefined,
    amountMaxEok: sp.amax ? Number(sp.amax) : undefined,
    amountUnbounded: sp.aopen === "1",
    dateFrom: sp.from,
    dateTo: sp.to,
    includeKeywords: parseList(sp.inc),
    excludeKeywords: parseList(sp.exc),
  };

  const [kpis, rows] = await Promise.all([
    getBidKpis(),
    getBidList(filter, 1500),
  ]);

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

      {/* 2. KPI — TODAY 거대 + 4 그룹 누적 */}
      <BidKpiGrid kpis={kpis} />

      {/* 3. 필터 패널 + 메인 (좌 280 / 우 나머지) */}
      <div className="flex gap-4 items-start">
        <BidFilterPanel />

        <section className="flex-1 min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <BidSourceTabs />
            <span className="text-xs font-medium text-kt-dark-gray">
              결과 <span className="font-bold text-kt-black num">{rows.length.toLocaleString("ko-KR")}</span>건
            </span>
          </div>
          <BidTable rows={rows} />
        </section>
      </div>
    </div>
  );
}
