"use client";

import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";

const PAGE_SIZES = [50, 100, 200, 500];

export function BidPagination({
  total,
  pageSize,
  pageNum,
}: {
  total: number;
  pageSize: number;
  pageNum: number;
}) {
  const params = useSearchParams();
  const pathname = usePathname();

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, pageNum), totalPages);

  function buildHref(p: number, size?: number) {
    const sp = new URLSearchParams(params.toString());
    if (p <= 1) sp.delete("page");
    else sp.set("page", String(p));
    if (size && size !== 50) sp.set("size", String(size));
    else if (size === 50) sp.delete("size");
    const q = sp.toString();
    return q ? `${pathname}?${q}` : pathname;
  }

  // 페이지 번호 표시 — 현재 ±2 범위 + 처음/끝
  const pages = pageWindow(safePage, totalPages, 2);

  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* 결과 카운트 + 페이지당 셀렉터 */}
      <div className="flex items-center gap-3 text-xs text-kt-dark-gray">
        <span className="font-medium">
          결과 총 <span className="font-bold text-kt-black num">{total.toLocaleString("ko-KR")}</span>건
        </span>
        <span className="text-kt-light-gray num">
          {start.toLocaleString("ko-KR")} – {end.toLocaleString("ko-KR")}
        </span>
        <span className="flex items-center">
          페이지당
          <select
            value={pageSize}
            onChange={(e) => {
              window.location.href = buildHref(1, Number(e.target.value));
            }}
            className="ml-1 rounded border border-kt-light-gray/40 bg-white px-1.5 py-0.5 text-xs"
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </span>
      </div>

      {/* 페이지 네비 */}
      <div className="flex items-center gap-0.5">
        <NavBtn href={buildHref(1)} disabled={safePage <= 1} title="처음">
          <ChevronsLeft className="h-3.5 w-3.5" />
        </NavBtn>
        <NavBtn href={buildHref(safePage - 1)} disabled={safePage <= 1} title="이전">
          <ChevronLeft className="h-3.5 w-3.5" />
        </NavBtn>
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`e${i}`} className="px-1.5 text-kt-light-gray text-xs">…</span>
          ) : (
            <Link
              key={p}
              href={buildHref(p)}
              scroll={false}
              className={cn(
                "min-w-[28px] h-7 inline-flex items-center justify-center rounded text-xs font-medium px-2 num",
                p === safePage
                  ? "bg-kt-red text-white"
                  : "text-kt-dark-gray hover:bg-kt-light-gray/20",
              )}
            >
              {p}
            </Link>
          ),
        )}
        <NavBtn href={buildHref(safePage + 1)} disabled={safePage >= totalPages} title="다음">
          <ChevronRight className="h-3.5 w-3.5" />
        </NavBtn>
        <NavBtn href={buildHref(totalPages)} disabled={safePage >= totalPages} title="마지막">
          <ChevronsRight className="h-3.5 w-3.5" />
        </NavBtn>
      </div>
    </div>
  );
}

function NavBtn({
  href,
  disabled,
  title,
  children,
}: {
  href: string;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span
        className="h-7 w-7 inline-flex items-center justify-center rounded text-kt-light-gray/40 cursor-not-allowed"
        title={title}
      >
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      scroll={false}
      className="h-7 w-7 inline-flex items-center justify-center rounded text-kt-dark-gray hover:bg-kt-light-gray/20 hover:text-kt-black"
      title={title}
    >
      {children}
    </Link>
  );
}

/**
 * 페이지 윈도우 — 현재 ±delta + 처음/끝.
 * 예: current=5, total=20, delta=2 → [1, "…", 3,4,5,6,7, "…", 20]
 */
function pageWindow(current: number, total: number, delta: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const set = new Set<number>([1, total]);
  for (let i = current - delta; i <= current + delta; i++) {
    if (i >= 1 && i <= total) set.add(i);
  }
  const sorted = [...set].sort((a, b) => a - b);
  const result: (number | "…")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push("…");
    result.push(sorted[i]);
  }
  return result;
}
