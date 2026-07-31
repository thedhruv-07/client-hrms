import * as React from "react";
import { cn } from "@/lib/utils";

export type StampTone = "ink" | "seal" | "positive" | "danger";

export interface StampBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: StampTone;
}

const TONE_CLASSES: Record<StampTone, string> = {
  ink: "border-foreground/60 text-foreground",
  seal: "border-accent text-accent",
  positive: "border-positive text-positive",
  danger: "border-danger text-danger",
};

/**
 * The app's one signature element: status shown as a stamped seal mark
 * (Paid / Pending / Generated / Draft), not a generic colored pill. Use
 * this only for those lifecycle statuses — everything else uses <Badge>.
 */
export function StampBadge({ tone = "ink", className, children, ...props }: StampBadgeProps) {
  return (
    <span
      className={cn(
        "relative inline-flex -rotate-3 items-center justify-center rounded-full border-2 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.15em]",
        "before:absolute before:inset-[3px] before:rounded-full before:border before:border-current before:opacity-40",
        TONE_CLASSES[tone],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
