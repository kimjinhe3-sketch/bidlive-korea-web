"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 수집하기 버튼.
 *  - 클릭 시 /api/collect 로 GH Actions workflow_dispatch 트리거
 *  - 응답 후 토스트 표시 (5~10분 후 새로고침 권장)
 */
export function BidCollectButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  function trigger() {
    setMsg(null);
    startTransition(async () => {
      try {
        const r = await fetch("/api/collect", { method: "POST" });
        const j = await r.json().catch(() => ({}));
        if (r.ok) {
          setMsg({ tone: "ok", text: "수집 시작됨 — 5~10분 후 새로고침" });
        } else {
          setMsg({ tone: "err", text: j.error || `실패: ${r.status}` });
        }
      } catch (e) {
        setMsg({ tone: "err", text: e instanceof Error ? e.message : "네트워크 오류" });
      }
    });
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={trigger}
        disabled={pending}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border border-kt-red bg-kt-red px-3 py-1.5 text-xs font-bold text-white transition-colors",
          "hover:bg-kt-red-600 hover:border-kt-red-600",
          "disabled:opacity-60 disabled:cursor-wait",
        )}
        title="GitHub Actions 의 daily-collect 워크플로우 즉시 실행"
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        지금 수집
      </button>
      {msg && (
        <span
          className={cn(
            "absolute left-0 top-full mt-1 whitespace-nowrap rounded text-[11px] px-2 py-1 z-10",
            msg.tone === "ok"
              ? "bg-kt-teal/10 text-kt-teal border border-kt-teal/25"
              : "bg-kt-red/10 text-kt-red border border-kt-red/25",
          )}
          onClick={() => {
            if (msg.tone === "ok") router.refresh();
            setMsg(null);
          }}
        >
          {msg.text}
          {msg.tone === "ok" && <span className="ml-1 underline">새로고침</span>}
        </span>
      )}
    </div>
  );
}
