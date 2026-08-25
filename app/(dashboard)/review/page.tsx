import Link from "next/link";
import {
  getReviewData,
  verdictOf,
  HIT_BAND,
  type ScoreSummary,
  type DailyScore,
} from "@/lib/queries/review";
import { g2bBidUrl } from "@/types/domain";
import { cn } from "@/lib/utils";

/**
 * AI 추천 리뷰보드 — "AI 추천대로 투찰했다면 실제 낙찰가에 얼마나 근접했나" 성적표.
 *
 * 판정 3분류 (2026-08-25 개편): 실제 낙찰가보다 크게 낮은 추천은 낙찰되더라도
 * 남들보다 낮은 금액에 계약하는 저가 수주라 성공이 아니다.
 *  - 적중: 오차 ±0.5%p 이내 — 실제 낙찰가 수준으로 제안
 *  - 저가 제안: 0.5%p 초과 낮음 — 저가 수주 위험
 *  - 고가 제안: 0.5%p 초과 높음 — 투찰 시 순위 밀림
 */

const TERMS: [string, string][] = [
  ["투찰률", "투찰금액 ÷ 예정가격(%). 입찰 참가자가 제시한 금액의 상대적 수준."],
  ["낙찰률", "실제 낙찰자의 투찰률. 이 값에 가깝게 제안하는 것이 AI의 목표."],
  ["추천 투찰률", "AI가 제안한 투찰률. 공고의 낙찰하한율에 과거 낙찰 데이터 기반의 여유 폭을 더해 산출."],
  ["오차", "추천 투찰률 − 실제 낙찰률(%p). 음수는 낮게, 양수는 높게 제안했음을 뜻함."],
  ["적중", `오차 ±${HIT_BAND}%p 이내. 실제 낙찰가 수준으로 제안한 것.`],
  ["저가 제안", `실제 낙찰가보다 ${HIT_BAND}%p 넘게 낮게 제안. 낙찰되더라도 경쟁사보다 낮은 금액에 수행하는 저가 수주 위험.`],
  ["고가 제안", `실제 낙찰가보다 ${HIT_BAND}%p 넘게 높게 제안. 투찰했다면 더 낮은 참가자에게 밀림.`],
  ["무효", "예정가격 × 낙찰하한율보다 낮아 무효 처리되는 투찰. 예정가격이 개찰 당일 추첨(사정율)으로 정해지기 때문에 발생하는 위험."],
];

export const metadata = { title: "AI 추천 리뷰보드" };
export const dynamic = "force-dynamic";

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const scope = sp.scope === "all" ? "all" : "ours";
  const d = await getReviewData(scope);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-kt-black">AI 추천 리뷰보드</h1>
          <p className="mt-1 text-sm text-kt-dark-gray">
            AI 추천이 실제 낙찰가에 얼마나 근접했나 —{" "}
            {scope === "ours" ? (
              <>관심그룹 <b className="text-kt-black num">{d.totalScored.toLocaleString()}</b>건
              <span className="text-kt-light-gray"> (전체 {d.totalAll.toLocaleString()}건 중)</span></>
            ) : (
              <>전체 <b className="text-kt-black num">{d.totalScored.toLocaleString()}</b>건</>
            )}
            <span className="mx-2 text-kt-light-gray">·</span>
            매일 저녁 개찰결과 수집 후 자동 채점
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-kt-light-gray/40 bg-white p-0.5 text-[12px] font-bold">
            <Link
              href="/review"
              className={cn("rounded-md px-3 py-1", scope === "ours" ? "bg-kt-red text-white" : "text-kt-dark-gray hover:text-kt-black")}
            >
              관심그룹
            </Link>
            <Link
              href="/review?scope=all"
              className={cn("rounded-md px-3 py-1", scope === "all" ? "bg-kt-red text-white" : "text-kt-dark-gray hover:text-kt-black")}
            >
              전체
            </Link>
          </div>
          <Link href="/bids" className="text-sm font-bold text-kt-red hover:underline">
            ← 대시보드
          </Link>
        </div>
      </div>

      {d.totalScored === 0 ? (
        <div className="rounded-lg border border-kt-light-gray/40 bg-white py-20 text-center">
          <p className="text-base font-bold text-kt-black">아직 채점된 결과가 없습니다</p>
          <p className="mt-2 text-sm text-kt-dark-gray leading-relaxed">
            추천이 붙은 공고들이 개찰되면 자동으로 성적이 쌓입니다.
          </p>
        </div>
      ) : (
        <>
          {/* 요약 카드 3장 */}
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryCard title="오늘" s={d.today} />
            <SummaryCard title="최근 7일" s={d.d7} highlight />
            <SummaryCard title="최근 30일" s={d.d30} />
          </div>

          {/* 추이 테이블 */}
          <div className="grid gap-4 lg:grid-cols-3">
            <TrendTable title="일일" rows={d.daily.slice(0, 14)} labelFmt={(s) => s.slice(5)} />
            <TrendTable title="주간" rows={d.weekly} labelFmt={(s) => `${s.slice(5)} 주`} />
            <TrendTable title="월간" rows={d.monthly} labelFmt={(s) => s} />
          </div>

          {/* 최근 채점 상세 */}
          <section className="rounded-lg border border-kt-light-gray/40 bg-white overflow-hidden">
            <div className="border-b border-kt-light-gray/30 px-4 py-2.5 text-sm font-bold text-kt-black">
              최근 채점 상세
              <span className="ml-2 text-[11.5px] font-normal text-kt-light-gray">
                사업명 클릭 시 나라장터 공고·개찰 정보로 이동
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-kt-light-gray/30 text-[11px] font-bold uppercase text-kt-dark-gray">
                    <th className="px-3 py-2 text-left">사업명</th>
                    <th className="px-3 py-2 text-center">그룹</th>
                    <th className="px-3 py-2 text-center">개찰일</th>
                    <th className="px-3 py-2 text-right">AI 추천</th>
                    <th className="px-3 py-2 text-right">실제 낙찰률</th>
                    <th className="px-3 py-2 text-right" title="추천 − 실제 낙찰률. 음수=낮게, 양수=높게 제안">오차</th>
                    <th className="px-3 py-2 text-center">판정</th>
                  </tr>
                </thead>
                <tbody>
                  {d.recent.map((r) => {
                    const g2bUrl = g2bBidUrl(r.bid_no);
                    return (
                    <tr key={r.bid_no} className="border-b border-kt-light-gray/20">
                      <td className="px-3 py-1.5 max-w-[340px]">
                        {g2bUrl ? (
                          <a
                            href={g2bUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block truncate font-medium text-kt-black hover:text-kt-blue hover:underline"
                            title={`${r.title ?? ""} · ${r.org_name ?? ""} · ${r.bid_no} — 나라장터 공고·개찰 정보 열기`}
                          >
                            {r.title ?? r.bid_no} <span className="text-[10px] text-kt-blue">↗</span>
                          </a>
                        ) : (
                          <div className="truncate font-medium text-kt-black" title={`${r.title ?? ""} · ${r.org_name ?? ""} · ${r.bid_no}`}>
                            {r.title ?? r.bid_no}
                          </div>
                        )}
                        <div className="truncate text-[11px] text-kt-dark-gray">{r.org_name ?? "-"}</div>
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        {r.grp && r.grp !== "-" ? (
                          <span className="inline-block whitespace-nowrap rounded border border-kt-blue/25 bg-kt-blue/[0.08] px-1.5 py-0.5 text-[10.5px] font-bold text-kt-blue">
                            {r.grp}
                          </span>
                        ) : (
                          <span className="text-[11px] text-kt-light-gray">-</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-center num text-kt-dark-gray">
                        {(r.open_result_date ?? "").slice(5, 10)}
                      </td>
                      <td className="px-3 py-1.5 text-right num font-bold">{Number(r.rec_bid_rate).toFixed(3)}%</td>
                      <td className="px-3 py-1.5 text-right num">{Number(r.actual_win_rate).toFixed(3)}%</td>
                      <td
                        className={cn(
                          "px-3 py-1.5 text-right num font-bold",
                          verdictOf(Number(r.diff)) === "hit" ? "text-emerald-600" : "text-kt-dark-gray",
                        )}
                      >
                        {Number(r.diff) >= 0 ? "+" : ""}
                        {Number(r.diff).toFixed(3)}p
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <VerdictBadge diff={Number(r.diff)} invalid={r.outcome === "under"} />
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* 용어 안내 */}
      <section id="terms" className="rounded-lg border border-kt-light-gray/40 bg-white">
        <div className="border-b border-kt-light-gray/30 px-4 py-2.5 text-sm font-bold text-kt-black">
          용어 안내
        </div>
        <dl className="grid gap-x-10 gap-y-2.5 px-5 py-4 text-[12.5px] sm:grid-cols-2">
          {TERMS.map(([term, def]) => (
            <div key={term} className="flex gap-3">
              <dt className="w-[84px] shrink-0 font-bold text-kt-dark-gray">{term}</dt>
              <dd className="text-kt-black/80">{def}</dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="text-[11.5px] text-kt-light-gray">
        ⚠ 채점은 개찰 결과와의 사후 비교 시뮬레이션이며, 실제 참여 시의 경쟁구도 변화와
        적격심사 서류 통과 여부는 반영하지 않습니다.
      </p>
    </div>
  );
}

function SummaryCard({ title, s, highlight }: { title: string; s: ScoreSummary | null; highlight?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-white p-4",
        highlight ? "border-kt-red/30 shadow-sm" : "border-kt-light-gray/40",
      )}
    >
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-kt-dark-gray">{title}</span>
        <span className="text-[11px] text-kt-light-gray num">{s ? `${s.n}건 채점` : "채점 없음"}</span>
      </div>
      {s ? (
        <>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold text-kt-black num">{s.hitPct}%</span>
            <span className="text-xs font-bold text-kt-dark-gray">적중</span>
          </div>
          <div className="text-[11.5px] text-kt-light-gray">실제 낙찰가 ±{HIT_BAND}%p 이내 제안</div>
          <div className="mt-2.5 space-y-0.5 text-[12px] text-kt-dark-gray">
            <div className="flex justify-between">
              <span title="실제 낙찰가보다 크게 낮게 제안 — 낙찰돼도 저가 수주 위험">저가 제안</span>
              <b className={cn("num", s.lowPct > s.highPct ? "text-amber-600" : "")}>{s.lowPct}%</b>
            </div>
            <div className="flex justify-between">
              <span title="실제 낙찰가보다 크게 높게 제안 — 투찰 시 순위 밀림">고가 제안</span>
              <b className="num">{s.highPct}%</b>
            </div>
            <div className="flex justify-between border-t border-kt-light-gray/25 pt-1 text-[11.5px] text-kt-light-gray">
              <span title="추천 경향: 음수면 전반적으로 낮게, 양수면 높게 제안하는 중">오차 중앙</span>
              <span className="num">{s.medDiff >= 0 ? "+" : ""}{s.medDiff}%p</span>
            </div>
          </div>
        </>
      ) : (
        <div className="mt-3 text-sm text-kt-light-gray">—</div>
      )}
    </div>
  );
}

function TrendTable({
  title,
  rows,
  labelFmt,
}: {
  title: string;
  rows: DailyScore[];
  labelFmt: (s: string) => string;
}) {
  return (
    <section className="rounded-lg border border-kt-light-gray/40 bg-white overflow-hidden">
      <div className="border-b border-kt-light-gray/30 px-4 py-2.5 text-sm font-bold text-kt-black">
        {title} 추이
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-6 text-center text-xs text-kt-light-gray">데이터 없음</div>
      ) : (
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-kt-light-gray/30 text-[10.5px] font-bold uppercase text-kt-dark-gray">
              <th className="px-3 py-1.5 text-left">{title === "일일" ? "날짜" : title === "주간" ? "주" : "월"}</th>
              <th className="px-2 py-1.5 text-right">채점</th>
              <th className="px-2 py-1.5 text-right">적중</th>
              <th className="px-2 py-1.5 text-right" title="추천 경향: 음수=낮게, 양수=높게">오차 중앙</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.date} className="border-b border-kt-light-gray/15">
                <td className="px-3 py-1.5 num text-kt-dark-gray">{labelFmt(r.date)}</td>
                <td className="px-2 py-1.5 text-right num">{r.n}</td>
                <td className="px-2 py-1.5 text-right num font-bold text-kt-black">{r.hitPct}%</td>
                <td className="px-2 py-1.5 text-right num text-kt-dark-gray">
                  {r.medDiff >= 0 ? "+" : ""}{r.medDiff}%p
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function VerdictBadge({ diff, invalid }: { diff: number; invalid: boolean }) {
  const v = verdictOf(diff);
  const map = {
    hit: { label: "적중", cls: "bg-emerald-50 text-emerald-600 border-emerald-200" },
    low: { label: "저가", cls: "bg-amber-50 text-amber-600 border-amber-300" },
    high: { label: "고가", cls: "bg-kt-light-gray/15 text-kt-dark-gray border-kt-light-gray/30" },
  } as const;
  const m = map[v];
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn("inline-block rounded-md border px-1.5 py-0.5 text-[10.5px] font-bold", m.cls)}>
        {m.label}
      </span>
      {invalid && (
        <span
          className="inline-block rounded-md border border-kt-red/25 bg-kt-red/10 px-1 py-0.5 text-[9.5px] font-bold text-kt-red"
          title="예정가격 × 낙찰하한율 미만 — 무효 투찰 (사정율 추첨 영향)"
        >
          무효
        </span>
      )}
    </span>
  );
}
