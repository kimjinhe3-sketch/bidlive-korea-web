"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2, ExternalLink, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 수집하기 버튼 v3 — 실시간 폴링 방식.
 *  - 클릭 시 /api/collect 로 GH Actions workflow_dispatch 트리거
 *  - 트리거 직전 baseline (lastCollectedAt + total) 저장
 *  - 5초 간격으로 /api/last-collected 폴링
 *  - lastCollectedAt 이 baseline 보다 새로워지면 → 완료 (N건 추가 표시 + auto refresh)
 *  - 10분 경과 시 timeout 경고
 *  - 진행 중 spinner + 경과 시간 표시
 */

type ButtonState =
  | { kind: "idle" }
  | { kind: "starting" }                         // POST /api/collect 중
  | {
      kind: "running";
      actionsUrl: string;
      baselineTs: string | null;
      baselineTotal: number;
      elapsedSec: number;
      lastTotal: number;                          // 마지막 poll 결과
    }
  | {
      kind: "done";
      newCount: number;                           // 증가량
      totalAfter: number;
    }
  | { kind: "timeout"; actionsUrl: string }
  | { kind: "err"; text: string };

const POLL_INTERVAL_MS = 5000;
const TIMEOUT_MS = 10 * 60 * 1000;  // 10분 — GH Actions 부팅 + 수집 안전 마진

export function BidCollectButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<ButtonState>({ kind: "idle" });
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 1초 단위 elapsed 카운터 (UI 용)
  useEffect(() => {
    if (state.kind !== "running") return;
    tickRef.current = setInterval(() => {
      setState((s) => (s.kind === "running" ? { ...s, elapsedSec: s.elapsedSec + 1 } : s));
    }, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [state.kind]);

  // 5초 단위 last-collected 폴링
  useEffect(() => {
    if (state.kind !== "running") return;
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch("/api/last-collected", { cache: "no-store" });
        const j = await r.json();
        if (!j.ok) return;
        setState((s) => {
          if (s.kind !== "running") return s;
          const newer =
            j.lastCollectedAt &&
            (!s.baselineTs || new Date(j.lastCollectedAt) > new Date(s.baselineTs));
          if (newer) {
            // 완료!
            if (pollRef.current) clearInterval(pollRef.current);
            if (tickRef.current) clearInterval(tickRef.current);
            const newCount = Math.max(0, (j.total as number) - s.baselineTotal);
            // KPI / 리스트 새로고침
            router.refresh();
            return { kind: "done", newCount, totalAfter: j.total };
          }
          // 타임아웃 체크
          if (s.elapsedSec * 1000 > TIMEOUT_MS) {
            if (pollRef.current) clearInterval(pollRef.current);
            if (tickRef.current) clearInterval(tickRef.current);
            return { kind: "timeout", actionsUrl: s.actionsUrl };
          }
          return { ...s, lastTotal: j.total };
        });
      } catch {
        /* 네트워크 일시 오류 무시, 다음 tick 에 재시도 */
      }
    }, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [state.kind, router]);

  function trigger() {
    setState({ kind: "starting" });
    startTransition(async () => {
      try {
        // 1) baseline — 트리거 직전 lastCollectedAt + total
        const baselineRes = await fetch("/api/last-collected", { cache: "no-store" });
        const baselineJson = await baselineRes.json();
        const baselineTs = baselineJson?.lastCollectedAt ?? null;
        const baselineTotal = Number(baselineJson?.total ?? 0);

        // 2) workflow_dispatch
        const r = await fetch("/api/collect", { method: "POST" });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.ok) {
          setState({ kind: "err", text: j.error || `실패: ${r.status}` });
          return;
        }

        // GH Actions 새 탭 자동 open (선택)
        if (j.actions_url && typeof window !== "undefined") {
          window.open(j.actions_url, "_blank", "noopener");
        }

        setState({
          kind: "running",
          actionsUrl: j.actions_url ?? "",
          baselineTs,
          baselineTotal,
          elapsedSec: 0,
          lastTotal: baselineTotal,
        });
      } catch (e) {
        setState({
          kind: "err",
          text: e instanceof Error ? e.message : "네트워크 오류",
        });
      }
    });
  }

  // 완료 toast 5초 후 자동 idle
  useEffect(() => {
    if (state.kind !== "done") return;
    const t = setTimeout(() => setState({ kind: "idle" }), 5000);
    return () => clearTimeout(t);
  }, [state.kind]);

  const isBusy = pending || state.kind === "starting" || state.kind === "running";

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={trigger}
        disabled={isBusy}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-bold transition-colors",
          state.kind === "done"
            ? "border-kt-teal bg-kt-teal text-white"
            : state.kind === "running" || state.kind === "starting"
            ? "border-kt-light-gray bg-white text-kt-dark-gray"
            : "border-kt-red bg-kt-red text-white hover:bg-kt-red-600 hover:border-kt-red-600",
          "disabled:cursor-wait",
        )}
        title="GitHub Actions Daily Collect 워크플로우 즉시 실행"
      >
        {state.kind === "starting" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : state.kind === "running" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-kt-red" />
        ) : state.kind === "done" ? (
          <CheckCircle2 className="h-3.5 w-3.5" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5" />
        )}
        {state.kind === "starting"
          ? "트리거 중…"
          : state.kind === "running"
          ? `수집 중 ${formatMinSec(state.elapsedSec)}`
          : state.kind === "done"
          ? `완료 (+${state.newCount.toLocaleString("ko-KR")}건)`
          : "지금 수집"}
      </button>

      {state.kind === "running" && (
        <div className="absolute right-0 top-full mt-1.5 z-20 w-[300px] rounded-md border border-kt-light-gray/40 bg-white shadow-lg">
          <div className="px-3 py-2 border-b border-kt-light-gray/30 flex items-center gap-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-kt-red" />
            <span className="text-[11px] font-bold text-kt-dark-gray">
              수집 진행 중 · {formatMinSec(state.elapsedSec)} 경과
            </span>
          </div>
          <div className="px-3 py-2 text-[11px] text-kt-dark-gray space-y-1">
            <div>• GitHub Actions runner 부팅 + 5 source 병렬 수집</div>
            <div>• DB 변경 감지되면 자동 완료 (5초 폴링)</div>
            <div className="text-kt-light-gray">
              현재 DB: <span className="num font-bold text-kt-black">{state.lastTotal.toLocaleString("ko-KR")}</span>건
            </div>
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
          </div>
        </div>
      )}

      {state.kind === "timeout" && (
        <div className="absolute right-0 top-full mt-1.5 z-20 w-[280px] rounded-md border border-amber-300 bg-amber-50 shadow-lg">
          <div className="px-3 py-2 flex items-start gap-1.5">
            <XCircle className="h-3.5 w-3.5 text-amber-700 mt-0.5 shrink-0" />
            <div className="text-[11px] text-amber-900 space-y-1">
              <div className="font-bold">10분이 지났지만 변화 감지 안 됨</div>
              <div>
                GitHub Actions 가 아직 실행 중이거나 실패했을 수 있음.
                {state.actionsUrl && (
                  <a
                    href={state.actionsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-1 inline-flex items-center gap-1 underline"
                  >
                    Actions 로그 확인
                  </a>
                )}
              </div>
              <button
                type="button"
                onClick={() => setState({ kind: "idle" })}
                className="text-amber-700 hover:underline"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {state.kind === "err" && (
        <div className="absolute right-0 top-full mt-1.5 z-20 inline-flex items-center gap-1.5 rounded-md border border-kt-red/25 bg-kt-red/5 px-2.5 py-1.5">
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
