import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * KEPCO 수집 프록시 — Cloudtype (한국 region) 에서 KEPCO API 호출 + Supabase 적재.
 * GitHub Actions runner 가 KEPCO 에서 차단당해 우회용.
 */

const KEPCO_BASE_URL = "https://bigdata.kepco.co.kr/openapi/v1/electContract.do";

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

const BATCH_SIZE = 50;  // 다량 upsert 시 Cloudtype 가 process crash → 분할

function dateRange(lookbackDays: number) {
  const nowKst = new Date(Date.now() + 9 * 3600 * 1000);
  nowKst.setUTCHours(0, 0, 0, 0);
  const end = new Date(nowKst.getTime() - 1000);
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
    COMPANY_LABELS[companyId] ?? pickStr(item, ["companyName", "company"]) ?? "한국전력공사";
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

export async function GET() {
  return NextResponse.json({ version: "v1-batch-50" });
}

export async function POST(req: Request) {
  try {
    // auth
    const expected = process.env.COLLECT_SECRET;
    if (expected && req.headers.get("x-collect-secret") !== expected) {
      return NextResponse.json({ ok: false, error: "unauthorized" });
    }
    const apiKey = process.env.KEPCO_API_KEY;
    if (!apiKey) return NextResponse.json({ ok: false, error: "no KEPCO_API_KEY" });

    const lookback = Math.max(1, Math.min(90, Number(req.headers.get("x-lookback-days") ?? "14")));
    const { begin, end } = dateRange(lookback);

    // KEPCO fetch
    const url = new URL(KEPCO_BASE_URL);
    url.searchParams.set("apiKey", apiKey);
    url.searchParams.set("noticeBeginDate", begin);
    url.searchParams.set("noticeEndDate", end);
    url.searchParams.set("returnType", "json");
    const r = await fetch(url.toString(), {
      headers: { "User-Agent": UA, Accept: "*/*" },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) {
      const txt = await r.text();
      // KEPCO 가 lookback 구간에 데이터 없으면 404 + errMsg:NotFound 반환.
      // 이건 정상 케이스 (단지 신규 공고 없음) 이므로 ok:true 로 처리.
      const isNotFound = r.status === 404 && txt.includes("NotFound");
      return NextResponse.json({
        ok: isNotFound,
        fetched: 0,
        upserted: 0,
        kepco_status: r.status,
        body_preview: txt.slice(0, 200),
        window: { begin, end },
        note: isNotFound ? "KEPCO lookback 구간에 신규 공고 없음 (정상)" : undefined,
      });
    }
    const body = await r.json();
    const items: Record<string, unknown>[] = Array.isArray(body?.data)
      ? body.data
      : Array.isArray(body) ? body : [];

    // normalize + dedupe
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
      return NextResponse.json({ ok: true, fetched: 0, upserted: 0, window: { begin, end }, note: "lookback 구간 데이터 없음" });
    }

    // batch upsert — Cloudtype Sandbox 의 메모리/타임아웃 회피
    const supabase = createAdminClient();
    let upserted = 0;
    const errors: { batch: number; error: string }[] = [];
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const chunk = rows.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from("bid_announcements")
        .upsert(chunk as never, { onConflict: "source,bid_no" });
      if (error) {
        errors.push({ batch: Math.floor(i / BATCH_SIZE), error: error.message });
      } else {
        upserted += chunk.length;
      }
    }

    return NextResponse.json({
      ok: errors.length === 0,
      fetched: rows.length,
      upserted,
      batches: Math.ceil(rows.length / BATCH_SIZE),
      errors,
      window: { begin, end },
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      exception: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack?.split("\n").slice(0, 4).join("\n") : null,
    });
  }
}
