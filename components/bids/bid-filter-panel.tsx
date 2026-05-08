"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition, useMemo, useCallback } from "react";
import { Search, X, RotateCcw, Filter as FilterIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { BID_TYPES, SIDO_LIST } from "@/types/domain";
import { Button } from "@/components/ui/button";

/**
 * 메인 영역 좌측 필터 패널 (white card).
 * 모든 상태는 URL searchParams 로 관리 → RSC 가 자동 재렌더.
 *
 * 지원 필터:
 *   q          — 제목 검색
 *   org        — 기관명 검색
 *   types      — 업종 (콤마)
 *   regions    — 지역 시·도 (콤마)
 *   active     — 진행중만 (1/0)
 *   dday       — 마감 임박 (N일 이내, 1~14)
 *   amin/amax  — 금액 범위 (억)
 *   aopen      — 100억 이상 포함 (1/0)
 *   from/to    — 공고일 범위 (yyyy-mm-dd)
 *   inc/exc    — 키워드 포함/제외 (콤마)
 */
export function BidFilterPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  // 현재 값 헬퍼
  const get = useCallback((k: string) => params.get(k) ?? "", [params]);
  const getList = useCallback(
    (k: string) => params.get(k)?.split(",").filter(Boolean) ?? [],
    [params],
  );
  const getBool = useCallback(
    (k: string, def: boolean) => {
      const v = params.get(k);
      if (v == null) return def;
      return v === "1";
    },
    [params],
  );

  const setMany = useCallback(
    (changes: Record<string, string | string[] | boolean | null | undefined>) => {
      const sp = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(changes)) {
        if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) {
          sp.delete(k);
        } else if (Array.isArray(v)) {
          sp.set(k, v.join(","));
        } else if (typeof v === "boolean") {
          if (v) sp.set(k, "1");
          else sp.delete(k);
        } else {
          sp.set(k, v);
        }
      }
      const q = sp.toString();
      startTransition(() => router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false }));
    },
    [params, pathname, router],
  );

  const reset = () => router.replace(pathname);

  const activeOnly = getBool("active", true);
  const amountUnbounded = getBool("aopen", false);
  const types = getList("types");
  const regions = getList("regions");

  // 필터 적용 개수 (reset 버튼 옆 표시)
  const activeCount = useMemo(() => {
    let n = 0;
    for (const k of ["q", "org", "types", "regions", "dday", "amin", "amax", "from", "to", "inc", "exc"]) {
      if (params.get(k)) n++;
    }
    if (params.get("active") === "0") n++;
    if (params.get("aopen") === "1") n++;
    return n;
  }, [params]);

  return (
    <aside className="w-[280px] shrink-0 self-start rounded-lg border border-kt-light-gray/40 bg-white">
      <div className="flex items-center justify-between border-b border-kt-light-gray/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <FilterIcon className="h-3.5 w-3.5 text-kt-red" />
          <h2 className="text-xs font-bold tracking-wide uppercase text-kt-black">
            Filters
          </h2>
          {activeCount > 0 && (
            <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-kt-red px-1.5 text-[10px] font-bold text-white">
              {activeCount}
            </span>
          )}
        </div>
        <button
          onClick={reset}
          disabled={activeCount === 0}
          className={cn(
            "inline-flex items-center gap-1 rounded text-[11px] font-medium",
            activeCount > 0 ? "text-kt-dark-gray hover:text-kt-red" : "text-kt-light-gray cursor-default",
          )}
          title="모든 필터 초기화"
        >
          <RotateCcw className="h-3 w-3" />
          초기화
        </button>
      </div>

      <div className={cn("space-y-4 px-4 py-4", pending && "opacity-60")}>
        {/* 검색 */}
        <Section label="제목 검색">
          <SearchInput
            placeholder="예: 전기공사"
            value={get("q")}
            onChange={(v) => setMany({ q: v })}
          />
        </Section>

        <Section label="기관명">
          <SearchInput
            placeholder="예: 교육청"
            value={get("org")}
            onChange={(v) => setMany({ org: v })}
          />
        </Section>

        {/* 업종 칩 */}
        <Section label="업종">
          <ChipMulti
            options={[...BID_TYPES]}
            value={types}
            onChange={(v) => setMany({ types: v })}
          />
        </Section>

        {/* 지역 칩 */}
        <Section label="참여 지역 (시·도)">
          <ChipMulti
            options={[...SIDO_LIST, "전국/기타"]}
            value={regions}
            onChange={(v) => setMany({ regions: v })}
            grid
          />
        </Section>

        {/* 진행중 토글 */}
        <Section label="상태">
          <Toggle
            label="진행중인 공고만 (마감 안 지난)"
            checked={activeOnly}
            onChange={(v) => setMany({ active: v ? null : "0" })}
          />
        </Section>

        {/* D-n 임계 */}
        <Section label="마감 임박 (D-n 이내)">
          <DdaySelect
            value={get("dday")}
            onChange={(v) => setMany({ dday: v })}
          />
        </Section>

        {/* 금액 */}
        <Section label="금액 범위 (억원)">
          <div className="grid grid-cols-2 gap-2">
            <NumInput
              placeholder="최소"
              value={get("amin")}
              onChange={(v) => setMany({ amin: v })}
            />
            <NumInput
              placeholder="최대"
              value={get("amax")}
              onChange={(v) => setMany({ amax: v })}
            />
          </div>
          <Toggle
            className="mt-2"
            label="100억 이상도 포함"
            checked={amountUnbounded}
            onChange={(v) => setMany({ aopen: v })}
          />
        </Section>

        {/* 공고일 */}
        <Section label="공고일 범위">
          <div className="grid grid-cols-2 gap-2">
            <DateInput value={get("from")} onChange={(v) => setMany({ from: v })} />
            <DateInput value={get("to")} onChange={(v) => setMany({ to: v })} />
          </div>
        </Section>

        {/* 키워드 포함/제외 */}
        <Section label="제목 키워드">
          <KeywordTextarea
            placeholder="포함 (콤마)  예: 정보통신, 통신, 전기"
            value={get("inc")}
            onChange={(v) => setMany({ inc: v })}
            tone="include"
          />
          <KeywordTextarea
            className="mt-2"
            placeholder="제외 (콤마)  예: 청소, 식자재"
            value={get("exc")}
            onChange={(v) => setMany({ exc: v })}
            tone="exclude"
          />
        </Section>
      </div>
    </aside>
  );
}

// ──────────────────── 작은 빌딩블록 ────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-bold tracking-wider uppercase text-kt-dark-gray">
        {label}
      </div>
      {children}
    </div>
  );
}

function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-kt-light-gray" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded border border-kt-light-gray/40 bg-white pl-7 pr-7 py-1.5 text-sm placeholder:text-kt-light-gray focus:border-kt-red focus:outline-none focus:ring-2 focus:ring-kt-red/15"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-kt-light-gray hover:bg-kt-light-gray/15 hover:text-kt-black"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function ChipMulti({
  options,
  value,
  onChange,
  grid,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  grid?: boolean;
}) {
  const set = new Set(value);
  return (
    <div className={cn("flex flex-wrap gap-1.5", grid && "grid grid-cols-3 gap-1.5")}>
      {options.map((o) => {
        const on = set.has(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => {
              const next = on ? value.filter((v) => v !== o) : [...value, o];
              onChange(next);
            }}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
              on
                ? "bg-kt-blue/10 text-kt-blue border-kt-blue/30"
                : "bg-white text-kt-dark-gray border-kt-light-gray/40 hover:border-kt-black hover:text-kt-black",
            )}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  className,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  className?: string;
}) {
  return (
    <label className={cn("flex items-center gap-2 cursor-pointer select-none", className)}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 rounded border-kt-light-gray text-kt-red focus:ring-kt-red"
      />
      <span className="text-xs text-kt-dark-gray">{label}</span>
    </label>
  );
}

function DdaySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const opts = ["", "1", "2", "3", "5", "7", "14"];
  return (
    <div className="flex flex-wrap gap-1.5">
      {opts.map((o) => {
        const on = value === o;
        const label = o === "" ? "끔" : `D-${o} 이내`;
        return (
          <button
            key={o || "off"}
            type="button"
            onClick={() => onChange(o)}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
              on
                ? "bg-kt-red/10 text-kt-red border-kt-red/30"
                : "bg-white text-kt-dark-gray border-kt-light-gray/40 hover:border-kt-black hover:text-kt-black",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function NumInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      min={0}
      className="w-full rounded border border-kt-light-gray/40 bg-white px-2 py-1.5 text-sm placeholder:text-kt-light-gray focus:border-kt-red focus:outline-none focus:ring-2 focus:ring-kt-red/15"
    />
  );
}

function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded border border-kt-light-gray/40 bg-white px-2 py-1.5 text-xs text-kt-dark-gray focus:border-kt-red focus:outline-none focus:ring-2 focus:ring-kt-red/15"
    />
  );
}

function KeywordTextarea({
  value,
  onChange,
  placeholder,
  tone,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  tone: "include" | "exclude";
  className?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={2}
      className={cn(
        "w-full rounded border bg-white px-2 py-1.5 text-xs placeholder:text-kt-light-gray focus:outline-none focus:ring-2 resize-none",
        tone === "include"
          ? "border-kt-blue/20 focus:border-kt-blue focus:ring-kt-blue/15"
          : "border-kt-light-gray/40 focus:border-kt-dark-gray focus:ring-kt-light-gray/30",
        className,
      )}
    />
  );
}
