import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, onWheel, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      // Chrome/Firefox change a *focused* number input's value on mouse-wheel scroll even
      // with the spinner arrows hidden — blur it first so scrolling the page never silently
      // edits whatever number field happens to be focused underneath the cursor.
      onWheel={type === "number" ? (e) => { e.currentTarget.blur(); onWheel?.(e); } : onWheel}
      className={cn(
        "flex h-9 w-full rounded-sm border border-border bg-surface px-3 py-1 text-sm text-foreground placeholder:text-muted",
        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50",
        // Hide the native number spinner in all browsers — [type=number] only, harmless on other input types.
        "[-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
