import Link from "next/link";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ATTENTION_LABEL,
  type SortColumn,
  type SortDir,
} from "@/types/domain";
import type { BidWithAssignees, BidRecommendation } from "@/lib/queries/bids";
import { BidRow } from "./bid-row";

/**
 * 입찰 공고 테이블 v3 — sortable headers, center align, 주목 컬럼.
 */
export function BidTable({
  rows,
  recs,
  sort,
  dir,
  searchParams,
}: {
  rows: BidWithAssignees[];
  recs: Record<string, BidRecommendation>;
  sort: SortColumn | null;
  dir: SortDir | null;
  searchParams: Record<string, string | undefined>;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-kt-light-gray/40 bg-white py-16 text-center">
        <p className="text-sm text-kt-dark-gray">조건에 해당하는 공고가 없습니다.</p>
        <p className="mt-1 text-xs text-kt-light-gray">
          상단 필터에서 조건을 조정하거나 초기화 해보세요.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-kt-light-gray/40 bg-white overflow-hidden">
      <div className="max-h-[calc(100vh-300px)] min-h-[480px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white border-b border-kt-light-gray/40 z-10">
            <tr className="text-[11px] font-bold uppercase tracking-wider text-kt-dark-gray">
              <ThStatic className="w-[88px]">{ATTENTION_LABEL}</ThStatic>
              <ThSortable col="close_date" label="D-day" sort={sort} dir={dir} sp={searchParams} className="w-[88px]" />
              <ThSortable col="title"      label="제목"  sort={sort} dir={dir} sp={searchParams} className="min-w-[260px]" align="left" />
              <ThSortable col="org_name"   label="기관"  sort={sort} dir={dir} sp={searchParams} className="w-[180px]"     align="left" />
              <ThStatic className="w-[80px]">지역</ThStatic>
              <ThSortable col="bid_type"   label="업종"  sort={sort} dir={dir} sp={searchParams} className="w-[64px]" />
              <ThSortable col="estimated_price" label="금액" sort={sort} dir={dir} sp={searchParams} className="w-[88px]" align="right" />
              <ThSortable col="rec_rank" label="AI 추천" sort={sort} dir={dir} sp={searchParams} className="w-[96px]" />
              <ThSortable col="close_date" label="마감일" sort={sort} dir={dir} sp={searchParams} className="w-[100px]" />
              <ThSortable col="open_date"  label="공고일" sort={sort} dir={dir} sp={searchParams} className="w-[100px]" />
              <ThSortable col="source"     label="출처"  sort={sort} dir={dir} sp={searchParams} className="w-[110px]" />
              <ThStatic className="w-[200px]" align="left">영업대표</ThStatic>
              <ThStatic className="w-[40px]"></ThStatic>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <BidRow key={r.id} row={r} rec={recs[r.bid_no] ?? null} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ──────────────── headers ────────────────

function ThStatic({
  children,
  className,
  align = "center",
}: {
  children?: React.ReactNode;
  className?: string;
  align?: "left" | "center" | "right";
}) {
  return (
    <th
      className={cn(
        "px-2 py-2.5 whitespace-nowrap",
        align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

function ThSortable({
  col,
  label,
  sort,
  dir,
  sp,
  className,
  align = "center",
}: {
  col: SortColumn;
  label: string;
  sort: SortColumn | null;
  dir: SortDir | null;
  sp: Record<string, string | undefined>;
  className?: string;
  align?: "left" | "center" | "right";
}) {
  const active = sort === col;
  const nextDir: SortDir | null = !active ? "asc" : dir === "asc" ? "desc" : null;

  // 다음 상태로 가는 URL 빌드
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (v && k !== "sort" && k !== "dir") params.set(k, v);
  }
  if (nextDir) {
    params.set("sort", col);
    params.set("dir", nextDir);
  }
  const href = "/bids" + (params.toString() ? `?${params.toString()}` : "");

  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;

  return (
    <th
      className={cn(
        "px-2 py-2.5 whitespace-nowrap",
        align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left",
        className,
      )}
    >
      <Link
        href={href}
        scroll={false}
        className={cn(
          "inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:bg-kt-light-gray/15",
          active ? "text-kt-red" : "text-kt-dark-gray hover:text-kt-black",
          align === "right" && "flex-row-reverse",
        )}
      >
        {label}
        <Icon className={cn("h-3 w-3", !active && "opacity-40")} />
      </Link>
    </th>
  );
}
