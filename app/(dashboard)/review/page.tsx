import Link from "next/link";
import { getReviewData, type ScoreSummary, type DailyScore } from "@/lib/queries/review";
import { cn } from "@/lib/utils";

export const metadata = { title: "AI 추천 리뷰보드" };
export const dynamic = "force-dynamic";

/**
 * AI 추천 리뷰보드 — "그때 AI 추천대로 투찰했다면" 을 실제 개찰 결과로 채점한 성적표.
 * 일일/주간/월간 추이로 lesson learned 를 확인한다.
 *
 * 지표:
 *  - 낙찰권: 추천가가 유효(하한 이상)하면서 실제 1순위보다 낮았던 비율
 *  - 미달: 추천가가 실제 낙찰하한 미만 (사정율 예측 오차)
 *  - 밀림: 실제 낙찰자가 더 낮게 투찰
 *  - ±0.3%p: 추천 투찰률이 실제 낙찰률의 ±0.3%p 안 (PRD G2)
 *  - 하한적중: 낙찰하한율 추정이 실제와 일치
 */
export default async function ReviewPage() {
  const d = await getReviewData();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-kt-black">AI 추천 리뷰보드</h1>
          <p className="mt-1 text-sm text-kt-dark-gray">
            추천 투찰가 vs 실제 개찰 결과 — 누적 채점 <b className="text-kt-black num">{d.totalScored.toLocaleString()}</b>건
            <span className="mx-2 text-kt-light-gray">·</span>
            매일 저녁 개찰결과 수집 후 자동 채점
          </p>
        </div>
        <Link href="/bids" className="text-sm font-bold text-kt-red hover:underline">
          ← 대시보드
        </Link>
      </div>

      {d.totalScored === 0 ? (
        <div className="rounded-lg border border-kt-light-gray/40 bg-white py-20 text-center">
          <p className="text-base font-bold text-kt-black">아직 채점된 결과가 없습니다</p>
          <p className="mt-2 text-sm text-kt-dark-gray leading-relaxed">
            추천이 붙은 공고들이 개찰되면 자동으로 성적이 쌓입니다.
            <br />
            (추천 시작: 2026-08-19 — 마감임박 공고부터 수일 내 첫 성적이 나옵니다)
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
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-kt-light-gray/30 text-[11px] font-bold uppercase text-kt-dark-gray">
                    <th className="px-3 py-2 text-left">공고번호</th>
                    <th className="px-3 py-2 text-center">개찰일</th>
                    <th className="px-3 py-2 text-right">추천 투찰률</th>
                    <th className="px-3 py-2 text-right">실제 낙찰률</th>
                    <th className="px-3 py-2 text-right">오차</th>
                    <th className="px-3 py-2 text-center">결과</th>
                    <th className="px-3 py-2 text-center">하한적중</th>
                  </tr>
                </thead>
                <tbody>
                  {d.recent.map((r) => (
                    <tr key={r.bid_no} className="border-b border-kt-light-gray/20">
                      <td className="px-3 py-1.5 num text-kt-dark-gray">{r.bid_no}</td>
                      <td className="px-3 py-1.5 text-center num text-kt-dark-gray">
                        {(r.open_result_date ?? "").slice(5, 10)}
                      </td>
                      <td className="px-3 py-1.5 text-right num font-bold">{Number(r.rec_bid_rate).toFixed(3)}%</td>
                      <td className="px-3 py-1.5 text-right num">{Number(r.actual_win_rate).toFixed(3)}%</td>
                      <td
                        className={cn(
                          "px-3 py-1.5 text-right num",
                          Math.abs(Number(r.diff)) <= 0.3 ? "text-emerald-600" : "text-kt-dark-gray",
                        )}
                      >
                        {Number(r.diff) >= 0 ? "+" : ""}
                        {Number(r.diff).toFixed(3)}p
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <OutcomeBadge outcome={r.outcome} />
                      </td>
                      <td className="px-3 py-1.5 text-center">{r.lower_hit ? "○" : "✕"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <p className="text-[11.5px] text-kt-light-gray">
        ⚠ 채점은 &quot;추천가로 투찰했다면 실제 1순위보다 낮은 유효 투찰이었는가&quot; 기준의 시뮬레이션이며,
        적격심사 서류 통과와 참여로 인한 경쟁구도 변화는 반영하지 않습니다.
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
            <span className="text-3xl font-extrabold text-kt-black num">{s.winPct}%</span>
            <span className="text-xs font-bold text-kt-dark-gray">낙찰권</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[12px] text-kt-dark-gray">
            <Metric label="하한 미달" v={`${s.underPct}%`} />
            <Metric label="순위 밀림" v={`${s.beatenPct}%`} />
            <Metric label="±0.3%p 적중" v={`${s.hit03Pct}%`} good />
            <Metric label="하한율 적중" v={`${s.lowerHitPct}%`} good />
          </div>
        </>
      ) : (
        <div className="mt-3 text-sm text-kt-light-gray">—</div>
      )}
    </div>
  );
}

function Metric({ label, v, good }: { label: string; v: string; good?: boolean }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <b className={cn("num", good && "text-emerald-600")}>{v}</b>
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
              <th className="px-2 py-1.5 text-right">낙찰권</th>
              <th className="px-2 py-1.5 text-right">미달</th>
              <th className="px-2 py-1.5 text-right">±0.3</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.date} className="border-b border-kt-light-gray/15">
                <td className="px-3 py-1.5 num text-kt-dark-gray">{labelFmt(r.date)}</td>
                <td className="px-2 py-1.5 text-right num">{r.n}</td>
                <td className="px-2 py-1.5 text-right num font-bold text-kt-black">{r.winPct}%</td>
                <td className="px-2 py-1.5 text-right num text-kt-dark-gray">{r.underPct}%</td>
                <td className="px-2 py-1.5 text-right num text-emerald-600">{r.hit03Pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    win: { label: "낙찰권", cls: "bg-emerald-50 text-emerald-600 border-emerald-200" },
    under: { label: "미달", cls: "bg-kt-red/10 text-kt-red border-kt-red/25" },
    beaten: { label: "밀림", cls: "bg-kt-light-gray/15 text-kt-dark-gray border-kt-light-gray/30" },
  };
  const m = map[outcome] ?? { label: outcome, cls: "" };
  return (
    <span className={cn("inline-block rounded-md border px-1.5 py-0.5 text-[10.5px] font-bold", m.cls)}>
      {m.label}
    </span>
  );
}
