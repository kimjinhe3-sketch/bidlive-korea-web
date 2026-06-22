"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { Mail, Loader2, CheckCircle2, XCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SIDO_LIST } from "@/types/domain";

/**
 * 메일 알림 등록 버튼 — 클릭 시 popover 폼.
 *  - 이메일 + 알림 종류 3개 (신규/마감임박/키워드매칭)
 *  - 키워드매칭 선택 시 키워드·지역·금액 조건 입력
 *  - POST /api/subscribe → bid_subscribers (preferences JSONB) 저장
 */
type AlertKind = "new" | "closing" | "keyword";

export function BidSubscribeButton() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [kinds, setKinds] = useState<Set<AlertKind>>(new Set(["new"]));
  const [keywords, setKeywords] = useState("");
  const [regions, setRegions] = useState<Set<string>>(new Set());
  const [amountMin, setAmountMin] = useState("");

  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "ok"; email: string }
    | { kind: "err"; text: string }
  >({ kind: "idle" });

  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function toggleKind(k: AlertKind) {
    setKinds((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  function toggleRegion(r: string) {
    setRegions((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });
  }

  function submit() {
    const v = email.trim();
    if (!v || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      setState({ kind: "err", text: "올바른 이메일 형식이 아닙니다" });
      return;
    }
    if (kinds.size === 0) {
      setState({ kind: "err", text: "받을 알림을 하나 이상 선택하세요" });
      return;
    }
    const preferences = {
      alerts: [...kinds],
      keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
      regions: [...regions],
      amountMinEok: amountMin ? Number(amountMin) : null,
    };

    setState({ kind: "idle" });
    startTransition(async () => {
      try {
        const r = await fetch("/api/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: v, preferences }),
        });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.ok) {
          setState({ kind: "ok", email: v });
          setTimeout(() => {
            setOpen(false);
            setState({ kind: "idle" });
          }, 2800);
        } else {
          setState({ kind: "err", text: j.error || `실패: ${r.status}` });
        }
      } catch (e) {
        setState({ kind: "err", text: e instanceof Error ? e.message : "네트워크 오류" });
      }
    });
  }

  const wantKeyword = kinds.has("keyword");

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border border-kt-light-gray/40 bg-white px-3 py-1.5 text-xs font-bold text-kt-dark-gray transition-colors",
          "hover:border-kt-black hover:text-kt-black",
          open && "border-kt-black text-kt-black ring-2 ring-kt-red/15",
        )}
        title="새 공고 메일 알림 등록"
      >
        <Mail className="h-3.5 w-3.5" />
        알림 받기
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-30 w-[360px] rounded-lg border border-kt-light-gray/40 bg-white p-3.5 shadow-lg">
          <div className="flex items-start justify-between gap-2 mb-2.5">
            <div>
              <div className="text-sm font-bold text-kt-black flex items-center gap-1.5">
                <Mail className="h-4 w-4 text-kt-red" />
                입찰공고 메일 알림
              </div>
              <div className="text-[11px] text-kt-light-gray mt-0.5">
                원하는 알림을 선택해 이메일로 받아보세요
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-kt-light-gray hover:text-kt-black"
              aria-label="닫기"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {state.kind === "ok" ? (
            <div className="rounded-md border border-kt-teal/30 bg-kt-teal/5 px-3 py-3 text-xs flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-kt-teal mt-0.5 shrink-0" />
              <div>
                <div className="font-bold text-kt-teal">등록 완료</div>
                <div className="text-kt-dark-gray mt-1">
                  <span className="font-medium">{state.email}</span> 으로 발송됩니다.
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* 이메일 */}
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (state.kind === "err") setState({ kind: "idle" });
                }}
                placeholder="이메일 주소"
                autoFocus
                disabled={pending}
                className="w-full rounded-md border border-kt-light-gray/40 bg-white px-2.5 py-1.5 text-sm placeholder:text-kt-light-gray focus:border-kt-red focus:outline-none focus:ring-2 focus:ring-kt-red/15"
              />

              {/* 알림 종류 */}
              <div className="space-y-1.5">
                <AlertOption
                  checked={kinds.has("new")}
                  onChange={() => toggleKind("new")}
                  title="신규 공고"
                  desc="매일 새로 등록된 공고 (07/12/18시)"
                />
                <AlertOption
                  checked={kinds.has("closing")}
                  onChange={() => toggleKind("closing")}
                  title="마감 임박"
                  desc="D-3 이내 마감 공고 (매일 09시)"
                />
                <AlertOption
                  checked={kinds.has("keyword")}
                  onChange={() => toggleKind("keyword")}
                  title="키워드·조건 매칭"
                  desc="아래 조건에 맞는 공고만"
                />
              </div>

              {/* 키워드 매칭 조건 (조건부) */}
              {wantKeyword && (
                <div className="rounded-md border border-kt-light-gray/30 bg-kt-light-gray/[0.04] p-2.5 space-y-2">
                  <div>
                    <label className="text-[11px] font-bold text-kt-dark-gray">키워드 (콤마 구분)</label>
                    <input
                      type="text"
                      value={keywords}
                      onChange={(e) => setKeywords(e.target.value)}
                      placeholder="예: 정보통신, 전기, 통신"
                      className="mt-1 w-full rounded border border-kt-light-gray/40 bg-white px-2 py-1 text-xs focus:border-kt-red focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-kt-dark-gray">지역 (선택 안 하면 전체)</label>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {SIDO_LIST.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => toggleRegion(s)}
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors",
                            regions.has(s)
                              ? "bg-kt-blue/10 text-kt-blue border-kt-blue/30"
                              : "bg-white text-kt-dark-gray border-kt-light-gray/40 hover:border-kt-black",
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-kt-dark-gray">최소 금액 (억)</label>
                    <input
                      type="number"
                      value={amountMin}
                      onChange={(e) => setAmountMin(e.target.value)}
                      placeholder="예: 1 (1억 이상)"
                      min={0}
                      className="mt-1 w-full rounded border border-kt-light-gray/40 bg-white px-2 py-1 text-xs focus:border-kt-red focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {state.kind === "err" && (
                <div className="flex items-center gap-1 text-[11px] text-kt-red">
                  <XCircle className="h-3 w-3" />
                  {state.text}
                </div>
              )}

              <button
                type="button"
                onClick={submit}
                disabled={pending || !email.trim()}
                className={cn(
                  "w-full inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-bold transition-colors",
                  "bg-kt-red text-white hover:bg-kt-red-600",
                  "disabled:opacity-60 disabled:cursor-not-allowed",
                )}
              >
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                {pending ? "등록 중…" : "알림 등록"}
              </button>

              <div className="text-[10px] text-kt-light-gray leading-relaxed">
                언제든 해지 가능 (메일 하단 링크)
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AlertOption({
  checked,
  onChange,
  title,
  desc,
}: {
  checked: boolean;
  onChange: () => void;
  title: string;
  desc: string;
}) {
  return (
    <label
      className={cn(
        "flex items-start gap-2 rounded-md border px-2.5 py-2 cursor-pointer transition-colors",
        checked
          ? "border-kt-red/40 bg-kt-red/[0.04]"
          : "border-kt-light-gray/40 hover:border-kt-dark-gray",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="mt-0.5 h-3.5 w-3.5 rounded border-kt-light-gray text-kt-red focus:ring-kt-red"
      />
      <div>
        <div className="text-xs font-bold text-kt-black">{title}</div>
        <div className="text-[10px] text-kt-light-gray">{desc}</div>
      </div>
    </label>
  );
}
