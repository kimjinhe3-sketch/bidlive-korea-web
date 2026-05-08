import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",

        /* ==========================================================
         * KT 브랜드 컬러 (design/Brand Color.png 정합)
         * ========================================================== */
        kt: {
          red: {
            DEFAULT: "#FE2E36", // 디지털 표준 (Brand Color.png)
            bi: "#ED2024", // BI 인쇄 표준 (BI_1.png, Pantone 1795C)
            50: "#FFE5E6",
            100: "#FFCCCE",
            200: "#FF999D",
            300: "#FF666C",
            400: "#FF4046",
            500: "#FE2E36", // === DEFAULT
            600: "#E5111A",
            700: "#B30D14",
            800: "#80090E",
            900: "#4D0508",
          },
          purple: { DEFAULT: "#AA50FF" },
          blue: { DEFAULT: "#00A5FF" },
          teal: { DEFAULT: "#00BEAC" },
          black: "#000000",
          "dark-gray": "#4C4C4E",
          "light-gray": "#A2A4A3",
          white: "#FFFFFF",
        },

        /* shadcn/ui 시맨틱 토큰 — 내부적으로 KT 컬러를 가리킴 */
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        /* 레거시 별칭 (기존 코드 호환) — KT RED 기반으로 재매핑 */
        brand: {
          DEFAULT: "#FE2E36",
          foreground: "#FFFFFF",
          50: "#FFE5E6",
          100: "#FFCCCE",
          200: "#FF999D",
          300: "#FF666C",
          400: "#FF4046",
          500: "#FE2E36",
          600: "#E5111A",
          700: "#B30D14",
          800: "#80090E",
          900: "#4D0508",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        /* KT Flow (라틴 우선) → Noto Sans KR (한글 fallback) → 시스템 */
        sans: [
          "var(--font-kt-flow)",
          "var(--font-noto-kr)",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
        kt: ["var(--font-kt-flow)", "system-ui", "sans-serif"],
        noto: ["var(--font-noto-kr)", "system-ui", "sans-serif"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
