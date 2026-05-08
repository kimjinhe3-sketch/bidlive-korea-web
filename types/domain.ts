/**
 * 입찰 도메인 — 소스 그룹 / 라벨 / D-day 매핑.
 *
 * Python collector (bid_collector/dashboard/app.py) 의 SOURCE_GROUPS /
 * SOURCE_LABELS 와 동기화 유지.
 */

export const SOURCE_GROUPS = {
  나라장터: [
    "g2b_api_thng", "g2b_api_servc", "g2b_api_cnstwk",
    "g2b_api_frgcpt", "g2b_api_etc",
  ],
  누리장터: [
    "prvt_api_servc", "prvt_api_thng",
    "prvt_api_cnstwk", "prvt_api_etc",
  ],
  기타: [
    "d2b_api_dmstc", "kepco_api", "alio", "lh_api",
    "kec_api", "kwater_api",
    "kwater_api_cntrwk", "kwater_api_gds",
    "kwater_api_servc", "kwater_api_dmscpt", "g2b_crawl",
  ],
} as const;

export type SourceGroup = keyof typeof SOURCE_GROUPS;

export const SOURCE_LABELS: Record<string, string> = {
  g2b_api_thng:    "나라장터 물품",
  g2b_api_servc:   "나라장터 용역",
  g2b_api_cnstwk:  "나라장터 공사",
  g2b_api_frgcpt:  "나라장터 외자",
  g2b_api_etc:     "나라장터 기타",
  prvt_api_servc:  "누리장터 용역",
  prvt_api_thng:   "누리장터 물품",
  prvt_api_cnstwk: "누리장터 공사",
  prvt_api_etc:    "누리장터 기타",
  alio:            "ALIO",
  g2b_crawl:       "나라장터 크롤",
  d2b_api_dmstc:   "방위사업청",
  kwater_api:      "K-water",
  kwater_api_cntrwk: "K-water 공사",
  kwater_api_gds:    "K-water 물품",
  kwater_api_servc:  "K-water 용역",
  kwater_api_dmscpt: "K-water 내자",
  kepco_api:         "KEPCO",
  lh_api:            "LH (토지주택)",
  kec_api:           "한국도로공사",
};

export const BID_TYPES = ["물품", "용역", "공사", "외자", "기타", "민간"] as const;
export type BidType = (typeof BID_TYPES)[number];

/** 시·도 — region 추출용 */
export const SIDO_LIST = [
  "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
  "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
] as const;
export type Sido = (typeof SIDO_LIST)[number];

/**
 * D-day 셀의 시맨틱 톤 (DESIGN_SYSTEM 1-4).
 *  - 위험 (D-day, D-1)        : kt-red
 *  - 결정 임박 (D-2, D-3)     : amber
 *  - 추적 (D-4 ~ D-7)         : amber soft
 *  - 비활성 (마감 지남)       : kt-light-gray
 */
export type DdayTone = "danger" | "warn" | "track" | "muted";

export function ddayTone(dday: string | null): DdayTone | null {
  if (!dday) return null;
  if (dday === "마감") return "muted";
  if (dday === "D-day" || dday === "D-1") return "danger";
  if (dday === "D-2" || dday === "D-3") return "warn";
  if (/^D-[0-9]+$/.test(dday)) return "track";
  return null;
}
