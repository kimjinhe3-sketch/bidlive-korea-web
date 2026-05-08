import * as React from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-kt-light-gray bg-white px-3 py-2 text-sm text-kt-black",
          "placeholder:text-kt-light-gray",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kt-red focus-visible:ring-offset-2 focus-visible:border-kt-red",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
