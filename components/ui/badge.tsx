import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-kt-red text-white",
        secondary: "border-transparent bg-kt-light-gray/20 text-kt-dark-gray",
        outline: "border-kt-light-gray text-kt-dark-gray",
        teal: "border-kt-teal/20 bg-kt-teal/10 text-kt-teal",
        blue: "border-kt-blue/20 bg-kt-blue/10 text-kt-blue",
        purple: "border-kt-purple/20 bg-kt-purple/10 text-kt-purple",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
