import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Tailwind 클래스 충돌을 해결하면서 조건부 클래스를 결합한다.
 * shadcn/ui 표준 유틸.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 금액(원)을 한국어 천 단위 콤마 형식으로 변환한다.
 * 예: 1500000 → "1,500,000원"
 */
export function formatKRW(amount: number | null | undefined): string {
  if (amount == null) return "-";
  return `${amount.toLocaleString("ko-KR")}원`;
}

/**
 * 금액(원)을 압축 한국어 단위로 표기한다 — 대시보드/요약 용.
 * 예:
 *   500_000_000      → "5억"
 *   550_000_000      → "5.5억"
 *   5_500_000_000    → "55억"
 *   12_300_000_000   → "123억"
 *   80_000_000       → "8천만"
 *   1_500_000        → "150만"
 */
export function formatEokWon(amount: number | null | undefined): string {
  if (amount == null || amount === 0) return "0";

  const eok = amount / 100_000_000;

  if (eok >= 1) {
    if (eok >= 10) return `${Math.round(eok).toLocaleString("ko-KR")}억`;
    const rounded = Math.round(eok * 10) / 10;
    return rounded === Math.floor(rounded)
      ? `${Math.floor(rounded)}억`
      : `${rounded.toFixed(1)}억`;
  }

  const man = amount / 10_000;
  if (man >= 1000) return `${(man / 1000).toFixed(0)}천만`;
  if (man >= 1) return `${Math.round(man).toLocaleString("ko-KR")}만`;
  return `${amount.toLocaleString("ko-KR")}원`;
}

/**
 * 날짜를 한국어 yyyy년 m월 d일 형식으로 변환한다.
 */
export function formatDateKR(date: string | Date | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
}
