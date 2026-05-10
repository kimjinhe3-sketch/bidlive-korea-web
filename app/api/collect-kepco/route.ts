import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const KEPCO_BASE_URL = "https://bigdata.kepco.co.kr/openapi/v1/electContract.do";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

/** GET — 환경변수 + admin client 진단 */
export async function GET() {
  const env = {
    KEPCO_API_KEY:             !!process.env.KEPCO_API_KEY,
    COLLECT_SECRET:            !!process.env.COLLECT_SECRET,
    NEXT_PUBLIC_SUPABASE_URL:  !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  let admin: Record<string, unknown> = { tested: false };
  try {
    const supabase = createAdminClient();
    const start = Date.now();
    const { count, error } = await supabase
      .from("bid_announcements")
      .select("*", { count: "exact", head: true });
    admin = { tested: true, query_ms: Date.now() - start, total_count: count ?? null, error: error?.message ?? null };
  } catch (e) {
    admin = { tested: true, exception: e instanceof Error ? e.message : String(e) };
  }
  return NextResponse.json({ version: "step3-fetch-only", env, admin });
}

/**
 * POST — STEP 3: KEPCO fetch + parse 만. Supabase upsert 는 skip.
 * 502 가 사라지면 → Supabase upsert 가 원인. 502 그대로면 → fetch/parse 문제.
 */
export async function POST(req: Request) {
  try {
    // auth
    const secret = process.env.COLLECT_SECRET;
    if (secret && req.headers.get("x-collect-secret") !== secret) {
      return NextResponse.json({ ok: false, error: "unauthorized" });
    }

    const apiKey = process.env.KEPCO_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "no KEPCO_API_KEY" });
    }

    // KEPCO fetch — 사용자 PC 에서 정상 응답 확인된 1일 샘플
    const url = new URL(KEPCO_BASE_URL);
    url.searchParams.set("apiKey", apiKey);
    url.searchParams.set("noticeBeginDate", "20220919");
    url.searchParams.set("noticeEndDate", "20220920");
    url.searchParams.set("returnType", "json");

    const start = Date.now();
    const r = await fetch(url.toString(), {
      headers: { "User-Agent": UA, Accept: "*/*" },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    const fetch_ms = Date.now() - start;
    const text = await r.text();
    let parsedCount: number | string = "n/a";
    try {
      const j = JSON.parse(text);
      const arr = Array.isArray(j?.data) ? j.data : Array.isArray(j) ? j : [];
      parsedCount = arr.length;
    } catch {
      parsedCount = "json-parse-failed";
    }

    return NextResponse.json({
      ok: true,
      diag: "step3-fetch-parse-no-upsert",
      kepco_status: r.status,
      fetch_ms,
      body_size: text.length,
      parsed_count: parsedCount,
      body_preview: text.slice(0, 200),
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      diag: "step3-exception",
      message: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack?.split("\n").slice(0, 4).join("\n") : null,
    });
  }
}
