import { getBidKpis, getBidList, getDailyTrend } from "@/lib/queries/bids";
import { BidKpiGrid } from "@/components/bids/bid-kpi-grid";
import { BidSourceTabs } from "@/components/bids/bid-source-tabs";
import { BidTable } from "@/components/bids/bid-table";
import { BidSourceDistribution } from "@/components/bids/bid-source-distribution";
import { BidDailyTrend } from "@/components/bids/bid-daily-trend";
import type { SourceGroup } from "@/types/domain";
import { SOURCE_GROUPS } from "@/types/domain";

export const metadata = { title: "대시보드 | BIDLIVE Korea" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ group?: string; q?: string }>;
}

export default async function BidsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const groupParam = params.group;
  const groups: SourceGroup[] | undefined =
    groupParam && groupParam in SOURCE_GROUPS
      ? [groupParam as SourceGroup]
      : undefined;

  const [kpis, rows, trend] = await Promise.all([
    getBidKpis(),
    getBidList({ groups, keyword: params.q, activeOnly: true }, 500),
    getDailyTrend(14),
  ]);

  return (
    <div className="space-y-6">
      {/* 1. 페이지 타이틀 */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-kt-black">
          국내 입찰공고 대시보드
        </h1>
        <p className="text-sm text-kt-dark-gray">
          나라장터·누리장터·LH·KEPCO·방위사업청·K-water 의 공고를 매일 18시에
          자동 수집합니다.
        </p>
      </div>

      {/* 2. KPI 9-grid */}
      <BidKpiGrid kpis={kpis} />

      {/* 3. 소스별 분포 + 일별 추이 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BidSourceDistribution data={kpis.byGroup} />
        <BidDailyTrend data={trend} />
      </div>

      {/* 4. 공고 리스트 — 소스 탭 + 결과 카운트 + 테이블 */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <BidSourceTabs />
          <span className="text-xs font-medium text-kt-dark-gray">
            결과 <span className="font-bold text-kt-black num">{rows.length.toLocaleString("ko-KR")}</span>건
            <span className="text-kt-light-gray ml-1">· 마감 안 지난 공고</span>
          </span>
        </div>
        <BidTable rows={rows} />
      </div>
    </div>
  );
}
