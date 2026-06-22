"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { Mail, Loader2, CheckCircle2, XCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 메일 알림 등록 버튼 — 클릭 시 popover 폼.
 *  - 이메일 주소만 입력 (간단)
 *  - POST /api/subscribe → DB 저장
 *  - 발송 형태/주기는 별도 사양 (등록 자체만)
 */
export function BidSubscribeButton() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "ok"; email: string }
    | { kind: "err"; text: string }
  >({ kind: "idle" });

  const ref = useRef<HTMLDivElement>(null);

  // 바깥 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function submit() {
    const v = email.trim();
    if (!v || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      setState({ kind: "err", text: "올바른 이메일 형식이 아닙니다" });
      return;
    }
    setState({ kind: "idle" });
    startTransition(async () => {
      try {
        const r = await fetch("/api/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: v }),
        });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.ok) {
          setState({ kind: "ok", email: v });
          setEmail("");
          setTimeout(() => {
            setOpen(false);
            setState({ kind: "idle" });
          }, 2500);
        } else {
          setState({ kind: "err", text: j.error || `실패: ${r.status}` });
        }
      } catch (e) {
        setState({ kind: "err", text: e instanceof Error ? e.message : "네트워크 오류" });
      }
    });
  }

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
        <div className="absolute right-0 top-full mt-1.5 z-30 w-[320px] rounded-lg border border-kt-light-gray/40 bg-white p-3 shadow-lg">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <div className="text-xs font-bold text-kt-black flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-kt-red" />
                새 공고 메일 알림
              </div>
              <div className="text-[11px] text-kt-light-gray mt-0.5">
                매일 신규 입찰공고를 이메일로 받아보세요
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-kt-light-gray hover:text-kt-black"
              aria-label="닫기"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {state.kind === "ok" ? (
            <div className="rounded-md border border-kt-teal/30 bg-kt-teal/5 px-3 py-2 text-[11px] flex items-start gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-kt-teal mt-0.5 shrink-0" />
              <div>
                <div className="font-bold text-kt-teal">등록 완료</div>
                <div className="text-kt-dark-gray mt-0.5">
                  <span className="font-medium">{state.email}</span> 으로 매일 발송됩니다.
                </div>
              </div>
            </div>
          ) : (
            <>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (state.kind === "err") setState({ kind: "idle" });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !pending) submit();
                }}
                placeholder="your.email@company.com"
                autoFocus
                disabled={pending}
                className="w-full rounded-md border border-kt-light-gray/40 bg-white px-2.5 py-1.5 text-sm placeholder:text-kt-light-gray focus:border-kt-red focus:outline-none focus:ring-2 focus:ring-kt-red/15"
              />

              {state.kind === "err" && (
                <div className="mt-1.5 flex items-center gap-1 text-[11px] text-kt-red">
                  <XCircle className="h-3 w-3" />
                  {state.text}
                </div>
              )}

              <button
                type="button"
                onClick={submit}
                disabled={pending || !email.trim()}
                className={cn(
                  "mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-colors",
                  "bg-kt-red text-white hover:bg-kt-red-600",
                  "disabled:opacity-60 disabled:cursor-not-allowed",
                )}
              >
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                {pending ? "등록 중…" : "등록"}
              </button>

              <div className="mt-2 text-[10px] text-kt-light-gray leading-relaxed">
                · 매일 18시 수집 후 신규 공고 요약 발송 (예정)<br />
                · 언제든 해지 가능 (메일 하단 링크)
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
