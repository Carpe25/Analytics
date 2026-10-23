import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-[#17212B]",
  {
    variants: {
      variant: {
        default: "border-transparent bg-[#17212B] text-[#F5F7F8]",
        secondary: "border-[#17212B]/20 bg-[#17212B]/10 text-[#17212B]",
        outline: "border-[#17212B]/40 text-[#17212B]",
        ghost: "border-transparent text-[#17212B]/75 bg-[#17212B]/5",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
