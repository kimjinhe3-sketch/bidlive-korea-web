"use client";

import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SOURCE_GROUP_ORDER } from "@/types/domain";

const TABS: { value: string; label: string }[] = [
  { value: "all", label: "전체" },
  ...SOURCE_GROUP_ORDER.map((g) => ({ value: g, label: g })),
];

/**
 * 소스 그룹 segmented control (URL 기반).
 * group 파라미터: "" (전체) | "나라장터" | "LH" | "KEPCO" | "기타"
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
    <div className="inline-flex items-center rounded-md border border-kt-light-gray/40 bg-kt-light-gray/[0.06] p-1 gap-0.5">
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
