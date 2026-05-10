import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * KEPCO 수집 프록시.
 *
 * GitHub Actions runner (해외 IP) 가 KEPCO API 에서 차단당해서,
 * 한국 region 인 Cloudtype 서버에서 호출 → Supabase 적재.
 *
 * 호출:
 *   POST https://<cloudtype>/api/collect-kepco
 *   Headers:
 *     X-Collect-Secret: <COLLECT_SECRET 환경변수와 일치>
 *     X-Lookback-Days:  14   (선택, 기본 14)
 *
 * 환경변수 (Cloudtype 에 등록):
 *   KEPCO_API_KEY               — bigdata.kepco.co.kr 발급 키
 *   COLLECT_SECRET              — 임의 secret (GitHub Actions 와 공유)
 *   SUPABASE_SERVICE_ROLE_KEY   — RLS 우회용 (이미 등록됨)
 */

const KEPCO_BASE_URL = "https://bigdata.kepco.co.kr/openapi/v1/electContract.do";

// kepco_api.py 의 매핑 그대로
const PURCHASE_TYPE_LABELS: Record<string, string> = {
  Product: "물품",
  Goods: "물품",
  Construction: "공사",
  Service: "용역",
  ConstructionService: "공사",
};

const COMPANY_LABELS: Record<string, string> = {
  COM01: "한국전력공사",
  COM02: "한국서부발전",
  COM03: "한국전력국제원자력대학원대학교",
  COM04: "한국남부발전",
  COM05: "한국중부발전",
  COM06: "한국남동발전",
  COM08: "한국동서발전",
  COM09: "한국전력기술",
  COM10: "한전KPS",
  COM11: "한국전력거래소",
  COM12: "한국원자력연료",
  COM14: "한국발전교육원",
  COM16: "한국해상풍력",
  COM19: "KAPES",
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function dateRange(lookbackDays: number) {
  // KST 자정 기준
  const nowKst = new Date(Date.now() + 9 * 3600 * 1000);
  nowKst.setUTCHours(0, 0, 0, 0);
  const end = new Date(nowKst.getTime() - 1000); // 어제 23:59:59 (KST)
  const start = new Date(nowKst);
  start.setUTCDate(start.getUTCDate() - (lookbackDays - 1));
  const fmt = (d: Date) =>
    d.getUTCFullYear().toString() +
    String(d.getUTCMonth() + 1).padStart(2, "0") +
    String(d.getUTCDate()).padStart(2, "0");
  return { begin: fmt(start), end: fmt(end) };
}

function pickStr(item: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = item[k];
    if (v != null && v !== "") return String(v);
  }
  return null;
}

function safeInt(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : null;
}

function pickAttachmentUrl(item: Record<string, unknown>): string | null {
  let preferred: string | null = null;
  let fallback: string | null = null;
  for (let i = 1; i <= 5; i++) {
    const fname = String(item[`filename${i}`] ?? "");
    let flink = String(item[`filenlink${i}`] ?? "").trim();
    if (!flink) continue;
    if (flink.startsWith("http://")) flink = "https://" + flink.slice(7);
    if (!preferred && (fname.includes("공고") || fname.includes("안내"))) preferred = flink;
    if (!fallback) fallback = flink;
  }
  return preferred ?? fallback;
}

interface NormalizedRow {
  source: string;
  bid_no: string;
  title: string;
  org_name: string;
  region: string | null;
  contract_method: string | null;
  estimated_price: number | null;
  open_date: string | null;
  close_date: string | null;
  bid_type: string;
  detail_url: string | null;
}

function normalize(item: Record<string, unknown>): NormalizedRow | null {
  const bidNo = pickStr(item, ["no", "noticeNo", "bidNo", "contractNo"]);
  const title = pickStr(item, ["name", "noticeName", "bidName", "title"]);
  if (!bidNo || !title) return null;

  const companyId = String(item.companyId ?? "");
  const orgName =
    COMPANY_LABELS[companyId] ??
    pickStr(item, ["companyName", "company"]) ??
    "한국전력공사";

  const purchaseType = pickStr(item, ["purchaseType", "progressState", "contractMethod"]);
  const bidType = (purchaseType && PURCHASE_TYPE_LABELS[purchaseType]) || "기타";

  return {
    source: "kepco_api",
    bid_no: `kepco-${bidNo.trim()}`,
    title: title.trim(),
    org_name: orgName,
    region: null,
    contract_method: purchaseType,
    estimated_price: safeInt(pickStr(item, ["presumedPrice", "bidLimitAmt", "contractAmt", "budgetAmt"])),
    open_date: pickStr(item, ["beginDatetime", "noticeDate", "noticeBeginDate"]),
    close_date: pickStr(item, ["endDatetime", "bidAttendReqCloseDatetime", "closeDate"]),
    bid_type: bidType,
    detail_url: pickAttachmentUrl(item),
  };
}

function extractItems(body: unknown): Record<string, unknown>[] {
  if (Array.isArray(body)) return body as Record<string, unknown>[];
  if (body && typeof body === "object") {
    const o = body as Record<string, unknown>;
    for (const k of ["data", "result", "list", "items"]) {
      const v = o[k];
      if (Array.isArray(v)) return v as Record<string, unknown>[];
    }
  }
  return [];
}

export async function POST(req: Request) {
  // 1) 인증 — shared secret
  const expected = process.env.COLLECT_SECRET;
  const provided = req.headers.get("x-collect-secret");
  if (expected && provided !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.KEPCO_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "KEPCO_API_KEY 환경변수 미설정" }, { status: 500 });
  }

  const lookback = Math.max(1, Math.min(90, Number(req.headers.get("x-lookback-days") ?? "14")));
  const { begin, end } = dateRange(lookback);

  // 2) KEPCO 호출
  const url = new URL(KEPCO_BASE_URL);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("noticeBeginDate", begin);
  url.searchParams.set("noticeEndDate", end);
  url.searchParams.set("returnType", "json");

  let body: unknown;
  try {
    const r = await fetch(url.toString(), {
      headers: { "User-Agent": UA, Accept: "*/*" },
      cache: "no-store",
    });
    if (!r.ok) {
      const text = await r.text();
      return NextResponse.json(
        { error: `KEPCO ${r.status}: ${text.slice(0, 300)}` },
        { status: 502 },
      );
    }
    body = await r.json();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "KEPCO fetch failed" },
      { status: 502 },
    );
  }

  // 3) Normalize + dedupe
  const items = extractItems(body);
  const seen = new Set<string>();
  const rows: NormalizedRow[] = [];
  for (const it of items) {
    const n = normalize(it);
    if (n && !seen.has(n.bid_no)) {
      seen.add(n.bid_no);
      rows.push(n);
    }
  }

  if (rows.length === 0) {
    return NextResponse.json({
      ok: true,
      fetched: 0,
      upserted: 0,
      window: { begin, end },
      note: "KEPCO 응답에 lookback 구간 데이터 없음",
    });
  }

  // 4) Supabase upsert (admin = service_role, RLS bypass)
  const supabase = createAdminClient();
  // 타입 정의가 admin client 에 완전히 따라잡지 못하는 케이스 — 명시 cast.
  const { error } = await supabase
    .from("bid_announcements")
    .upsert(rows as never, { onConflict: "source,bid_no" });

  if (error) {
    return NextResponse.json(
      { error: `Supabase upsert: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    fetched: rows.length,
    upserted: rows.length,
    window: { begin, end },
  });
}
