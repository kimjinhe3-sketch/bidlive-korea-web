/**
 * KEPCO 연결 진단용 엔드포인트.
 * Cloudtype 서버에서 KEPCO API 가 도달 가능한지 확인.
 *
 * 호출: GET https://<cloudtype>/api/test-kepco
 *  → 응답에 status, body_preview, elapsed_ms 노출.
 *
 * 보안: GET 만, 데이터 변경 없음. KEPCO_API_KEY 자체는 응답 안 함.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export async function GET() {
  const apiKey = process.env.KEPCO_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "KEPCO_API_KEY 환경변수 미설정" },
      { status: 500 },
    );
  }

  // 샘플 날짜 (사용자 PC 에서 정상 응답 확인된 구간)
  const url = new URL("https://bigdata.kepco.co.kr/openapi/v1/electContract.do");
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("noticeBeginDate", "20220919");
  url.searchParams.set("noticeEndDate", "20220920");
  url.searchParams.set("returnType", "json");

  const start = Date.now();
  try {
    const r = await fetch(url.toString(), {
      headers: { "User-Agent": UA, Accept: "*/*" },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    const text = await r.text();
    const elapsed = Date.now() - start;

    return Response.json({
      ok: r.ok,
      status: r.status,
      elapsed_ms: elapsed,
      content_type: r.headers.get("content-type"),
      body_preview: text.slice(0, 600),
      key_length: apiKey.length,
    });
  } catch (e) {
    return Response.json(
      {
        error: e instanceof Error ? e.message : String(e),
        elapsed_ms: Date.now() - start,
        key_length: apiKey.length,
      },
      { status: 502 },
    );
  }
}
