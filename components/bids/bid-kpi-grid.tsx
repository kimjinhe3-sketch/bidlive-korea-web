import { Building2, Briefcase, Globe2, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BidKpiSummary, BidKpiBreakdown } from "@/lib/queries/bids";
import type { SourceGroup } from "@/types/domain";

/**
 * KPI 영역 — v2.
 *  - 좌측: 오늘 자 공고된 입찰 건수 (거대 수치, primary)
 *  - 우측: 누적 4-그룹 카드 (나라장터 / LH / KEPCO / 기타)
 */
export function BidKpiGrid({ kpis }: { kpis: BidKpiSummary }) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-4">
      <TodayCard count={kpis.todayTotal} total={kpis.total} />
      <GroupGrid items={kpis.byGroup} />
    </div>
  );
}

function TodayCard({ count, total }: { count: number; total: number }) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-kt-light-gray/40 bg-white p-6">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-kt-red" />
      <div className="flex items-center gap-2 text-[11px] font-bold tracking-widest uppercase text-kt-red">
        <Sparkles className="h-3.5 w-3.5" />
        Today · 오늘 신규 공고
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className={cn(
          "font-black num leading-none tracking-tight",
          count === 0 ? "text-kt-light-gray" : "text-kt-black",
        )} style={{ fontSize: "5rem" }}>
          {count.toLocaleString("ko-KR")}
        </span>
        <span className="text-2xl font-bold text-kt-dark-gray">건</span>
      </div>
      <div className="mt-3 text-xs text-kt-dark-gray">
        DB 누적 <span className="font-bold text-kt-black num">{total.toLocaleString("ko-KR")}</span>건
      </div>
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

const GROUP_META: Record<SourceGroup, { icon: LucideIcon; tone: string }> = {
  나라장터: { icon: Briefcase,  tone: "text-kt-blue   border-kt-blue/30" },
  LH:       { icon: Building2,  tone: "text-kt-teal   border-kt-teal/30" },
  KEPCO:    { icon: Sparkles,   tone: "text-kt-purple border-kt-purple/30" },
  기타:     { icon: Globe2,     tone: "text-kt-dark-gray border-kt-light-gray/40" },
};

function GroupCard({ item }: { item: BidKpiBreakdown }) {
  const meta = GROUP_META[item.group];
  const Icon = meta.icon;
  return (
    <div className="rounded-lg border border-kt-light-gray/40 bg-white p-4 hover:shadow-sm transition-shadow">
      <div className={cn("flex items-center gap-1.5 text-[11px] font-bold tracking-wider uppercase", meta.tone)}>
        <Icon className="h-3 w-3" />
        {item.group}
      </div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className={cn(
          "text-3xl font-black num leading-none tracking-tight",
          item.total === 0 ? "text-kt-light-gray" : "text-kt-black",
        )}>
          {item.total.toLocaleString("ko-KR")}
        </span>
        <span className="text-sm font-bold text-kt-dark-gray">건</span>
      </div>
      <div className="mt-1.5 text-[11px] text-kt-light-gray">
        오늘 <span className={cn(
          "font-bold num",
          item.today > 0 ? "text-kt-red" : "text-kt-light-gray",
        )}>+{item.today.toLocaleString("ko-KR")}</span>
      </div>
    </div>
  );
}
