import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getBidList } from "@/lib/queries/bids";
import {
  SOURCE_GROUPS,
  SOURCE_LABELS,
  extractSido,
  dDayLabel,
  normalizeDateStr,
  type SourceGroup,
  type Sido,
  type TagValue,
  type SortColumn,
  type SortDir,
} from "@/types/domain";
import { formatEokWon } from "@/lib/utils";

/**
 * 현재 필터 그대로, 페이지네이션 무시하고 전체 결과를 xlsx 로 다운로드.
 * GET 으로 호출 → 브라우저가 자동 다운로드.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sp = Object.fromEntries(url.searchParams);

  const groupParam = sp.group;
  const groups: SourceGroup[] | undefined =
    groupParam && groupParam in SOURCE_GROUPS ? [groupParam as SourceGroup] : undefined;

  const filter = {
    groups,
    keyword: sp.q,
    orgKeyword: sp.org,
    bidTypes: parseList(sp.types),
    regions: parseList(sp.regions) as (Sido | "전국/기타")[],
    tags: parseList(sp.tags) as TagValue[],
    activeOnly: sp.active !== "0",
    closingWithinDays: sp.dday ? Number(sp.dday) : undefined,
    amountMinEok: sp.amin ? Number(sp.amin) : undefined,
    amountMaxEok: sp.amax ? Number(sp.amax) : undefined,
    amountUnbounded: sp.aopen === "1",
    dateFrom: sp.from,
    dateTo: sp.to,
    includeKeywords: parseList(sp.inc),
    excludeKeywords: parseList(sp.exc),
    sortBy: sp.sort as SortColumn | undefined,
    sortDir: sp.dir as SortDir | undefined,
  };

  // limit 50000 — 거의 모든 결과 한 번에. Supabase 한계는 더 높지만 안전 cap.
  const rows = await getBidList(filter, 50000);

  const data = rows.map((r) => ({
    "공고번호": r.bid_no,
    "제목": r.title,
    "기관": r.org_name ?? "",
    "지역": extractSido(r.org_name, r.region, r.title),
    "지역(원본)": r.region ?? "",
    "업종": r.bid_type ?? "",
    "금액(원)": r.estimated_price ?? "",
    "금액(요약)": r.estimated_price ? formatEokWon(r.estimated_price) : "",
    "공고일": normalizeDateStr(r.open_date) ?? "",
    "마감일": normalizeDateStr(r.close_date) ?? "",
    "D-day": dDayLabel(r.close_date) ?? "",
    "출처": SOURCE_LABELS[r.source] ?? r.source,
    "영업대표": r.assignees.map((a) => a.rep_name).join(", "),
    "URL": r.detail_url ?? "",
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, "입찰공고");

  const buffer: ArrayBuffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const today = new Date().toISOString().slice(0, 10);

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="bidlive_${today}_${rows.length}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}

function parseList(s: string | undefined): string[] {
  if (!s) return [];
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}
