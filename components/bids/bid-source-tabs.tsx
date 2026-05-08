"use client";

import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { SourceGroup } from "@/types/domain";

const TABS: { value: SourceGroup | "all"; label: string }[] = [
  { value: "all",       label: "전체" },
  { value: "나라장터",  label: "나라장터" },
  { value: "누리장터",  label: "누리장터" },
  { value: "기타",      label: "LH·KEPCO·기타" },
];

/**
 * 소스 그룹 segmented control (URL search param 으로 상태 관리).
 * Server-component 친화적 — 클릭 시 URL 변경, 페이지가 RSC 로 다시 그려짐.
 */
export function BidSourceTabs() {
  const params = useSearchParams();
  const pathname = usePathname();
  const current = params.get("group") ?? "all";

  function buildHref(value: string) {
    const sp = new URLSearchParams(params.toString());
    if (value === "all") sp.delete("group");
    else sp.set("group", value);
    const q = sp.toString();
    return q ? `${pathname}?${q}` : pathname;
  }

  return (
    <div className="inline-flex items-center rounded-md border border-kt-light-gray/40 bg-kt-light-gray/5 p-1 gap-0.5">
      {TABS.map((t) => {
        const active = current === t.value;
        return (
          <Link
            key={t.value}
            href={buildHref(t.value)}
            scroll={false}
            className={cn(
              "px-3.5 py-1.5 rounded text-xs font-bold transition-colors",
              active
                ? "bg-white text-kt-black shadow-sm border border-kt-light-gray/40"
                : "text-kt-dark-gray hover:text-kt-black hover:bg-white/60",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
