import Link from "next/link";
import {
  getReviewData,
  tierOf,
  TIERS,
  type TierKey,
  type ScoreSummary,
  type DailyScore,
} from "@/lib/queries/review";
import { g2bBidUrl } from "@/types/domain";
import { cn } from "@/lib/utils";

/**
 * AI 추천 리뷰보드 — "AI 추천대로 투찰했다면 실제 낙찰가에 얼마나 근접했나" 성적표.
 *
 * 판정 = 오차 구간 등급 (2026-08-26 재조정): 적중(0) → 적중권(±0.005) →
 * 근접(±0.05) → 보통(±0.1) / 이탈권(±0.5) → 이탈(±3) → 부정확(±3%p 이상)
 * — 이탈권부터 경고 톤. 실제 낙찰가보다 크게 낮은 추천은 낙찰되더라도
 * 저가 수주라 성공이 아니다.
 */

const TIER_LABELS: Record<TierKey, string> = {
  exact: "적중",
  near: "적중권",
  close: "근접",
  normal: "보통",
  drift: "이탈권",
  out: "이탈",
  far: "부정확",
};

/** 등급별 오차 기준 (범례·툴팁 표기용) */
const TIER_ZONES: Record<TierKey, string> = {
  exact: "오차 0",
  near: "±0.005%p",
  close: "±0.05%p",
  normal: "±0.1%p",
  drift: "±0.5%p",
  out: "±3%p",
  far: "±3%p 이상",
};

const TIER_COLORS: Record<TierKey, string> = {
  exact: "#047857",
  near: "#059669",
  close: "#10b981",
  normal: "#64748b",
  drift: "#ca8a04",
  out: "#ea580c",
  far: "#dc2626",
};

/** 금액 차이(원) → 압축 표기: ±1억 이상 "억", 이하 "만" */
function fmtMoneyDiff(v: number): string {
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  const a = Math.abs(v);
  if (a >= 100_000_000) return `${sign}${(a / 100_000_000).toFixed(1)}억`;
  if (a >= 10_000) return `${sign}${Math.round(a / 10_000).toLocaleString()}만`;
  return `${sign}${a.toLocaleString()}원`;
}

/** 금액(원) → 압축 표기 (부호 없음) */
function fmtMoney(v: number): string {
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억`;
  if (v >= 10_000) return `${Math.round(v / 10_000).toLocaleString()}만`;
  return `${v.toLocaleString()}원`;
}

const ALL_TIER_KEYS = [...TIERS.map((t) => t.key), "far"] as TierKey[];

const TERMS: [string, string][] = [
  ["투찰률", "투찰금액 ÷ 예정가격(%). 입찰 참가자가 제시한 금액의 상대적 수준."],
  ["낙찰률", "실제 낙찰자의 투찰률. 이 값에 가깝게 제안하는 것이 AI의 목표."],
  ["추천 투찰률", "AI가 제안한 투찰률. 공고의 낙찰하한율에 과거 낙찰 데이터 기반의 여유 폭을 더해 산출."],
  ["오차", "추천 투찰률 − 실제 낙찰률(%p). 음수는 낮게, 양수는 높게 제안했음을 뜻함."],
  ["적중", "오차 0 — 실제 낙찰률과 완전 일치."],
  ["적중권", "최적가(적격심사) 방식은 오차 ±0.0005%p 이내, 최저가 방식은 낙찰가 바로 아래 0.0001~0.0010%p."],
  ["오차 등급", "적중(0) → 적중권(±0.005) → 근접(±0.05) → 보통(±0.1)까지가 실전 투찰에 참고 가능한 수준. 이탈권(±0.5) → 이탈(±3) → 부정확(±3%p 이상)은 보정이 필요한 구간."],
  ["저가 제안", "실제 낙찰가보다 0.5%p 넘게 낮게 제안. 낙찰되더라도 경쟁사보다 낮은 금액에 수행하는 저가 수주 위험."],
  ["고가 제안", "실제 낙찰가보다 0.5%p 넘게 높게 제안. 투찰했다면 더 낮은 참가자에게 밀림."],
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
  const dateFilter =
    sp.date === "all" ? "all" : /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : "latest";
  const d = await getReviewData(scope, dateFilter);
  const hrefFor = (date: string) => {
    const q = new URLSearchParams();
    if (scope === "all") q.set("scope", "all");
    q.set("date", date); // "all" 도 명시 — 기본값(파라미터 없음)은 최신 개찰일
    return `/review?${q.toString()}`;
  };

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

          {/* 등급 범례 */}
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11px] text-kt-dark-gray">
            <span className="font-bold">오차 등급</span>
            {ALL_TIER_KEYS.map((k) => (
              <span key={k} className="inline-flex items-center gap-1" title={TIER_ZONES[k]}>
                <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: TIER_COLORS[k] }} />
                {TIER_LABELS[k]}
                <span className="num text-[10px] text-kt-light-gray">{TIER_ZONES[k].replace("%p", "")}</span>
              </span>
            ))}
          </div>

          {/* 추이 테이블 */}
          <div className="grid gap-4 lg:grid-cols-3">
            <TrendTable title="일일" rows={d.daily.slice(0, 14)} labelFmt={(s) => s.slice(5)} />
            <TrendTable title="주간" rows={d.weekly} labelFmt={(s) => `${s.slice(5)} 주`} />
            <TrendTable title="월간" rows={d.monthly} labelFmt={(s) => s} />
          </div>

          {/* 채점 상세 — 개찰일 선택 */}
          <section className="rounded-lg border border-kt-light-gray/40 bg-white overflow-hidden">
            <div className="border-b border-kt-light-gray/30 px-4 py-2.5">
              <div className="text-sm font-bold text-kt-black">
                채점 상세
                <span className="ml-2 text-[11.5px] font-normal text-kt-light-gray">
                  {d.dateFilter === "all"
                    ? `전체 ${d.recentTotal.toLocaleString()}건${d.recentTotal > d.recent.length ? ` 중 최신 ${d.recent.length}건 표시` : ""}`
                    : `${d.dateFilter} 개찰 ${d.recentTotal.toLocaleString()}건`}
                  <span className="mx-1.5">·</span>사업명 클릭 시 나라장터 공고·개찰 정보로 이동
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11.5px] font-bold">
                <Link
                  href={hrefFor("all")}
                  className={cn(
                    "rounded-md border px-2 py-0.5",
                    d.dateFilter === "all"
                      ? "border-kt-red bg-kt-red text-white"
                      : "border-kt-light-gray/40 text-kt-dark-gray hover:border-kt-red/40 hover:text-kt-black",
                  )}
                >
                  전체
                </Link>
                {d.dates.slice(0, 20).map((dt) => (
                  <Link
                    key={dt.date}
                    href={hrefFor(dt.date)}
                    className={cn(
                      "rounded-md border px-2 py-0.5 num",
                      d.dateFilter === dt.date
                        ? "border-kt-red bg-kt-red text-white"
                        : "border-kt-light-gray/40 text-kt-dark-gray hover:border-kt-red/40 hover:text-kt-black",
                    )}
                  >
                    {dt.date.slice(5)} <span className="font-normal opacity-70">{dt.n}</span>
                  </Link>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-kt-light-gray/30 text-[11px] font-bold uppercase text-kt-dark-gray">
                    <th className="px-3 py-2 text-left">사업명</th>
                    <th className="px-3 py-2 text-right" title="실제 낙찰자의 최종 낙찰 금액">낙찰가</th>
                    <th className="px-3 py-2 text-center">그룹</th>
                    <th className="px-3 py-2 text-center">개찰일</th>
                    <th className="px-3 py-2 text-right">AI 추천</th>
                    <th className="px-3 py-2 text-right">실제 낙찰률</th>
                    <th className="px-3 py-2 text-right" title="추천 − 실제 낙찰률. 음수=낮게, 양수=높게 제안">오차</th>
                    <th className="px-3 py-2 text-right" title="추천 투찰금액 − 실제 낙찰금액. 음수=그만큼 낮은 금액으로 제안(저가 방향)">금액 차이</th>
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
                      <td
                        className="px-3 py-1.5 text-right num font-bold text-kt-black"
                        title={r.win_bid_amount != null ? `${Number(r.win_bid_amount).toLocaleString()}원` : undefined}
                      >
                        {r.win_bid_amount != null ? fmtMoney(Number(r.win_bid_amount)) : "-"}
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
                          Math.abs(Number(r.diff)) <= 0.05 ? "text-emerald-600" : "text-kt-dark-gray",
                        )}
                      >
                        {Number(r.diff) >= 0 ? "+" : ""}
                        {Number(r.diff).toFixed(3)}p
                      </td>
                      <td
                        className="px-3 py-1.5 text-right num text-kt-dark-gray"
                        title={
                          r.rec_bid_amount != null && r.win_bid_amount != null
                            ? `추천 ${Number(r.rec_bid_amount).toLocaleString()}원 vs 낙찰 ${Number(r.win_bid_amount).toLocaleString()}원`
                            : undefined
                        }
                      >
                        {r.rec_bid_amount != null && r.win_bid_amount != null
                          ? fmtMoneyDiff(Number(r.rec_bid_amount) - Number(r.win_bid_amount))
                          : "-"}
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <TierBadge diff={Number(r.diff)} invalid={r.outcome === "under"} />
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
            <span className="text-3xl font-extrabold text-kt-black num">{s.cumNear}%</span>
            <span className="text-xs font-bold text-kt-dark-gray" title="오차 ±0.005%p 이내 누적 (적중+적중권)">적중권 이상</span>
          </div>
          {/* 오차 등급 분포 바 */}
          <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-kt-light-gray/15">
            {ALL_TIER_KEYS.map((k) =>
              s.tierPcts[k] > 0 ? (
                <div
                  key={k}
                  title={`${TIER_LABELS[k]} (${TIER_ZONES[k]}) ${s.tierPcts[k]}%`}
                  style={{ width: `${s.tierPcts[k]}%`, backgroundColor: TIER_COLORS[k] }}
                />
              ) : null,
            )}
          </div>
          <div className="mt-2.5 space-y-0.5 text-[12px] text-kt-dark-gray">
            <div className="flex justify-between">
              <span title="오차 ±0.1%p 초과 — 이탈권·이탈·부정확, 보정이 필요한 구간">이탈권 이하</span>
              <b className="num">{Math.round((s.tierPcts.drift + s.tierPcts.out + s.tierPcts.far) * 10) / 10}%</b>
            </div>
            <div className="flex justify-between">
              <span title="실제 낙찰가보다 0.5%p 넘게 낮게 제안 — 낙찰돼도 저가 수주 위험">저가 제안</span>
              <b className={cn("num", s.lowPct > 10 ? "text-amber-600" : "")}>{s.lowPct}%</b>
            </div>
            <div className="flex justify-between">
              <span title="실제 낙찰가보다 0.5%p 넘게 높게 제안 — 투찰 시 순위 밀림">고가 제안</span>
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
              <th className="px-2 py-1.5 text-right" title="오차 ±0.005%p 이내(적중+적중권) 비율">적중권률</th>
              <th className="px-2 py-1.5 text-right" title="추천 경향: 음수=낮게, 양수=높게">오차 중앙</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.date} className="border-b border-kt-light-gray/15">
                <td className="px-3 py-1.5 num text-kt-dark-gray">{labelFmt(r.date)}</td>
                <td className="px-2 py-1.5 text-right num">{r.n}</td>
                <td className="px-2 py-1.5 text-right num font-bold text-kt-black">{r.cumNear}%</td>
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

function TierBadge({ diff, invalid }: { diff: number; invalid: boolean }) {
  const k = tierOf(diff);
  const c = TIER_COLORS[k];
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="inline-block rounded-md border px-1.5 py-0.5 text-[10.5px] font-bold"
        style={{ color: c, backgroundColor: `${c}1a`, borderColor: `${c}55` }}
        title={`오차 ${TIER_ZONES[k]}`}
      >
        {TIER_LABELS[k]}
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
