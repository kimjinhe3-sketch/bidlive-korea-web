"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * 영업대표 태그 추가.
 * (bid_id, rep_name) 중복은 UNIQUE 제약으로 차단됨 — 정상 무시.
 */
export async function addAssignee(bidId: number, repName: string, note?: string) {
  const name = repName.trim();
  if (!name) return { ok: false as const, error: "이름이 비어있습니다" };

  const supabase = await createClient();
  const payload = { bid_id: bidId, rep_name: name, note: note?.trim() || null };
  // Supabase v2 generic 추론이 간헐적으로 never[] 로 떨어져서 명시 캐스트
  const { error } = await supabase
    .from("bid_assignees")
    .insert(payload as never);

  if (error) {
    // 23505 = unique violation → 이미 있음. 에러로 보지 않음.
    if (error.code === "23505") {
      return { ok: true as const, alreadyExisted: true };
    }
    return { ok: false as const, error: error.message };
  }

  revalidatePath("/bids");
  return { ok: true as const };
}

/** 영업대표 태그 삭제 */
export async function removeAssignee(assigneeId: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("bid_assignees")
    .delete()
    .eq("id", assigneeId);

  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/bids");
  return { ok: true as const };
}
