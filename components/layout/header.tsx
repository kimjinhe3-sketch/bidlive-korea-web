import Link from "next/link";
import { BrandLogo } from "./brand-logo";

/**
 * 글로벌 톱바 — 사이드바 제거 후 단일 네비게이션.
 *  - 높이 48px (h-12), KT BLACK 배경
 *  - 좌측: KT engineering CI 로고 + "공공입찰 수집 시스템" 부제
 *  - 우측: 마지막 수집 시각 (LIVE dot)
 *  - sticky top-0
 */
export function Header({
  lastCollectedAt,
}: {
  lastCollectedAt: string | null;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-white/10 bg-kt-black px-4 lg:px-6">
      <Link
        href="/bids"
        className="flex items-center gap-3 transition-opacity hover:opacity-80"
        title="공공입찰 수집 시스템 — 초기화면"
      >
        <BrandLogo variant="dark" size="sm" withSubtitle={false} />
        <span className="text-[11px] tracking-wide font-medium text-white/60 hidden sm:inline">
          공공입찰 수집 시스템
        </span>
      </Link>

      <div className="flex items-center gap-2">
        <LiveStatus lastCollectedAt={lastCollectedAt} />
      </div>
    </header>
  );
}

function LiveStatus({ lastCollectedAt }: { lastCollectedAt: string | null }) {
  const text = formatRelative(lastCollectedAt);
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1">
      <span className="relative inline-flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full rounded-full bg-kt-teal opacity-60 animate-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-kt-teal" />
      </span>
      <span className="text-[10px] font-bold tracking-widest uppercase text-white/50">
        Last collect
      </span>
      <span className="text-xs font-bold text-white num">{text}</span>
    </div>
  );
}

function formatRelative(iso: string | null): string {
  if (!iso) return "없음";
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return "없음";
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return "방금 전";
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  return `${day}일 전`;
}
