-- 메일 알림 구독자 테이블
-- Supabase SQL Editor 에서 1회 실행

CREATE TABLE IF NOT EXISTS bid_subscribers (
  id                 BIGSERIAL PRIMARY KEY,
  email              TEXT       NOT NULL UNIQUE,
  active             BOOLEAN    DEFAULT TRUE,
  unsubscribe_token  TEXT       UNIQUE,
  -- (선택) 키워드 / 필터 — JSON 형태로 자유 확장
  preferences        JSONB      DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  last_sent_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_subscribers_active ON bid_subscribers(active) WHERE active = TRUE;

-- RLS — anon 은 insert 만 가능 (UI 등록), select/update 는 service_role 만
ALTER TABLE bid_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert" ON bid_subscribers;
CREATE POLICY "anon_insert" ON bid_subscribers
  FOR INSERT TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "anon_upsert" ON bid_subscribers;
CREATE POLICY "anon_upsert" ON bid_subscribers
  FOR UPDATE TO anon
  USING (true) WITH CHECK (true);

-- service_role 은 모든 권한 (수집 cron 의 이메일 발송 시 select 용)
