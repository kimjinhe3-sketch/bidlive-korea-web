"use client";

import { useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * xlsx 다운로드 — server route /api/export-bids 호출.
 * 현재 URL 의 모든 필터 search params 그대로 전달.
 * 페이지네이션 (page/size) 은 빼고 전체 결과 다운.
 */
export function BidExportButton({ totalCount }: { totalCount: number }) {
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function exportXlsx() {
    if (totalCount === 0) return;
    startTransition(async () => {
      // page, size 는 export 와 무관 — 제거
      const sp = new URLSearchParams(params.toString());
      sp.delete("page");
      sp.delete("size");
      const url = `/api/export-bids?${sp.toString()}`;
      // navigation 으로 자동 다운로드
      window.location.href = url;
    });
  }

  return (
    <button
      type="button"
      onClick={exportXlsx}
      disabled={pending || totalCount === 0}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-kt-light-gray/40 bg-white px-3 py-1.5 text-xs font-bold text-kt-dark-gray transition-colors",
        "hover:border-kt-black hover:text-kt-black",
        "disabled:opacity-50 disabled:cursor-not-allowed",
      )}
      title={`전체 ${totalCount.toLocaleString("ko-KR")}건 엑셀 다운로드 (페이지네이션 무시)`}
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
      xlsx ({totalCount.toLocaleString("ko-KR")})
    </button>
  );
}
