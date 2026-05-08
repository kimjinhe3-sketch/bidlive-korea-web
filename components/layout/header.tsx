/**
 * 상단 헤더 (DESIGN_SYSTEM 5-2).
 *  - 높이 64px
 *  - 배경 white, 하단 1px 보더
 *  - 모바일에선 좌측 워드마크 노출 (사이드바 hidden)
 *  - public 모드라 우측 사용자 정보 없음
 */
export function Header({
  lastCollectedAt,
}: {
  lastCollectedAt: string | null;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-kt-light-gray/40 bg-white px-4 lg:px-6">
      <div className="flex items-center gap-3 lg:hidden">
        <span className="text-base font-bold text-kt-black">
          kt <span className="text-kt-red">engineering</span>
        </span>
        <span className="text-[11px] tracking-wide font-medium text-kt-light-gray">
          BIDLIVE
        </span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <LiveStatus lastCollectedAt={lastCollectedAt} />
      </div>
    </header>
  );
}

function LiveStatus({ lastCollectedAt }: { lastCollectedAt: string | null }) {
  const text = formatRelative(lastCollectedAt);
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-kt-light-gray/40 bg-white px-3 py-1.5">
      <span className="relative inline-flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full rounded-full bg-kt-teal opacity-60 animate-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-kt-teal" />
      </span>
      <span className="text-[11px] font-bold tracking-widest uppercase text-kt-light-gray">
        Last collect
      </span>
      <span className="text-xs font-bold text-kt-black num">{text}</span>
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
