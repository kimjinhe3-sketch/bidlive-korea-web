import { ExternalLink } from "lucide-react";
import { cn, formatEokWon } from "@/lib/utils";
import type { BidAnnouncement } from "@/types/database";
import { dDayLabel } from "@/lib/queries/bids";
import { ddayTone, SOURCE_LABELS } from "@/types/domain";

/**
 * 입찰 공고 테이블.
 *
 * v1: 서버 렌더 단순 테이블 (TanStack Table 추후 도입).
 * 컬럼: 마감 D-day · 신규 · 제목 · 기관 · 금액 · 마감일 · 출처
 */
export function BidTable({ rows }: { rows: BidAnnouncement[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-kt-light-gray/40 bg-white py-16 text-center">
        <p className="text-sm text-kt-dark-gray">조건에 해당하는 공고가 없습니다.</p>
        <p className="mt-1 text-xs text-kt-light-gray">
          소스 탭이나 검색어를 바꿔보세요.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-kt-light-gray/40 bg-white overflow-hidden">
      <div className="max-h-[680px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white border-b border-kt-light-gray/40 z-10">
            <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-kt-dark-gray">
              <th className="px-3 py-3 w-[64px]">D-day</th>
              <th className="px-3 py-3 w-[44px]">신규</th>
              <th className="px-3 py-3">제목</th>
              <th className="px-3 py-3 hidden md:table-cell w-[180px]">기관</th>
              <th className="px-3 py-3 w-[80px] text-right">금액</th>
              <th className="px-3 py-3 hidden lg:table-cell w-[110px]">마감일</th>
              <th className="px-3 py-3 hidden lg:table-cell w-[110px]">출처</th>
              <th className="px-3 py-3 w-[44px]"></th>
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

function BidRow({ row }: { row: BidAnnouncement }) {
  const dday = dDayLabel(row.close_date);
  const newish = isCreatedToday(row.created_at);

  return (
    <tr className="border-b border-kt-light-gray/20 hover:bg-kt-light-gray/5 transition-colors">
      <td className="px-3 py-3 align-top">
        <DdayBadge label={dday} />
      </td>
      <td className="px-3 py-3 align-top">
        {newish && <NewBadge />}
      </td>
      <td className="px-3 py-3 align-top">
        <div className="text-sm text-kt-black font-medium leading-snug">
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
        {/* 모바일: 기관/마감/출처 인라인 메타 */}
        <div className="md:hidden mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-kt-light-gray">
          {row.org_name && <span>{row.org_name}</span>}
          {row.close_date && <span>· 마감 {row.close_date.slice(0, 10)}</span>}
        </div>
      </td>
      <td className="px-3 py-3 align-top hidden md:table-cell text-xs text-kt-dark-gray">
        {row.org_name ?? "-"}
      </td>
      <td className="px-3 py-3 align-top text-right">
        <div className="text-sm font-bold text-kt-black num">
          {row.estimated_price && row.estimated_price > 0
            ? formatEokWon(row.estimated_price)
            : "-"}
        </div>
      </td>
      <td className="px-3 py-3 align-top hidden lg:table-cell text-xs text-kt-dark-gray num">
        {row.close_date ? row.close_date.slice(0, 10) : "-"}
      </td>
      <td className="px-3 py-3 align-top hidden lg:table-cell text-[11px] text-kt-light-gray">
        {SOURCE_LABELS[row.source] ?? row.source}
      </td>
      <td className="px-3 py-3 align-top">
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

function DdayBadge({ label }: { label: string | null }) {
  const tone = ddayTone(label);
  if (!label || !tone) return <span className="text-kt-light-gray text-xs">-</span>;
  const cls =
    tone === "danger" ? "bg-kt-red/10 text-kt-red border-kt-red/20"
    : tone === "warn" ? "bg-amber-100 text-amber-800 border-amber-200"
    : tone === "track"? "bg-amber-50 text-amber-700 border-amber-100"
    : "bg-kt-light-gray/15 text-kt-dark-gray border-kt-light-gray/30";
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md border px-1.5 py-0.5 text-[11px] font-bold num",
        cls,
      )}
    >
      {label}
    </span>
  );
}

function NewBadge() {
  return (
    <span className="inline-flex items-center justify-center rounded-md border border-kt-purple/20 bg-kt-purple/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-kt-purple">
      NEW
    </span>
  );
}

function isCreatedToday(createdAt: string): boolean {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  return new Date(createdAt).getTime() >= todayStart.getTime();
}
