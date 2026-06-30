"use client";

import { useEffect } from "react";

/**
 * 경량 방문 추적 — 관리자 일일 리포트용.
 *  - visitorId: localStorage 영구 (사람/브라우저 식별 — 고유 방문자 수)
 *  - sessionId: sessionStorage 탭 단위 (세션 — 체류시간)
 *  - 진입 시 1회 + 30초 heartbeat(보일 때만) → last_seen 갱신
 *  - 체류시간 = last_seen - started (서버에서 집계)
 * 로그인 없는 내부 대시보드라 쿠키 기반 익명 식별. 개인정보 미수집.
 */
const HEARTBEAT_MS = 30_000;

function getOrCreate(storage: Storage, key: string): string {
  let v = storage.getItem(key);
  if (!v) {
    v =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
    storage.setItem(key, v);
  }
  return v;
}

export function VisitTracker() {
  useEffect(() => {
    let visitorId: string;
    let sessionId: string;
    try {
      visitorId = getOrCreate(window.localStorage, "bidlive_visitor");
      sessionId = getOrCreate(window.sessionStorage, "bidlive_session");
    } catch {
      return; // 스토리지 차단 환경 — 추적 skip
    }

    const ping = () => {
      if (document.visibilityState !== "visible") return;
      const payload = JSON.stringify({
        visitorId,
        sessionId,
        path: window.location.pathname,
      });
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon("/api/track", new Blob([payload], { type: "application/json" }));
        } else {
          fetch("/api/track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
            keepalive: true,
          });
        }
      } catch {
        /* 무시 */
      }
    };

    ping(); // 진입 즉시
    const timer = setInterval(ping, HEARTBEAT_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") ping();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
      ping(); // 이탈 직전 마지막 갱신
    };
  }, []);

  return null;
}
