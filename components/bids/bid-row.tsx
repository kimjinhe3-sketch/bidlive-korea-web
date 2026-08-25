"use client";

import { useState } from "react";
import { ExternalLink, Download } from "lucide-react";
import { cn, formatEokWon } from "@/lib/utils";
import {
  ddayTone,
  isFreshOpen,
  isClosingSoon,
  extractSido,
  dDayLabel,
  normalizeDateStr,
  bidPageUrl,
  SOURCE_LABELS,
} from "@/types/domain";
import type { BidWithAssignees, BidRecommendation } from "@/lib/queries/bids";
import { BidAssigneeCell } from "./bid-assignee-cell";

/** 테이블 총 컬럼 수 (패널 colspan 용) — bid-table.tsx 헤더와 반드시 일치 */
const COL_SPAN = 13;

/** 공종별 백테스트 실측 낙찰권 확률(%) — 초기 8일치 기준, 데이터 축적 시 갱신 */
const WIN_PROB: Record<string, number> = { 공사: 36, 용역: 13, 물품: 19 };

/**
 * 입찰 공고 행 (클라이언트) — AI 추천 셀 + 2단계 펼침 패널.
 *   1단계(목록): 추천률 + 신뢰도 점
 *   2단계(행 클릭): 간략 바 — 투찰률·금액(복사)·신뢰도 + [상세 보기]
 *   3단계(상세): 확률 게이지·세그먼트·사정율·마진 근거 + 면책
 */
export function BidRow({
  row,
  rec,
}: {
  row: BidWithAssignees;
  rec: BidRecommendation | null;
}) {
  const [panel, setPanel] = useState<"closed" | "lite" | "full">("closed");
  const dday = dDayLabel(row.close_date);
  const fresh = isFreshOpen(row.open_date);
  const closing = isClosingSoon(row.close_date);
  const sido = extractSido(row.org_name, row.region, row.title);
  // KEPCO 는 detail_url 이 첨부파일 다운로드라 제목 클릭 = SRM 이동, 첨부는 보조 아이콘
  const isKepco = row.source === "kepco_api";
  const pageUrl = bidPageUrl(row);

  return (
    <>
      <tr
        className={cn(
          "border-b border-kt-light-gray/20 hover:bg-kt-light-gray/[0.04] transition-colors",
          panel !== "closed" && "bg-kt-red/[0.03]",
        )}
      >
        {/* 주목 */}
        <td className="px-2 py-2 align-top text-center">
          <div className="inline-flex flex-wrap justify-center gap-1">
            {fresh && <Tag tone="purple">NEW</Tag>}
            {closing && <Tag tone="red">마감임박</Tag>}
          </div>
        </td>

        {/* D-day */}
        <td className="px-2 py-2 align-top text-center">
          <DdayBadge label={dday} />
        </td>

        {/* 제목 */}
        <td className="px-2 py-2 align-top">
          <div className="text-sm text-kt-black font-medium leading-snug line-clamp-2">
            {pageUrl ? (
              <a
                href={pageUrl}
                target="_blank"
                rel="noreferrer"
                className="hover:text-kt-blue hover:underline"
                title={
                  isKepco
                    ? `한전 전자조달(SRM)로 이동 — 공고번호 ${row.bid_no.replace(/^kepco-/, "")} 로 조회`
                    : undefined
                }
              >
                {row.title}
              </a>
            ) : (
              row.title
            )}
          </div>
        </td>

        {/* 기관 */}
        <td className="px-2 py-2 align-top">
          <div className="text-xs text-kt-dark-gray line-clamp-2">{row.org_name ?? "-"}</div>
        </td>

        {/* 지역 */}
        <td className="px-2 py-2 align-top text-center">
          {sido !== "전국/기타" ? (
            <span
              className="inline-flex items-center justify-center rounded border border-kt-blue/25 bg-kt-blue/[0.08] px-1.5 py-0.5 text-[11px] font-bold text-kt-blue whitespace-nowrap"
              title={row.region ?? undefined}
            >
              {sido}
            </span>
          ) : row.region ? (
            <span className="text-[11px] text-kt-dark-gray truncate inline-block max-w-full" title={row.region}>
              {row.region}
            </span>
          ) : (
            <span className="text-[11px] text-kt-light-gray">-</span>
          )}
        </td>

        {/* 업종 */}
        <td className="px-2 py-2 align-top text-center">
          {row.bid_type ? (
            <span className="inline-flex items-center justify-center rounded border border-kt-light-gray/40 bg-kt-light-gray/[0.06] px-1.5 py-0.5 text-[11px] text-kt-dark-gray">
              {row.bid_type}
            </span>
          ) : (
            <span className="text-[11px] text-kt-light-gray">-</span>
          )}
        </td>

        {/* 금액 */}
        <td className="px-2 py-2 align-top text-right">
          <div className="text-sm font-bold text-kt-black num">
            {row.estimated_price && row.estimated_price > 0
              ? formatEokWon(row.estimated_price)
              : "-"}
          </div>
        </td>

        {/* AI 추천 — 클릭 시 간략 패널 토글 */}
        <td className="px-2 py-2 align-top text-center">
          {rec ? (
            <button
              type="button"
              onClick={() => setPanel(panel === "closed" ? "lite" : "closed")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[13px] font-bold num transition-colors",
                panel !== "closed"
                  ? "bg-kt-red/10 text-kt-red"
                  : "text-kt-black hover:bg-kt-red/[0.06] hover:text-kt-red",
              )}
              title="AI 추천 투찰가 보기"
            >
              <ConfDot conf={rec.confidence} />
              {Number(rec.rec_bid_rate).toFixed(2)}%
            </button>
          ) : (
            <span className="text-[11px] text-kt-light-gray">대상 아님</span>
          )}
        </td>

        {/* 마감일 */}
        <td className="px-2 py-2 align-top text-center text-xs text-kt-dark-gray num">
          {normalizeDateStr(row.close_date) ?? "-"}
        </td>

        {/* 공고일 */}
        <td className="px-2 py-2 align-top text-center text-xs text-kt-dark-gray num">
          {normalizeDateStr(row.open_date) ?? "-"}
        </td>

        {/* 출처 */}
        <td className="px-2 py-2 align-top text-center text-[11px] text-kt-dark-gray">
          {SOURCE_LABELS[row.source] ?? row.source}
        </td>

        {/* 영업대표 */}
        <td className="px-2 py-2 align-top">
          <BidAssigneeCell bidId={row.id} assignees={row.assignees} />
        </td>

        {/* 외부 링크 — KEPCO 는 첨부(공고문) 다운로드, 나머지는 공고 페이지 열기 */}
        <td className="px-2 py-2 align-top text-center">
          {row.detail_url && (
            <a
              href={row.detail_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-7 w-7 items-center justify-center rounded text-kt-light-gray hover:text-kt-blue hover:bg-kt-blue/5"
              aria-label={isKepco ? "공고문 다운로드" : "공고 열기"}
              title={isKepco ? "공고문 첨부파일 다운로드" : undefined}
            >
              {isKepco ? (
                <Download className="h-3.5 w-3.5" />
              ) : (
                <ExternalLink className="h-3.5 w-3.5" />
              )}
            </a>
          )}
        </td>
      </tr>

      {rec && panel === "lite" && (
        <RecPanelLite rec={rec} onDetail={() => setPanel("full")} />
      )}
      {rec && panel === "full" && (
        <RecPanelFull rec={rec} bidType={row.bid_type} onCollapse={() => setPanel("lite")} />
      )}
    </>
  );
}

// ──────────────── AI 추천 패널 ────────────────

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className={cn(
        "ml-2 rounded border px-2 py-0.5 text-[11px] align-[3px] transition-colors",
        copied
          ? "border-emerald-300 bg-emerald-50 text-emerald-600"
          : "border-kt-light-gray/50 bg-white text-kt-dark-gray hover:text-kt-black",
      )}
    >
      {copied ? "복사됨" : "복사"}
    </button>
  );
}

function ConfDot({ conf }: { conf: string }) {
  const cls =
    conf === "high" ? "bg-emerald-500" : conf === "medium" ? "bg-amber-500" : "bg-kt-light-gray";
  return <span className={cn("inline-block h-[7px] w-[7px] rounded-full", cls)} />;
}

function ConfDots({ conf, n }: { conf: string; n: number }) {
  const filled = conf === "high" ? 4 : conf === "medium" ? 3 : 2;
  return (
    <span className="text-[12px] font-semibold text-kt-dark-gray">
      신뢰도{" "}
      <span className="tracking-[2px] text-amber-500">
        {"●".repeat(filled)}
        <span className="text-kt-light-gray/70">{"○".repeat(5 - filled)}</span>
      </span>{" "}
      {conf} · 유사 {n}건
    </span>
  );
}

const DISCLAIMER =
  "본 추천은 과거 개찰 데이터 기반 참고값이며, 실제 투찰 및 결과에 대한 책임은 투찰자에게 있습니다.";

function RecPanelLite({ rec, onDetail }: { rec: BidRecommendation; onDetail: () => void }) {
  const rate = Number(rec.rec_bid_rate);
  const amount = Number(rec.rec_bid_amount);
  return (
    <tr className="border-b border-kt-light-gray/30 bg-[#fbfbfc]">
      <td colSpan={COL_SPAN} className="px-5 py-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5">
          <span className="text-[12px] font-bold text-kt-dark-gray">🤖 AI 추천</span>
          <span className="text-[21px] font-extrabold text-kt-black num">
            {rate.toFixed(4)}
            <span className="text-[13px] font-bold"> %</span>
            <CopyButton value={rate.toFixed(4)} />
          </span>
          <span className="text-kt-light-gray/60">|</span>
          <span className="text-[21px] font-extrabold text-kt-black num">
            {amount.toLocaleString()}
            <span className="text-[13px] font-bold"> 원</span>
            <CopyButton value={String(amount)} />
          </span>
          <span className="text-kt-light-gray/60">|</span>
          <ConfDots conf={rec.confidence} n={rec.sample_count} />
          <button
            type="button"
            onClick={onDetail}
            className="rounded-full border border-kt-red/25 bg-kt-red/[0.06] px-3.5 py-1 text-[12px] font-bold text-kt-red hover:bg-kt-red/10"
          >
            상세 보기 ▸
          </button>
        </div>
        <div className="mt-1 text-[11px] text-kt-light-gray">⚠ {DISCLAIMER.slice(0, 34)} — 최종 투찰은 담당자 판단</div>
      </td>
    </tr>
  );
}

function RecPanelFull({
  rec,
  bidType,
  onCollapse,
}: {
  rec: BidRecommendation;
  bidType: string | null;
  onCollapse: () => void;
}) {
  const rate = Number(rec.rec_bid_rate);
  const amount = Number(rec.rec_bid_amount);
  const lower = Number(rec.est_lower_rate);
  const margin = Number(rec.margin);
  const sajeong = Number(rec.expected_sajeong);
  const rat = (rec.rationale ?? {}) as Record<string, unknown>;
  const marginDist = (rat.margin_p25_p50_p75 as number[] | undefined) ?? null;
  const sjIqr = (rat.sajeong_iqr as number[] | undefined) ?? null;
  const dial = (rat.dial as { med_bidders?: number; hist_n?: number; margin_base?: number } | undefined) ?? null;
  const winProb = bidType ? (WIN_PROB[bidType] ?? null) : null;
  const probTone =
    winProb == null ? "" : winProb >= 40 ? "bg-emerald-500" : winProb >= 20 ? "bg-amber-500" : "bg-kt-red";

  return (
    <tr className="border-b border-kt-light-gray/30 bg-[#fbfbfc]">
      <td colSpan={COL_SPAN} className="px-5 py-4">
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          {/* 좌: 핵심 수치 */}
          <div className="min-w-[300px]">
            <div className="mb-2 flex items-center justify-between gap-6 text-[12px] font-bold text-kt-dark-gray">
              <span>🤖 AI 투찰 추천</span>
              <span className="flex items-center gap-3 font-semibold">
                <ConfDots conf={rec.confidence} n={rec.sample_count} />
                <button type="button" onClick={onCollapse} className="font-bold text-kt-red hover:underline">
                  간략히 ▴
                </button>
              </span>
            </div>
            <div className="flex flex-wrap items-end gap-8">
              <div>
                <div className="text-[28px] font-extrabold leading-tight text-kt-black num">
                  {rate.toFixed(4)}
                  <span className="text-[14px] font-bold"> %</span>
                  <CopyButton value={rate.toFixed(4)} />
                </div>
                <div className="mt-1 text-[12px] text-kt-dark-gray">
                  추천 투찰률 (예정가격 대비 · 하한 {lower.toFixed(3)} + 마진 {margin.toFixed(3)})
                </div>
              </div>
              <div>
                <div className="text-[28px] font-extrabold leading-tight text-kt-black num">
                  {amount.toLocaleString()}
                  <span className="text-[14px] font-bold"> 원</span>
                  <CopyButton value={String(amount)} />
                </div>
                <div className="mt-1 text-[12px] text-kt-dark-gray">추천 투찰금액 (기초금액 추정 기준 환산)</div>
              </div>
            </div>
            {winProb != null && (
              <div className="mt-3.5">
                <div className="h-2 w-[250px] overflow-hidden rounded-full bg-kt-light-gray/20">
                  <div className={cn("h-full rounded-full", probTone)} style={{ width: `${winProb}%` }} />
                </div>
                <div className="mt-1 text-[12px] text-kt-dark-gray">
                  예상 낙찰권 확률 <b>{winProb}%</b> — 동일 공종 백테스트 실측 기준 (데이터 축적 중)
                </div>
              </div>
            )}
          </div>

          {/* 우: 근거 */}
          <div className="min-w-[300px] border-l border-kt-light-gray/25 pl-7 text-[12.5px] text-kt-black/80">
            <BasisRow label="참조 세그먼트" value={`${rat.segment ?? "-"}${rat.org_type ? ` (${rat.org_type})` : ""} · ${rec.sample_count}건`} />
            <BasisRow
              label="추정 낙찰하한율"
              value={`${lower.toFixed(3)}%${rat.lower_mode_share ? ` (최빈 ${Math.round(Number(rat.lower_mode_share) * 100)}%)` : ""}`}
            />
            <BasisRow
              label="예상 사정율"
              value={`중앙 ${sajeong.toFixed(2)}${sjIqr ? ` · 범위 ${sjIqr[0]} ~ ${sjIqr[1]}%` : "%"}`}
            />
            {marginDist && (
              <BasisRow label="낙찰 마진 분포" value={`${marginDist.join(" / ")} %p (p25·중앙·p75)`} />
            )}
            {dial && (
              <BasisRow
                label="경쟁 예측"
                value={`약경쟁 (이 기관 과거 참가 중앙 ${dial.med_bidders}개사 · ${dial.hist_n}건) → 저가 수주 방지 위해 마진 ${Number(dial.margin_base).toFixed(3)} → ${margin.toFixed(3)}%p 상향`}
              />
            )}
            {rat.base_ratio != null && (
              <BasisRow label="기초금액 배율" value={`추정가격 × ${Number(rat.base_ratio).toFixed(2)}`} />
            )}
          </div>

          <div className="w-full border-t border-kt-light-gray/25 pt-2 text-[11.5px] text-kt-light-gray">
            ⚠ {DISCLAIMER}
          </div>
        </div>
      </td>
    </tr>
  );
}

function BasisRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-6 py-[3px]">
      <span className="text-kt-dark-gray">{label}</span>
      <b className="text-right">{value}</b>
    </div>
  );
}

// ──────────────── badges (bid-table 에서 이동) ────────────────

function Tag({ tone, children }: { tone: "purple" | "red"; children: React.ReactNode }) {
  const cls =
    tone === "purple"
      ? "bg-kt-purple/10 text-kt-purple border-kt-purple/25"
      : "bg-kt-red/10 text-kt-red border-kt-red/25";
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap",
        cls,
      )}
    >
      {children}
    </span>
  );
}

function DdayBadge({ label }: { label: string | null }) {
  const tone = ddayTone(label);
  if (!label || !tone) return <span className="text-kt-light-gray text-xs">-</span>;
  const cls =
    tone === "danger" ? "bg-kt-red/10 text-kt-red border-kt-red/25"
    : tone === "warn" ? "bg-amber-100 text-amber-800 border-amber-200"
    : tone === "track"? "bg-amber-50 text-amber-700 border-amber-100"
    : "bg-kt-light-gray/15 text-kt-dark-gray border-kt-light-gray/30";
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-[11px] font-bold num whitespace-nowrap",
        cls,
      )}
    >
      {label}
    </span>
  );
}
