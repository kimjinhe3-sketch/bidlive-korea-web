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

/**
 * 진단용 GET — env 변수 + Supabase admin client + 단순 SELECT 테스트.
 */
export async function GET() {
  // 1) env
  const env = {
    KEPCO_API_KEY:             !!process.env.KEPCO_API_KEY,
    COLLECT_SECRET:            !!process.env.COLLECT_SECRET,
    NEXT_PUBLIC_SUPABASE_URL:  !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    SERVICE_ROLE_LEN:          process.env.SUPABASE_SERVICE_ROLE_KEY?.length ?? 0,
  };

  // 2) admin client + 단순 SELECT
  let admin: Record<string, unknown> = { tested: false };
  try {
    const supabase = createAdminClient();
    admin = { ...admin, tested: true, client_created: true };
    const start = Date.now();
    const { count, error } = await supabase
      .from("bid_announcements")
      .select("*", { count: "exact", head: true });
    admin = {
      ...admin,
      query_ms: Date.now() - start,
      total_count: count ?? null,
      error: error ? { message: error.message, code: error.code, details: error.details } : null,
    };
  } catch (e) {
    admin = {
      ...admin,
      exception: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack?.split("\n").slice(0, 3).join("\n") : null,
    };
  }

  // 3) region 컬럼 존재 여부 (선택 한 row 의 region 필드 확인)
  let regionCheck: Record<string, unknown> = { tested: false };
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("bid_announcements")
      .select("id,region")
      .limit(1);
    regionCheck = {
      tested: true,
      error: error ? error.message : null,
      sample: data && data.length > 0 ? data[0] : null,
    };
  } catch (e) {
    regionCheck = {
      tested: true,
      exception: e instanceof Error ? e.message : String(e),
    };
  }

  return NextResponse.json({
    version: "diag-c7cd012+",
    env,
    admin,
    regionCheck,
    node: process.version,
  });
}

export async function POST(req: Request) {
  // 모든 단계 try/catch — 어디서 실패하든 JSON 응답 보장 (Cloudtype 502 회피)
  const stages: string[] = [];
  try {
    stages.push("auth");
    const expected = process.env.COLLECT_SECRET;
    const provided = req.headers.get("x-collect-secret");
    if (expected && provided !== expected) {
      return NextResponse.json({ error: "unauthorized" }, { status: 200 });
    }

    stages.push("env-check");
    const apiKey = process.env.KEPCO_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "KEPCO_API_KEY 미설정" }, { status: 200 });
    }
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return NextResponse.json({ error: "NEXT_PUBLIC_SUPABASE_URL 미설정" }, { status: 200 });
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY 미설정 (Cloudtype 환경변수 확인)" }, { status: 200 });
    }

    stages.push("kepco-fetch");
    const lookback = Math.max(1, Math.min(90, Number(req.headers.get("x-lookback-days") ?? "14")));
    const { begin, end } = dateRange(lookback);
    const url = new URL(KEPCO_BASE_URL);
    url.searchParams.set("apiKey", apiKey);
    url.searchParams.set("noticeBeginDate", begin);
    url.searchParams.set("noticeEndDate", end);
    url.searchParams.set("returnType", "json");

    const r = await fetch(url.toString(), {
      headers: { "User-Agent": UA, Accept: "*/*" },
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) {
      const text = await r.text();
      return NextResponse.json(
        { error: `KEPCO ${r.status}`, body: text.slice(0, 300), window: { begin, end } },
        { status: 200 },
      );
    }
    stages.push("kepco-parse");
    const body = await r.json();

    stages.push("normalize");
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
        items_raw: items.length,
        note: "KEPCO 응답에 lookback 구간 데이터 없음",
      });
    }

    stages.push("admin-client");
    const supabase = createAdminClient();

    stages.push("upsert");
    const { error } = await supabase
      .from("bid_announcements")
      .upsert(rows as never, { onConflict: "source,bid_no" });

    if (error) {
      return NextResponse.json(
        { error: "Supabase upsert", details: error.message, code: error.code, window: { begin, end } },
        { status: 200 },
      );
    }

    return NextResponse.json({
      ok: true,
      fetched: rows.length,
      upserted: rows.length,
      window: { begin, end },
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: "unhandled exception",
        stage: stages[stages.length - 1] ?? "init",
        stages_done: stages,
        message: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack?.split("\n").slice(0, 5).join("\n") : null,
      },
      { status: 200 },
    );
  }
}
