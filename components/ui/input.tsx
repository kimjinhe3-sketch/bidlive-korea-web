import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

/**
 * Text Field — KT 디자인 시스템 기반.
 * focus 시 KT RED 링 (--ring 토큰).
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-kt-light-gray bg-white px-3 py-2 text-sm text-kt-black ring-offset-background",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "placeholder:text-kt-light-gray",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kt-red focus-visible:ring-offset-2 focus-visible:border-kt-red",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-kt-light-gray/10",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
