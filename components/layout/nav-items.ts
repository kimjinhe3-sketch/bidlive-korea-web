import { LayoutDashboard, type LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

/** 데스크톱 사이드바 — v1 단일 페이지 */
export const SIDEBAR_ITEMS: NavItem[] = [
  { label: "입찰공고 현황", href: "/bids", icon: LayoutDashboard },
];

/** 모바일 Bottom Nav */
export const BOTTOM_NAV_ITEMS: NavItem[] = SIDEBAR_ITEMS;
