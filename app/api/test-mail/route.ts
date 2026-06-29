import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

/**
 * 테스트 메일 즉시 발송 — POST { email }
 * 우선순위: SMTP_HOST 있으면 SMTP (Gmail/사내, 누구에게나), 없으면 Resend (본인 주소만).
 *
 * 환경변수 (Cloudtype):
 *   [SMTP]   SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS
 *   [Resend] RESEND_API_KEY
 *   MAIL_FROM  "공공입찰 정보 알림 <...>"
 */
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 요청" }, { status: 200 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "이메일 형식 오류" }, { status: 200 });
  }

  const from = process.env.MAIL_FROM || "공공입찰 정보 알림 <onboarding@resend.dev>";
  const now = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  const subject = "[공공입찰] 테스트 메일 — 수신 확인";
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f5f5f5;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#fff;">
    <div style="background:#1a1a1a;padding:18px 20px;">
      <span style="color:#fff;font-size:16px;font-weight:800;">공공입찰 수집 시스템</span>
    </div>
    <div style="padding:24px 20px;">
      <h2 style="margin:0 0 10px;font-size:18px;color:#1a1a1a;">✅ 테스트 메일 수신 성공</h2>
      <p style="color:#444;font-size:14px;line-height:1.6;">
        이 메일을 받으셨다면 알림 발송이 정상 동작합니다.<br>
        실제 알림은 매일 오전 8시에 신규/마감/키워드 공고 요약으로 발송됩니다.
      </p>
      <p style="color:#aaa;font-size:12px;margin-top:16px;">발송 시각: ${now} (KST)</p>
    </div>
    <div style="padding:14px 20px;border-top:1px solid #eee;text-align:center;color:#aaa;font-size:11px;">
      공공입찰 수집 시스템 · 테스트 메일
    </div>
  </div>
</body></html>`;

  const smtpHost = process.env.SMTP_HOST;
  const resendKey = process.env.RESEND_API_KEY;

  // 1) SMTP 우선 (누구에게나 발송 가능)
  if (smtpHost) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(process.env.SMTP_PORT || 587),
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      await transporter.sendMail({ from, to: email, subject, html });
      return NextResponse.json({ ok: true, email, via: "smtp" });
    } catch (e) {
      return NextResponse.json(
        { ok: false, error: `SMTP 발송 실패: ${e instanceof Error ? e.message : "오류"}` },
        { status: 200 },
      );
    }
  }

  // 2) Resend 폴백 (도메인 미인증 시 본인 주소만)
  if (resendKey) {
    try {
      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [email], subject, html }),
      });
      if (resp.status === 200 || resp.status === 201) {
        const data = await resp.json().catch(() => ({}));
        return NextResponse.json({ ok: true, email, id: data.id ?? null, via: "resend" });
      }
      const text = await resp.text();
      return NextResponse.json(
        { ok: false, error: `Resend ${resp.status}: ${text.slice(0, 200)}` },
        { status: 200 },
      );
    } catch (e) {
      return NextResponse.json(
        { ok: false, error: e instanceof Error ? e.message : "발송 실패" },
        { status: 200 },
      );
    }
  }

  return NextResponse.json(
    { ok: false, error: "SMTP_HOST / RESEND_API_KEY 둘 다 미설정 (Cloudtype 환경변수 확인)" },
    { status: 200 },
  );
}
