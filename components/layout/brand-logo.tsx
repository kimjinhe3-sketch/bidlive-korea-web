import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * KT Engineering CI 로고 (DESIGN_SYSTEM 3-2).
 *  - light : kt 검정 + engineering 빨강
 *  - dark  : 전체 빨강 (사이드바 어두운 surface 위)
 *
 * 색상·비율 임의 변경 금지. 최소 높이 24px, 좌우 padding 12~16px.
 */
export function BrandLogo({
  className,
  variant = "light",
  size = "md",
  withSubtitle = true,
}: {
  className?: string;
  variant?: "light" | "dark";
  size?: "sm" | "md" | "lg";
  withSubtitle?: boolean;
}) {
  const heightPx = size === "sm" ? 20 : size === "lg" ? 36 : 28;
  const src =
    variant === "dark"
      ? "/logos/kt-engineering-dark.png"
      : "/logos/kt-engineering-light.png";

  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <div className="flex items-center" style={{ height: heightPx }}>
        <Image
          src={src}
          alt="kt engineering"
          width={heightPx * 5}
          height={heightPx}
          priority
          style={{ height: heightPx, width: "auto" }}
        />
      </div>
      {withSubtitle && (
        <span
          className={cn(
            "text-[10px] font-medium tracking-tight",
            variant === "dark" ? "text-white/70" : "text-kt-dark-gray",
          )}
        >
          공공입찰 수집 시스템
        </span>
      )}
    </div>
  );
}
