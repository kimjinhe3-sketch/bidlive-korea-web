import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const KEPCO_BASE_URL = "https://bigdata.kepco.co.kr/openapi/v1/electContract.do";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export async function GET() {
  return NextResponse.json({ version: "step4-upsert-1row" });
}

/**
 * STEP4: KEPCO fetch + 1 row 만 upsert.
 * 502 면 upsert 자체가 문제 (단일 row 도 fail).
 * 200 면 다량 upsert 가 문제 → batch 분할 필요.
 */
export async function POST(req: Request) {
  const log: string[] = [];
  try {
    log.push("auth-check");
    const secret = process.env.COLLECT_SECRET;
    if (secret && req.headers.get("x-collect-secret") !== secret) {
      return NextResponse.json({ ok: false, error: "unauthorized" });
    }

    log.push("env-check");
    const apiKey = process.env.KEPCO_API_KEY!;

    log.push("kepco-fetch");
    const url = new URL(KEPCO_BASE_URL);
    url.searchParams.set("apiKey", apiKey);
    url.searchParams.set("noticeBeginDate", "20220919");
    url.searchParams.set("noticeEndDate", "20220920");
    url.searchParams.set("returnType", "json");
    const r = await fetch(url.toString(), {
      headers: { "User-Agent": UA, Accept: "*/*" },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    log.push(`kepco-status:${r.status}`);
    const j = await r.json();
    const items = Array.isArray(j?.data) ? j.data : [];
    log.push(`items:${items.length}`);

    if (items.length === 0) {
      return NextResponse.json({ ok: true, log, note: "no items to upsert" });
    }

    log.push("normalize-1");
    const it = items[0] as Record<string, unknown>;
    const bidNo = String(it.no ?? it.noticeNo ?? "");
    const title = String(it.name ?? it.bidName ?? "");
    const row = {
      source: "kepco_api",
      bid_no: `kepco-${bidNo}`,
      title,
      org_name: "한국전력공사",
      region: null,
      contract_method: it.purchaseType ?? null,
      estimated_price: it.presumedPrice ? Number(it.presumedPrice) : null,
      open_date: it.beginDatetime ?? null,
      close_date: it.endDatetime ?? null,
      bid_type: "공사",
      detail_url: null,
    };
    log.push(`row:${row.bid_no}`);

    log.push("admin-create");
    const supabase = createAdminClient();
    log.push("admin-ok");

    log.push("upsert-start");
    const upStart = Date.now();
    const { error, data } = await supabase
      .from("bid_announcements")
      .upsert([row] as never, { onConflict: "source,bid_no" })
      .select("id");
    log.push(`upsert-done-${Date.now() - upStart}ms`);

    return NextResponse.json({
      ok: !error,
      log,
      upsert_error: error ? { message: error.message, code: error.code, details: error.details } : null,
      upsert_data: data,
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      log,
      exception: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack?.split("\n").slice(0, 5).join("\n") : null,
    });
  }
}
