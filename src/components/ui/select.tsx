import * as React from "react";
import { cn } from "@/lib/utils";

export interface NativeSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

const Select = React.forwardRef<HTMLSelectElement, NativeSelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          "flex h-9 w-full rounded border border-[#17212B]/20 bg-[#F5F7F8] px-3 py-1 text-xs text-[#17212B] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#17212B] disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
);
Select.displayName = "Select";

export { Select };
