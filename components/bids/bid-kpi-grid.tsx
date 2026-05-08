import { Briefcase, TrendingUp, Building2, Globe2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BidKpiSummary } from "@/lib/queries/bids";

/**
 * 입찰 KPI 9-grid (kteng-crm 대시보드 패턴 일치).
 *
 * 행: 오늘 / 이번 주 / 누적
 * 열: 나라장터 / 누리장터 / 기타
 *
 * 마지막 행 (누적) 강조.
 */
export function BidKpiGrid({ kpis }: { kpis: BidKpiSummary }) {
  return (
    <div className="rounded-lg border border-kt-light-gray/40 bg-white overflow-hidden">
      <div className="grid grid-cols-[110px_1fr_1fr_1fr] border-b border-kt-light-gray/30 bg-kt-light-gray/5">
        <div />
        <ColumnHeader icon={Briefcase}  label="나라장터" tone="blue" />
        <ColumnHeader icon={Building2}  label="누리장터" tone="teal" />
        <ColumnHeader icon={Globe2}     label="LH·KEPCO·기타" tone="purple" />
      </div>

      <KpiRow label="오늘"
              n={kpis.byGroup[0]?.today ?? 0}
              n2={kpis.byGroup[1]?.today ?? 0}
              n3={kpis.byGroup[2]?.today ?? 0} />
      <KpiRow label="최근 7일"
              n={kpis.byGroup[0]?.week ?? 0}
              n2={kpis.byGroup[1]?.week ?? 0}
              n3={kpis.byGroup[2]?.week ?? 0} />
      <KpiRow label="누적"
              n={kpis.byGroup[0]?.total ?? 0}
              n2={kpis.byGroup[1]?.total ?? 0}
              n3={kpis.byGroup[2]?.total ?? 0}
              highlight />
    </div>
  );
}

function ColumnHeader({
  icon: Icon, label, tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tone: "red" | "teal" | "blue" | "purple";
}) {
  const toneClass =
    tone === "red"    ? "text-kt-red"
    : tone === "teal" ? "text-kt-teal"
    : tone === "blue" ? "text-kt-blue"
    : "text-kt-purple";
  return (
    <div className="px-4 py-2 flex items-center gap-1.5 text-xs font-bold text-kt-dark-gray">
      <Icon className={cn("h-3.5 w-3.5", toneClass)} />
      {label}
    </div>
  );
}

function KpiRow({
  label, n, n2, n3, highlight,
}: {
  label: string;
  n: number;
  n2: number;
  n3: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[110px_1fr_1fr_1fr] border-b border-kt-light-gray/20 last:border-b-0",
        highlight && "bg-kt-red/[0.02]",
      )}
    >
      <div className="px-4 py-3 flex items-center border-r border-kt-light-gray/20">
        <span className={cn(
          "text-xs font-bold tracking-wide",
          highlight ? "text-kt-red" : "text-kt-dark-gray",
        )}>
          {label}
        </span>
      </div>
      <KpiCell n={n} accent="blue" />
      <KpiCell n={n2} accent="teal" />
      <KpiCell n={n3} accent="purple" />
    </div>
  );
}

function KpiCell({ n, accent }: { n: number; accent: "blue" | "teal" | "purple" | "red" }) {
  const colorClass =
    accent === "blue"   ? "text-kt-blue"
    : accent === "teal" ? "text-kt-teal"
    : accent === "red"  ? "text-kt-red"
    : "text-kt-purple";
  return (
    <div className="px-4 py-3 border-r border-kt-light-gray/20 last:border-r-0">
      <div className={cn("text-2xl font-black num", n === 0 ? "text-kt-light-gray" : colorClass)}>
        {n.toLocaleString("ko-KR")}
      </div>
      <div className="text-[11px] text-kt-light-gray num mt-0.5">건</div>
    </div>
  );
}
