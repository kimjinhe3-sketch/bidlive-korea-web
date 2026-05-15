import Link from "next/link";
import { Building2, Briefcase, Globe2, Sparkles, ArrowUpRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BidKpiSummary, BidKpiBreakdown } from "@/lib/queries/bids";
import type { SourceGroup } from "@/types/domain";

/**
 * KPI v3 — 클릭 가능, 콤팩트 폰트.
 *
 * - TODAY 카드 → /bids?from=today&to=today  (open_date 기반 오늘 공고)
 * - DB 누적 텍스트 → /bids                  (모든 필터 초기화)
 * - 그룹 카드(나라장터/LH/KEPCO/기타) → /bids?group=X  (그룹 누적 리스트)
 * - 폰트: TODAY 5rem → 3.25rem, 그룹 3xl → 2xl
 */
export function BidKpiGrid({ kpis, today }: { kpis: BidKpiSummary; today: string }) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-3">
      <TodayCard count={kpis.todayTotal} total={kpis.total} today={today} />
      <GroupGrid items={kpis.byGroup} />
    </div>
  );
}

function TodayCard({
  count,
  total,
  today,
}: {
  count: number;
  total: number;
  today: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-kt-light-gray/40 bg-white">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-kt-red" />

      {/* 본문: 오늘 공고 리스트로 이동 */}
      <Link
        href={`/bids?from=${today}&to=${today}`}
        className="block p-5 hover:bg-kt-red/[0.02] transition-colors group"
        title="오늘 공고된 입찰 리스트로 이동"
      >
        <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-widest uppercase text-kt-red">
          <Sparkles className="h-3 w-3" />
          Today · 오늘 공고
          <ArrowUpRight className="ml-auto h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span
            className={cn(
              "font-black num leading-none tracking-tight",
              count === 0 ? "text-kt-light-gray" : "text-kt-black",
            )}
            style={{ fontSize: "3.25rem" }}
          >
            {count.toLocaleString("ko-KR")}
          </span>
          <span className="text-lg font-bold text-kt-dark-gray">건</span>
        </div>
      </Link>

      {/* DB 누적 — 별도 라인, 클릭 시 필터 초기화 (전체 리스트) */}
      <Link
        href="/bids"
        className="block border-t border-kt-light-gray/30 bg-kt-light-gray/[0.04] px-5 py-2 text-xs text-kt-dark-gray hover:bg-kt-light-gray/[0.10] transition-colors group"
        title="필터 초기화하고 누적 전체 리스트 보기"
      >
        DB 누적 <span className="font-bold text-kt-black num">{total.toLocaleString("ko-KR")}</span>건
        <ArrowUpRight className="inline-block ml-1 h-3 w-3 align-middle opacity-0 group-hover:opacity-100 transition-opacity" />
      </Link>
    </div>
  );
}

function GroupGrid({ items }: { items: BidKpiBreakdown[] }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map((it) => (
        <GroupCard key={it.group} item={it} />
      ))}
    </div>
  );
}

const GROUP_META: Record<SourceGroup, { icon: LucideIcon; tone: string; bar: string }> = {
  나라장터: { icon: Briefcase, tone: "text-kt-blue",      bar: "bg-kt-blue" },
  LH:       { icon: Building2, tone: "text-kt-teal",      bar: "bg-kt-teal" },
  KEPCO:    { icon: Sparkles,  tone: "text-kt-purple",    bar: "bg-kt-purple" },
  기타:     { icon: Globe2,    tone: "text-kt-dark-gray", bar: "bg-kt-light-gray" },
};

function GroupCard({ item }: { item: BidKpiBreakdown }) {
  const meta = GROUP_META[item.group];
  const Icon = meta.icon;
  // 큰 숫자 = active (카드 클릭 후 리스트 카운트와 일치). 누적은 부제로.
  const showCumulative = item.total !== item.active;
  return (
    <Link
      href={`/bids?group=${encodeURIComponent(item.group)}`}
      className="group relative overflow-hidden rounded-lg border border-kt-light-gray/40 bg-white p-4 hover:shadow-sm hover:border-kt-light-gray transition-all"
      title={`${item.group} 활성 ${item.active.toLocaleString("ko-KR")}건 · 누적 ${item.total.toLocaleString("ko-KR")}건`}
    >
      <div className={cn("absolute left-0 top-0 bottom-0 w-0.5", meta.bar)} />
      <div className={cn("flex items-center gap-1.5 text-[11px] font-bold tracking-wider uppercase", meta.tone)}>
        <Icon className="h-3 w-3" />
        {item.group}
        <ArrowUpRight className="ml-auto h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span
          className={cn(
            "text-2xl font-black num leading-none tracking-tight",
            item.active === 0 ? "text-kt-light-gray" : "text-kt-black",
          )}
        >
          {item.active.toLocaleString("ko-KR")}
        </span>
        <span className="text-xs font-bold text-kt-dark-gray">건</span>
      </div>
      <div className="mt-1 text-[11px] text-kt-light-gray flex items-center gap-2">
        <span>
          오늘{" "}
          <span
            className={cn(
              "font-bold num",
              item.today > 0 ? "text-kt-red" : "text-kt-light-gray",
            )}
          >
            +{item.today.toLocaleString("ko-KR")}
          </span>
        </span>
        {showCumulative && (
          <span className="text-kt-light-gray/80">
            · 누적 <span className="num">{item.total.toLocaleString("ko-KR")}</span>
          </span>
        )}
      </div>
    </Link>
  );
}
