import Link from "next/link";
import { ExternalLink, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { cn, formatEokWon } from "@/lib/utils";
import {
  ddayTone,
  isFreshOpen,
  isClosingSoon,
  extractRegionLabel,
  dDayLabel,
  normalizeDateStr,
  SOURCE_LABELS,
  ATTENTION_LABEL,
  type SortColumn,
  type SortDir,
} from "@/types/domain";
import type { BidWithAssignees } from "@/lib/queries/bids";
import { BidAssigneeCell } from "./bid-assignee-cell";

/**
 * 입찰 공고 테이블 v3 — sortable headers, center align, 주목 컬럼.
 */
export function BidTable({
  rows,
  sort,
  dir,
  searchParams,
}: {
  rows: BidWithAssignees[];
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
      <div className="max-h-[calc(100vh-340px)] min-h-[480px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white border-b border-kt-light-gray/40 z-10">
            <tr className="text-[11px] font-bold uppercase tracking-wider text-kt-dark-gray">
              <ThStatic className="w-[88px]">{ATTENTION_LABEL}</ThStatic>
              <ThSortable col="close_date" label="D-day" sort={sort} dir={dir} sp={searchParams} className="w-[88px]" />
              <ThSortable col="title"      label="제목"  sort={sort} dir={dir} sp={searchParams} className="min-w-[260px]" align="left" />
              <ThSortable col="org_name"   label="기관"  sort={sort} dir={dir} sp={searchParams} className="w-[180px]"     align="left" />
              <ThStatic className="w-[120px]">지역</ThStatic>
              <ThSortable col="bid_type"   label="업종"  sort={sort} dir={dir} sp={searchParams} className="w-[64px]" />
              <ThSortable col="estimated_price" label="금액" sort={sort} dir={dir} sp={searchParams} className="w-[88px]" align="right" />
              <ThSortable col="close_date" label="마감일" sort={sort} dir={dir} sp={searchParams} className="w-[100px]" />
              <ThSortable col="open_date"  label="공고일" sort={sort} dir={dir} sp={searchParams} className="w-[100px]" />
              <ThSortable col="source"     label="출처"  sort={sort} dir={dir} sp={searchParams} className="w-[110px]" />
              <ThStatic className="w-[200px]" align="left">영업대표</ThStatic>
              <ThStatic className="w-[40px]"></ThStatic>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <BidRow key={r.id} row={r} />
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

// ──────────────── rows ────────────────

function BidRow({ row }: { row: BidWithAssignees }) {
  const dday = dDayLabel(row.close_date);
  const fresh = isFreshOpen(row.open_date);
  const closing = isClosingSoon(row.close_date);
  const region = extractRegionLabel(row.org_name, row.region, row.title);

  return (
    <tr className="border-b border-kt-light-gray/20 hover:bg-kt-light-gray/[0.04] transition-colors">
      {/* 주목 */}
      <td className="px-2 py-2 align-top text-center">
        <div className="inline-flex flex-wrap justify-center gap-1">
          {fresh && <Tag tone="purple">NEW</Tag>}
          {closing && <Tag tone="red">마감임박</Tag>}
        </div>
      </td>

      {/* D-day */}
      <td className="px-2 py-2 align-top text-center">
        <DdayBadge label={dday} />
      </td>

      {/* 제목 */}
      <td className="px-2 py-2 align-top">
        <div className="text-sm text-kt-black font-medium leading-snug line-clamp-2">
          {row.detail_url ? (
            <a
              href={row.detail_url}
              target="_blank"
              rel="noreferrer"
              className="hover:text-kt-blue hover:underline"
            >
              {row.title}
            </a>
          ) : (
            row.title
          )}
        </div>
      </td>

      {/* 기관 */}
      <td className="px-2 py-2 align-top">
        <div className="text-xs text-kt-dark-gray line-clamp-2">{row.org_name ?? "-"}</div>
      </td>

      {/* 지역 */}
      <td className="px-2 py-2 align-top text-center">
        {region.sido !== "전국/기타" ? (
          <span
            className="inline-flex items-center justify-center rounded border border-kt-blue/25 bg-kt-blue/[0.08] px-1.5 py-0.5 text-[11px] font-bold text-kt-blue whitespace-nowrap"
            title={row.region ?? undefined}
          >
            {region.label}
          </span>
        ) : region.ambiguous ? (
          <span className="text-[11px] text-kt-light-gray" title="동명 시·군·구 — 광역 미식별">-</span>
        ) : row.region ? (
          <span className="text-[11px] text-kt-dark-gray truncate inline-block max-w-full" title={row.region}>
            {row.region}
          </span>
        ) : (
          <span className="text-[11px] text-kt-light-gray">-</span>
        )}
      </td>

      {/* 업종 */}
      <td className="px-2 py-2 align-top text-center">
        {row.bid_type ? (
          <span className="inline-flex items-center justify-center rounded border border-kt-light-gray/40 bg-kt-light-gray/[0.06] px-1.5 py-0.5 text-[11px] text-kt-dark-gray">
            {row.bid_type}
          </span>
        ) : (
          <span className="text-[11px] text-kt-light-gray">-</span>
        )}
      </td>

      {/* 금액 */}
      <td className="px-2 py-2 align-top text-right">
        <div className="text-sm font-bold text-kt-black num">
          {row.estimated_price && row.estimated_price > 0
            ? formatEokWon(row.estimated_price)
            : "-"}
        </div>
      </td>

      {/* 마감일 */}
      <td className="px-2 py-2 align-top text-center text-xs text-kt-dark-gray num">
        {normalizeDateStr(row.close_date) ?? "-"}
      </td>

      {/* 공고일 */}
      <td className="px-2 py-2 align-top text-center text-xs text-kt-dark-gray num">
        {normalizeDateStr(row.open_date) ?? "-"}
      </td>

      {/* 출처 */}
      <td className="px-2 py-2 align-top text-center text-[11px] text-kt-dark-gray">
        {SOURCE_LABELS[row.source] ?? row.source}
      </td>

      {/* 영업대표 */}
      <td className="px-2 py-2 align-top">
        <BidAssigneeCell bidId={row.id} assignees={row.assignees} />
      </td>

      {/* 외부 링크 */}
      <td className="px-2 py-2 align-top text-center">
        {row.detail_url && (
          <a
            href={row.detail_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-7 w-7 items-center justify-center rounded text-kt-light-gray hover:text-kt-blue hover:bg-kt-blue/5"
            aria-label="공고 열기"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </td>
    </tr>
  );
}

function Tag({
  tone,
  children,
}: {
  tone: "purple" | "red";
  children: React.ReactNode;
}) {
  const cls =
    tone === "purple"
      ? "bg-kt-purple/10 text-kt-purple border-kt-purple/25"
      : "bg-kt-red/10 text-kt-red border-kt-red/25";
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap",
        cls,
      )}
    >
      {children}
    </span>
  );
}

function DdayBadge({ label }: { label: string | null }) {
  const tone = ddayTone(label);
  if (!label || !tone) return <span className="text-kt-light-gray text-xs">-</span>;
  const cls =
    tone === "danger" ? "bg-kt-red/10 text-kt-red border-kt-red/25"
    : tone === "warn" ? "bg-amber-100 text-amber-800 border-amber-200"
    : tone === "track"? "bg-amber-50 text-amber-700 border-amber-100"
    : "bg-kt-light-gray/15 text-kt-dark-gray border-kt-light-gray/30";
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-[11px] font-bold num whitespace-nowrap",
        cls,
      )}
    >
      {label}
    </span>
  );
}
