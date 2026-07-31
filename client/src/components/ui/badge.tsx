import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-medium", {
  variants: {
    variant: {
      default: "border-border bg-border/30 text-foreground",
      accent: "border-accent/40 bg-accent/10 text-accent",
      positive: "border-positive/40 bg-positive/10 text-positive",
      danger: "border-danger/40 bg-danger/10 text-danger",
    },
  },
  defaultVariants: { variant: "default" },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}
