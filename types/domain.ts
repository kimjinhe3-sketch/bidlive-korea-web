/**
 * 입찰 도메인 — 소스 그룹 / 라벨 / D-day 매핑.
 *
 * v2 그룹 정의: 나라장터 / LH / KEPCO / 기타
 *  - 누리장터 (prvt_api_*) 는 KPI 표시 제외 (DB 에는 그대로 보관)
 *  - LH / KEPCO 는 별도 그룹으로 승격
 *  - 기타: alio + 누리장터 + d2b + kwater + kec
 */

export const SOURCE_GROUPS = {
  나라장터: [
    "g2b_api_thng", "g2b_api_servc", "g2b_api_cnstwk",
    "g2b_api_frgcpt", "g2b_api_etc",
    "g2b_crawl",
  ],
  LH: ["lh_api"],
  KEPCO: ["kepco_api"],
  기타: [
    "alio",
    "d2b_api_dmstc",
    "kwater_api",
    "kwater_api_cntrwk", "kwater_api_gds",
    "kwater_api_servc", "kwater_api_dmscpt",
    "kec_api",
    // 누리장터 — DB 에는 있지만 UI 그룹으론 '기타' 에 포함
    "prvt_api_servc", "prvt_api_thng",
    "prvt_api_cnstwk", "prvt_api_etc",
  ],
} as const;

export type SourceGroup = keyof typeof SOURCE_GROUPS;

export const SOURCE_GROUP_ORDER: SourceGroup[] = ["나라장터", "LH", "KEPCO", "기타"];

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
  lh_api:            "LH",
  kec_api:           "한국도로공사",
};

export const BID_TYPES = ["물품", "용역", "공사", "외자", "기타", "민간"] as const;
export type BidType = (typeof BID_TYPES)[number];

export const SIDO_LIST = [
  "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
  "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
] as const;
export type Sido = (typeof SIDO_LIST)[number];

/** 시·도 추출 — org_name 의 첫 단어가 SIDO 면 그 시·도, 아니면 "전국/기타". */
export function extractSido(orgName: string | null): Sido | "전국/기타" {
  if (!orgName) return "전국/기타";
  for (const s of SIDO_LIST) {
    if (orgName.includes(s)) return s;
  }
  return "전국/기타";
}

/**
 * D-day 톤 (DESIGN_SYSTEM 1-4):
 *   danger (D-2/D-1/D-day) · warn (D-3) · track (D-4~D-7) · muted (마감)
 */
export type DdayTone = "danger" | "warn" | "track" | "muted";

export function ddayTone(dday: string | null): DdayTone | null {
  if (!dday) return null;
  if (dday === "마감") return "muted";
  if (dday === "D-day" || dday === "D-1" || dday === "D-2") return "danger";
  if (dday === "D-3") return "warn";
  if (/^D-[0-9]+$/.test(dday)) return "track";
  return null;
}

/**
 * "신규" 정의: 입찰 공고일(open_date) 이 오늘/어제/그제 (3일 이내).
 * 이전: created_at 기준 → 변경됨.
 */
export function isFreshOpen(openDate: string | null, today: Date = new Date()): boolean {
  if (!openDate) return false;
  const open = new Date(openDate.slice(0, 10));
  const todayMidnight = new Date(today);
  todayMidnight.setHours(0, 0, 0, 0);
  const diffMs = todayMidnight.getTime() - open.getTime();
  const diff = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return diff >= 0 && diff <= 2;  // 0=오늘, 1=어제, 2=그제
}

/**
 * "마감 임박" 정의: D-day, D-1, D-2 (3일 이내 마감).
 */
export function isClosingSoon(closeDate: string | null, today: Date = new Date()): boolean {
  if (!closeDate) return false;
  const close = new Date(closeDate.slice(0, 10));
  const todayMidnight = new Date(today);
  todayMidnight.setHours(0, 0, 0, 0);
  const diffMs = close.getTime() - todayMidnight.getTime();
  const diff = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return diff >= 0 && diff <= 2;
}

/**
 * D-day 라벨 ("D-day" / "D-1"~"D-7" / "마감" / null=7일 초과).
 * 클라이언트 컴포넌트에서도 import 할 수 있도록 도메인 유틸에 위치.
 */
export function dDayLabel(closeDate: string | null, today: Date = new Date()): string | null {
  if (!closeDate) return null;
  const close = new Date(closeDate.slice(0, 10));
  const todayMidnight = new Date(today);
  todayMidnight.setHours(0, 0, 0, 0);
  const diff = Math.round((close.getTime() - todayMidnight.getTime()) / 86400000);
  if (diff < 0) return "마감";
  if (diff === 0) return "D-day";
  if (diff <= 7) return `D-${diff}`;
  return null;
}

/**
 * "주목" (Attention) 필터 — NEW 배지 / 마감임박 배지 둘 중 하나라도 해당.
 * 컬럼명도 동일하게 사용 (table header).
 */
export const TAG_VALUES = ["new", "closing"] as const;
export type TagValue = (typeof TAG_VALUES)[number];

export const TAG_LABEL: Record<TagValue, string> = {
  new: "신규",
  closing: "마감임박",
};

/** "주목" 컬럼/필터 한국어 이름 — 필요시 한 곳만 수정하면 전체 반영 */
export const ATTENTION_LABEL = "주목";

/** 정렬 가능 컬럼 — DB 컬럼명과 매핑 */
export const SORTABLE_COLUMNS = {
  open_date: "공고일",
  close_date: "마감일",
  title: "제목",
  org_name: "기관",
  bid_type: "업종",
  estimated_price: "금액",
  source: "출처",
} as const;
export type SortColumn = keyof typeof SORTABLE_COLUMNS;
export type SortDir = "asc" | "desc";
