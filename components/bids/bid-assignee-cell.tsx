"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { Plus, X, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BidAssignee } from "@/types/database";
import { addAssignee, removeAssignee } from "@/lib/actions/bids";

/**
 * 영업대표 태그 셀 — 인라인 편집.
 *
 * - 칩 형태로 현재 할당자 표시
 * - "+" 버튼 클릭 → popover 입력 → 추가
 * - 칩 hover 시 X 버튼 → 제거
 */
export function BidAssigneeCell({
  bidId,
  assignees,
}: {
  bidId: number;
  assignees: BidAssignee[];
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  const popRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function commit() {
    const v = name.trim();
    if (!v) return;
    startTransition(async () => {
      const r = await addAssignee(bidId, v);
      if (r.ok) {
        setName("");
        setOpen(false);
      } else {
        alert(r.error ?? "추가 실패");
      }
    });
  }

  function remove(id: number) {
    startTransition(async () => {
      const r = await removeAssignee(id);
      if (!r.ok) alert(r.error ?? "제거 실패");
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1 relative" ref={popRef}>
      {assignees.map((a) => (
        <AssigneeChip key={a.id} a={a} onRemove={() => remove(a.id)} disabled={pending} />
      ))}

      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={pending}
        className={cn(
          "inline-flex h-6 items-center gap-1 rounded-full border border-dashed px-2 text-[11px] transition-colors",
          assignees.length === 0
            ? "border-kt-light-gray text-kt-light-gray hover:border-kt-red hover:text-kt-red"
            : "border-kt-light-gray/40 text-kt-light-gray hover:border-kt-red/40 hover:text-kt-red",
          pending && "opacity-50 cursor-wait",
        )}
        title="영업대표 추가"
      >
        {assignees.length === 0 ? (
          <>
            <UserPlus className="h-3 w-3" />
            할당
          </>
        ) : (
          <Plus className="h-3 w-3" />
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-30 w-56 rounded-lg border border-kt-light-gray/40 bg-white shadow-lg">
          <div className="px-2.5 py-2 border-b border-kt-light-gray/30 text-[11px] font-bold tracking-wide uppercase text-kt-dark-gray">
            영업대표 추가
          </div>
          <div className="p-2.5">
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                // IME 조합 중인 Enter 는 IME 의 commit 으로 흘려보냄
                // (그 다음 Enter 가 실제 추가 액션)
                if (e.key === "Enter" && !e.nativeEvent.isComposing) commit();
                if (e.key === "Escape") setOpen(false);
              }}
              placeholder="이름 입력 후 Enter"
              disabled={pending}
              className="w-full rounded border border-kt-light-gray/40 px-2 py-1.5 text-sm focus:border-kt-red focus:outline-none focus:ring-2 focus:ring-kt-red/15"
            />
            <div className="mt-2 flex justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[11px] text-kt-light-gray hover:text-kt-black px-2 py-1"
              >
                취소
              </button>
              <button
                type="button"
                onClick={commit}
                disabled={pending || !name.trim()}
                className="rounded bg-kt-red text-white text-[11px] font-bold px-2.5 py-1 hover:bg-kt-red-600 disabled:opacity-50"
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AssigneeChip({
  a,
  onRemove,
  disabled,
}: {
  a: BidAssignee;
  onRemove: () => void;
  disabled?: boolean;
}) {
  return (
    <span className="group inline-flex items-center gap-0.5 rounded-full bg-kt-blue/10 border border-kt-blue/25 pl-2 pr-0.5 py-0 h-6 text-[11px] font-medium text-kt-blue">
      {a.rep_name}
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className="opacity-0 group-hover:opacity-100 hover:bg-kt-blue/20 rounded-full p-0.5 transition-opacity disabled:opacity-50"
        title="제거"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </span>
  );
}
