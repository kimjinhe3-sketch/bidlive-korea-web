import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { getBidKpis } from "@/lib/queries/bids";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 헤더의 LIVE dot 에 표시할 마지막 수집 시각만 미리 가져옴
  let lastCollectedAt: string | null = null;
  try {
    const kpis = await getBidKpis();
    lastCollectedAt = kpis.lastCollectedAt;
  } catch {
    /* DB 미연결 / 첫 수집 전 — 무시하고 페이지 렌더 */
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header lastCollectedAt={lastCollectedAt} />
        <main className="flex-1 px-4 lg:px-8 py-6 lg:py-8 max-w-[1480px] w-full mx-auto">
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
