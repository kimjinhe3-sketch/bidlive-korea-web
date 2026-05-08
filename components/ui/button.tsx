import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Button — KT 디자인 시스템 기반.
 *
 * variant 가이드 (DESIGN_SYSTEM.md §1-4):
 *  - default     : KT RED 프라이머리 액션 (등록·확인·로그인 등)
 *  - secondary   : 보조 액션 (취소·뒤로가기) — 모노톤
 *  - outline     : 약한 강조 — 흰 배경 + KT 보더
 *  - destructive : 위험 액션 (삭제·실주 처리) — KT RED 강도 ↑
 *  - ghost       : 인라인 액션 (아이콘 버튼)
 *  - link        : 링크형 — KT BLUE
 *  - brand       : default 와 동일 (레거시 호환)
 *  - kt-blue / kt-teal / kt-purple : 매칭 컬러 — 정보·성공·강조 액션
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-kt-red text-white hover:bg-kt-red-600 active:bg-kt-red-700",
        secondary:
          "bg-kt-light-gray/15 text-kt-black hover:bg-kt-light-gray/25",
        outline:
          "border border-kt-light-gray bg-white text-kt-black hover:bg-kt-light-gray/10",
        destructive:
          "bg-kt-red-600 text-white hover:bg-kt-red-700 active:bg-kt-red-800",
        ghost: "text-kt-dark-gray hover:bg-kt-light-gray/15",
        link: "text-kt-blue underline-offset-4 hover:underline",
        brand: "bg-kt-red text-white hover:bg-kt-red-600 active:bg-kt-red-700",
        "kt-blue": "bg-kt-blue text-white hover:bg-kt-blue/90",
        "kt-teal": "bg-kt-teal text-white hover:bg-kt-teal/90",
        "kt-purple": "bg-kt-purple text-white hover:bg-kt-purple/90",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
