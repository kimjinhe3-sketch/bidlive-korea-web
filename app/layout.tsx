import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";

const ktFlow = localFont({
  src: [
    { path: "./fonts/KTFlow-Thin.ttf",   weight: "100", style: "normal" },
    { path: "./fonts/KTFlow-Medium.ttf", weight: "500", style: "normal" },
    { path: "./fonts/KTFlow-Bold.ttf",   weight: "700", style: "normal" },
    { path: "./fonts/KTFlow-Black.ttf",  weight: "900", style: "normal" },
  ],
  variable: "--font-kt-flow",
  display: "swap",
  fallback: ["system-ui", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
});

const notoSansKR = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-noto-kr",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BIDLIVE Korea | 국내 입찰공고 대시보드",
  description: "KT Engineering — 국내 입찰공고 일별 수집 및 분석 대시보드",
  applicationName: "BIDLIVE Korea",
  icons: {
    icon: "/logos/kt-engineering-light.png",
    apple: "/logos/kt-engineering-light.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#FE2E36",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ko"
      className={`${ktFlow.variable} ${notoSansKR.variable}`}
      suppressHydrationWarning
    >
      <body
        className="font-sans antialiased min-h-screen bg-background text-foreground"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
