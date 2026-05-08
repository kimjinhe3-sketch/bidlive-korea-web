"use client";

import {
  useState,
  useRef,
  useEffect,
  useTransition,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Search,
  X,
  RotateCcw,
  ChevronDown,
  Filter as FilterIcon,
  Briefcase,
  MapPin,
  Activity,
  AlarmClock,
  Banknote,
  CalendarDays,
  Tags,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BID_TYPES, SIDO_LIST } from "@/types/domain";

/**
 * 상단 필터 툴바 — Linear/Stripe 식.
 * 검색은 항상 노출, 나머지 필터는 popover 버튼으로.
 *
 * 모든 상태는 URL searchParams 로 관리 (RSC 자동 재렌더).
 */
export function BidFilterToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

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
        if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) sp.delete(k);
        else if (Array.isArray(v)) sp.set(k, v.join(","));
        else if (typeof v === "boolean") {
          if (v) sp.set(k, "1");
          else sp.delete(k);
        } else sp.set(k, v);
      }
      const q = sp.toString();
      startTransition(() =>
        router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false }),
      );
    },
    [params, pathname, router],
  );

  const reset = () => router.replace(pathname);

  // 현재 값
  const types = getList("types");
  const regions = getList("regions");
  const orgKw = get("org");
  const activeOnly = getBool("active", true);
  const dday = get("dday");
  const amin = get("amin");
  const amax = get("amax");
  const aopen = getBool("aopen", false);
  const dateFrom = get("from");
  const dateTo = get("to");
  const inc = get("inc");
  const exc = get("exc");

  // 필터 적용 개수
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
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg border border-kt-light-gray/40 bg-white px-3 py-2",
        pending && "opacity-70",
      )}
    >
      {/* 검색 — 항상 노출 */}
      <div className="relative w-[260px] shrink-0">
        <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-kt-light-gray" />
        <input
          type="text"
          value={get("q")}
          onChange={(e) => setMany({ q: e.target.value })}
          placeholder="제목 검색 (예: 전기공사)"
          className="w-full rounded-md border border-kt-light-gray/40 bg-white pl-7 pr-7 py-1.5 text-sm placeholder:text-kt-light-gray focus:border-kt-red focus:outline-none focus:ring-2 focus:ring-kt-red/15"
        />
        {get("q") && (
          <button
            onClick={() => setMany({ q: null })}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-kt-light-gray hover:bg-kt-light-gray/15 hover:text-kt-black"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* 업종 */}
      <FilterChip
        icon={Briefcase}
        label="업종"
        valueText={types.length > 0 ? types.join(", ") : null}
        badge={types.length}
      >
        <ChipMulti
          options={[...BID_TYPES]}
          value={types}
          onChange={(v) => setMany({ types: v })}
        />
      </FilterChip>

      {/* 지역 */}
      <FilterChip
        icon={MapPin}
        label="지역"
        valueText={regions.length > 0 ? `${regions.length}개` : null}
        badge={regions.length}
      >
        <ChipMulti
          options={[...SIDO_LIST, "전국/기타"]}
          value={regions}
          onChange={(v) => setMany({ regions: v })}
          grid
        />
      </FilterChip>

      {/* 기관 */}
      <FilterChip
        icon={Tags}
        label="기관"
        valueText={orgKw || null}
        badge={orgKw ? 1 : 0}
      >
        <input
          type="text"
          autoFocus
          value={orgKw}
          onChange={(e) => setMany({ org: e.target.value })}
          placeholder="예: 교육청"
          className="w-full rounded border border-kt-light-gray/40 bg-white px-2 py-1.5 text-sm focus:border-kt-red focus:outline-none focus:ring-2 focus:ring-kt-red/15"
        />
      </FilterChip>

      {/* 상태 (진행중) */}
      <FilterChip
        icon={Activity}
        label="상태"
        valueText={activeOnly ? null : "마감 포함"}
        badge={activeOnly ? 0 : 1}
      >
        <Toggle
          label="진행중인 공고만 (마감 안 지난)"
          checked={activeOnly}
          onChange={(v) => setMany({ active: v ? null : "0" })}
        />
      </FilterChip>

      {/* D-day */}
      <FilterChip
        icon={AlarmClock}
        label="D-day"
        valueText={dday ? `D-${dday} 이내` : null}
        badge={dday ? 1 : 0}
      >
        <DdayChips value={dday} onChange={(v) => setMany({ dday: v })} />
      </FilterChip>

      {/* 금액 */}
      <FilterChip
        icon={Banknote}
        label="금액"
        valueText={
          amin || amax || aopen
            ? `${amin || 0}~${aopen ? "∞" : amax || "100"}억`
            : null
        }
        badge={amin || amax || aopen ? 1 : 0}
      >
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <NumInput placeholder="최소" value={amin} onChange={(v) => setMany({ amin: v })} />
            <NumInput placeholder="최대" value={amax} onChange={(v) => setMany({ amax: v })} />
          </div>
          <Toggle
            label="100억 이상도 포함"
            checked={aopen}
            onChange={(v) => setMany({ aopen: v })}
          />
        </div>
      </FilterChip>

      {/* 공고일 */}
      <FilterChip
        icon={CalendarDays}
        label="공고일"
        valueText={
          dateFrom || dateTo ? `${dateFrom || "~"}  ~  ${dateTo || "~"}` : null
        }
        badge={dateFrom || dateTo ? 1 : 0}
      >
        <div className="grid grid-cols-2 gap-2">
          <DateInput value={dateFrom} onChange={(v) => setMany({ from: v })} />
          <DateInput value={dateTo} onChange={(v) => setMany({ to: v })} />
        </div>
      </FilterChip>

      {/* 키워드 (포함/제외) */}
      <FilterChip
        icon={FilterIcon}
        label="키워드"
        valueText={inc || exc ? `${inc ? "+" : ""}${exc ? " -" : ""}` : null}
        badge={(inc ? 1 : 0) + (exc ? 1 : 0)}
        wide
      >
        <div className="space-y-2">
          <KwTextarea
            placeholder="포함 (콤마)  예: 정보통신, 전기, 통신"
            tone="include"
            value={inc}
            onChange={(v) => setMany({ inc: v })}
          />
          <KwTextarea
            placeholder="제외 (콤마)  예: 청소, 식자재"
            tone="exclude"
            value={exc}
            onChange={(v) => setMany({ exc: v })}
          />
        </div>
      </FilterChip>

      <div className="grow" />

      {/* 초기화 */}
      <button
        onClick={reset}
        disabled={activeCount === 0}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
          activeCount > 0
            ? "text-kt-red hover:bg-kt-red/5"
            : "text-kt-light-gray cursor-default",
        )}
        title="모든 필터 초기화"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        초기화 {activeCount > 0 && `(${activeCount})`}
      </button>
    </div>
  );
}

// ──────────────────── primitives ────────────────────

function FilterChip({
  icon: Icon,
  label,
  valueText,
  badge,
  wide,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  valueText: string | null;
  badge?: number;
  wide?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = (badge ?? 0) > 0;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-bold transition-colors",
          active
            ? "border-kt-red/40 bg-kt-red/5 text-kt-red"
            : "border-kt-light-gray/40 bg-white text-kt-dark-gray hover:border-kt-black hover:text-kt-black",
          open && "ring-2 ring-kt-red/15",
        )}
      >
        <Icon className="h-3.5 w-3.5" />
        {label}
        {valueText && (
          <span
            className={cn(
              "ml-0.5 max-w-[140px] truncate text-[11px] font-medium",
              active ? "text-kt-red/80" : "text-kt-light-gray",
            )}
          >
            {valueText}
          </span>
        )}
        {!!badge && badge > 0 && (
          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-kt-red px-1 text-[10px] font-bold text-white">
            {badge}
          </span>
        )}
        <ChevronDown
          className={cn(
            "h-3 w-3 text-kt-light-gray transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div
          className={cn(
            "absolute top-full left-0 mt-1.5 z-30 rounded-lg border border-kt-light-gray/40 bg-white p-3 shadow-lg",
            wide ? "w-[360px]" : "w-[280px]",
          )}
        >
          {children}
        </div>
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
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
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

function DdayChips({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
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

function DateInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded border border-kt-light-gray/40 bg-white px-2 py-1.5 text-xs text-kt-dark-gray focus:border-kt-red focus:outline-none focus:ring-2 focus:ring-kt-red/15"
    />
  );
}

function KwTextarea({
  value,
  onChange,
  placeholder,
  tone,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  tone: "include" | "exclude";
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
      )}
    />
  );
}
