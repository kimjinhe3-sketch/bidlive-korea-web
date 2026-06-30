-- 관리자 일일 리포트용 — 방문 추적 + 구독 해지 시각
-- Supabase SQL Editor 에서 1회 실행

-- 1) 방문 추적 (세션 단위 1행, heartbeat 로 last_seen_at 갱신)
CREATE TABLE IF NOT EXISTS site_visits (
  id           BIGSERIAL PRIMARY KEY,
  visitor_id   TEXT NOT NULL,          -- 영구 쿠키 (고유 방문자 식별)
  session_id   TEXT NOT NULL UNIQUE,   -- 탭 세션 (체류시간 단위)
  path         TEXT,
  user_agent   TEXT,
  started_at   TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_visits_started ON site_visits(started_at);
CREATE INDEX IF NOT EXISTS idx_visits_visitor ON site_visits(visitor_id);

-- service_role 만 접근 (anon 차단). API route 가 admin client 사용.
ALTER TABLE site_visits ENABLE ROW LEVEL SECURITY;

-- 2) 구독 해지 시각 (증감 계산용)
ALTER TABLE bid_subscribers ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ;
