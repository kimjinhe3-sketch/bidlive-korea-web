"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2, ExternalLink, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 수집하기 버튼 v2.
 *  - 클릭 시 /api/collect 로 GH Actions workflow_dispatch 트리거
 *  - 응답 받으면 GH Actions 페이지 새 탭 자동 open
 *  - 6분 카운트다운 + 자동 새로고침
 *  - 진행 메시지 명확화
 */
export function BidCollectButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "ok"; actionsUrl: string; secondsLeft: number }
    | { kind: "err"; text: string }
  >({ kind: "idle" });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 카운트다운 + 0 되면 자동 refresh
  useEffect(() => {
    if (state.kind !== "ok") return;
    timerRef.current = setInterval(() => {
      setState((s) => {
        if (s.kind !== "ok") return s;
        const next = s.secondsLeft - 1;
        if (next <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          router.refresh();
          return { kind: "idle" };
        }
        return { ...s, secondsLeft: next };
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state.kind, router]);

  function trigger() {
    setState({ kind: "idle" });
    startTransition(async () => {
      try {
        const r = await fetch("/api/collect", { method: "POST" });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.ok) {
          // GH Actions 페이지 새 탭 자동 open
          if (j.actions_url && typeof window !== "undefined") {
            window.open(j.actions_url, "_blank", "noopener");
          }
          setState({
            kind: "ok",
            actionsUrl: j.actions_url ?? "",
            secondsLeft: 360,  // 6분
          });
        } else {
          setState({ kind: "err", text: j.error || `실패: ${r.status}` });
        }
      } catch (e) {
        setState({
          kind: "err",
          text: e instanceof Error ? e.message : "네트워크 오류",
        });
      }
    });
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={trigger}
        disabled={pending || state.kind === "ok"}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-bold transition-colors",
          state.kind === "ok"
            ? "border-kt-teal bg-kt-teal text-white"
            : "border-kt-red bg-kt-red text-white hover:bg-kt-red-600 hover:border-kt-red-600",
          "disabled:opacity-80 disabled:cursor-wait",
        )}
        title="GitHub Actions Daily Collect 워크플로우 즉시 실행"
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : state.kind === "ok" ? (
          <CheckCircle2 className="h-3.5 w-3.5" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5" />
        )}
        {state.kind === "ok"
          ? `수집 중 — ${formatMinSec(state.secondsLeft)}`
          : "지금 수집"}
      </button>

      {state.kind === "ok" && (
        <div className="absolute left-0 top-full mt-1.5 z-20 w-[300px] rounded-md border border-kt-teal/30 bg-white shadow-lg">
          <div className="px-3 py-2 border-b border-kt-light-gray/30 flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-kt-teal" />
            <span className="text-[11px] font-bold text-kt-teal">수집 시작됨</span>
          </div>
          <div className="px-3 py-2 text-[11px] text-kt-dark-gray space-y-1">
            <div>• GitHub Actions 가 백그라운드 실행 중</div>
            <div>• {formatMinSec(state.secondsLeft)} 후 자동 새로고침</div>
            {state.actionsUrl && (
              <a
                href={state.actionsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-kt-blue hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                실행 진행 보기 (GitHub Actions)
              </a>
            )}
            <button
              type="button"
              onClick={() => router.refresh()}
              className="inline-flex items-center gap-1 text-kt-light-gray hover:text-kt-black ml-2"
            >
              지금 새로고침
            </button>
          </div>
        </div>
      )}

      {state.kind === "err" && (
        <div className="absolute left-0 top-full mt-1.5 z-20 inline-flex items-center gap-1.5 rounded-md border border-kt-red/25 bg-kt-red/5 px-2.5 py-1.5">
          <XCircle className="h-3.5 w-3.5 text-kt-red" />
          <span className="text-[11px] text-kt-red whitespace-nowrap">{state.text}</span>
          <button
            type="button"
            onClick={() => setState({ kind: "idle" })}
            className="text-[11px] text-kt-light-gray hover:text-kt-black ml-1"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

function formatMinSec(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
