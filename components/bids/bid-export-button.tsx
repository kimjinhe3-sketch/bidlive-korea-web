"use client";

import { useTransition } from "react";
import { Download, Loader2 } from "lucide-react";
import { cn, formatEokWon } from "@/lib/utils";
import type { BidWithAssignees } from "@/lib/queries/bids";
import { dDayLabel, extractSido, SOURCE_LABELS } from "@/types/domain";

/**
 * xlsx 다운로드 — 현재 필터된 결과를 엑셀로 저장.
 * Streamlit 의 df_to_excel_bytes 와 동일 컬럼 + 영업대표 추가.
 */
export function BidExportButton({ rows }: { rows: BidWithAssignees[] }) {
  const [pending, startTransition] = useTransition();

  function exportXlsx() {
    if (rows.length === 0) return;
    startTransition(async () => {
      const XLSX = await import("xlsx");
      const data = rows.map((r) => ({
        "공고번호": r.bid_no,
        "제목": r.title,
        "기관": r.org_name ?? "",
        "지역": extractSido(r.org_name, r.region, r.title),
        "지역(원본)": r.region ?? "",
        "업종": r.bid_type ?? "",
        "금액(원)": r.estimated_price ?? "",
        "금액(요약)": r.estimated_price ? formatEokWon(r.estimated_price) : "",
        "공고일": r.open_date ?? "",
        "마감일": r.close_date ?? "",
        "D-day": dDayLabel(r.close_date) ?? "",
        "출처": SOURCE_LABELS[r.source] ?? r.source,
        "영업대표": r.assignees.map((a) => a.rep_name).join(", "),
        "URL": r.detail_url ?? "",
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "입찰공고");
      const today = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `bidlive_${today}.xlsx`);
    });
  }

  return (
    <button
      type="button"
      onClick={exportXlsx}
      disabled={pending || rows.length === 0}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-kt-light-gray/40 bg-white px-3 py-1.5 text-xs font-bold text-kt-dark-gray transition-colors",
        "hover:border-kt-black hover:text-kt-black",
        "disabled:opacity-50 disabled:cursor-not-allowed",
      )}
      title="현재 필터된 결과를 엑셀 파일로 저장"
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
      xlsx
    </button>
  );
}
