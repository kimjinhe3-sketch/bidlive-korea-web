"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "./brand-logo";
import { SIDEBAR_ITEMS } from "./nav-items";
import { cn } from "@/lib/utils";

function isActivePath(pathname: string, href: string) {
  if (href === "/bids") return pathname === "/bids";
  return pathname.startsWith(href);
}

/**
 * 데스크톱 사이드바 (DESIGN_SYSTEM 5-1).
 *  - 너비 240px (w-60)
 *  - 배경 KT BLACK
 *  - active: 좌측 4px KT RED 인디케이터 + white/15 배경
 *  - 다크 변형 CI 로고
 */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex w-60 shrink-0 flex-col bg-kt-black text-white">
      <div className="flex h-16 items-center px-5 border-b border-white/10">
        <BrandLogo variant="dark" size="sm" withSubtitle={false} />
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {SIDEBAR_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                active
                  ? "bg-white/10 text-white"
                  : "text-white/70 hover:bg-white/5 hover:text-white",
              )}
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r bg-kt-red"
                />
              )}
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3 text-[11px] text-white/50">
        v0.1.0 · BIDLIVE Korea
      </div>
    </aside>
  );
}
