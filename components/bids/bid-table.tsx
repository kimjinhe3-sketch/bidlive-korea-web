import { ExternalLink } from "lucide-react";
import { cn, formatEokWon } from "@/lib/utils";
import {
  ddayTone,
  isFreshOpen,
  isClosingSoon,
  extractSido,
  dDayLabel,
  SOURCE_LABELS,
} from "@/types/domain";
import type { BidWithAssignees } from "@/lib/queries/bids";
import { BidAssigneeCell } from "./bid-assignee-cell";

/**
 * 입찰 공고 테이블 v2.
 *
 * 컬럼:
 *  태그(NEW + 마감임박) · D-day · 제목 · 기관(+지역) · 업종 · 금액 · 마감일 · 출처 · 영업대표 · 열기
 *
 * - "신규" 정의: 입찰 공고일(open_date) 기준 오늘/어제/그제 (3일 이내)
 * - "마감임박" 정의: D-day, D-1, D-2 (3일 이내 마감)
 * - D-day 셀 너비 64px → 78px (nowrap, 'D-day' 도 한 줄)
 */
export function BidTable({ rows }: { rows: BidWithAssignees[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-kt-light-gray/40 bg-white py-16 text-center">
        <p className="text-sm text-kt-dark-gray">조건에 해당하는 공고가 없습니다.</p>
        <p className="mt-1 text-xs text-kt-light-gray">
          좌측 필터 패널에서 조건을 조정하거나 초기화 해보세요.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-kt-light-gray/40 bg-white overflow-hidden">
      <div className="max-h-[calc(100vh-340px)] min-h-[480px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white border-b border-kt-light-gray/40 z-10">
            <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-kt-dark-gray">
              <th className="px-2 py-2.5 w-[88px] whitespace-nowrap">태그</th>
              <th className="px-2 py-2.5 w-[78px] whitespace-nowrap text-center">D-day</th>
              <th className="px-2 py-2.5 min-w-[260px]">제목</th>
              <th className="px-2 py-2.5 w-[200px]">기관</th>
              <th className="px-2 py-2.5 w-[64px] whitespace-nowrap text-center">업종</th>
              <th className="px-2 py-2.5 w-[80px] whitespace-nowrap text-right">금액</th>
              <th className="px-2 py-2.5 w-[96px] whitespace-nowrap">마감일</th>
              <th className="px-2 py-2.5 w-[110px] whitespace-nowrap">출처</th>
              <th className="px-2 py-2.5 w-[200px]">영업대표</th>
              <th className="px-2 py-2.5 w-[40px]"></th>
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

function BidRow({ row }: { row: BidWithAssignees }) {
  const dday = dDayLabel(row.close_date);
  const fresh = isFreshOpen(row.open_date);
  const closing = isClosingSoon(row.close_date);
  const sido = extractSido(row.org_name);

  return (
    <tr className="border-b border-kt-light-gray/20 hover:bg-kt-light-gray/[0.04] transition-colors">
      {/* 태그 */}
      <td className="px-2 py-2 align-top">
        <div className="flex flex-wrap gap-1">
          {fresh && <Tag tone="purple">NEW</Tag>}
          {closing && <Tag tone="red">마감임박</Tag>}
        </div>
      </td>

      {/* D-day (nowrap, 가운데) */}
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

      {/* 기관 + 지역 작게 */}
      <td className="px-2 py-2 align-top">
        <div className="text-xs text-kt-dark-gray line-clamp-2">{row.org_name ?? "-"}</div>
        {sido !== "전국/기타" && (
          <div className="mt-0.5 text-[10px] text-kt-light-gray">{sido}</div>
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
      <td className="px-2 py-2 align-top text-xs text-kt-dark-gray num">
        {row.close_date ? row.close_date.slice(0, 10) : "-"}
      </td>

      {/* 출처 */}
      <td className="px-2 py-2 align-top text-[11px] text-kt-dark-gray">
        {SOURCE_LABELS[row.source] ?? row.source}
      </td>

      {/* 영업대표 */}
      <td className="px-2 py-2 align-top">
        <BidAssigneeCell bidId={row.id} assignees={row.assignees} />
      </td>

      {/* 외부 링크 */}
      <td className="px-2 py-2 align-top">
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
