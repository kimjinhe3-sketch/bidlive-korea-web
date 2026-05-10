import { NextResponse } from "next/server";

/**
 * 수집하기 트리거 — GitHub Actions workflow_dispatch 호출.
 *
 * 필요 환경변수:
 *   GITHUB_PAT      — repo 의 actions:write 권한이 있는 fine-grained PAT
 *                     또는 classic PAT (workflow scope)
 *   GITHUB_REPO     — kimjinhe3-sketch/bid-collector  (기본값)
 *   GITHUB_WORKFLOW — daily-collect.yml             (기본값)
 *
 * GitHub Settings → Developer settings → Personal access tokens (Fine-grained)
 *   - Resource owner: 본인
 *   - Repository access: bid-collector 만 선택
 *   - Permissions: Actions = Read and write
 *
 * Vercel 또는 .env.local 에 GITHUB_PAT 으로 저장.
 */
export async function POST() {
  const pat = process.env.GITHUB_PAT;
  const repo = process.env.GITHUB_REPO ?? "kimjinhe3-sketch/bid-collector";
  const workflow = process.env.GITHUB_WORKFLOW ?? "daily-collect.yml";
  const ref = process.env.GITHUB_REF ?? "main";

  if (!pat) {
    return NextResponse.json(
      { error: "GITHUB_PAT 환경변수 미설정 — README 참조" },
      { status: 500 },
    );
  }

  const url = `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${pat}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ref }),
    cache: "no-store",
  });

  if (r.status === 204) {
    const actionsUrl = `https://github.com/${repo}/actions/workflows/${workflow}`;
    return NextResponse.json({
      ok: true,
      message: "수집 시작됨 (5~10분 후 자동 새로고침)",
      actions_url: actionsUrl,
    });
  }

  const text = await r.text();
  return NextResponse.json(
    { ok: false, error: `GitHub API ${r.status}: ${text || "unknown"}` },
    { status: r.status === 401 ? 401 : 502 },
  );
}
