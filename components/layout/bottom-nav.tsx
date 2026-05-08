"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BOTTOM_NAV_ITEMS } from "./nav-items";
import { cn } from "@/lib/utils";

/**
 * 모바일 Bottom Navigation (DESIGN_SYSTEM 5-3).
 *  - 높이 64px, 균등 배분
 *  - active: KT RED 텍스트/아이콘 + 상단 2px 인디케이터
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden sticky bottom-0 z-30 flex h-16 border-t border-kt-light-gray/40 bg-white">
      {BOTTOM_NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active =
          item.href === "/bids"
            ? pathname === "/bids"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold transition-colors",
              active ? "text-kt-red" : "text-kt-dark-gray hover:text-kt-black",
            )}
          >
            {active && (
              <span
                aria-hidden
                className="absolute top-0 left-4 right-4 h-0.5 bg-kt-red rounded-b"
              />
            )}
            <Icon className="h-5 w-5" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
