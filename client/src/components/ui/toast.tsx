import * as ToastPrimitive from "@radix-ui/react-toast";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const ToastProvider = ToastPrimitive.Provider;

export function ToastViewport({ className, ...props }: ToastPrimitive.ToastViewportProps) {
  return (
    <ToastPrimitive.Viewport
      className={cn("fixed bottom-0 right-0 z-[100] flex w-full max-w-sm flex-col gap-2 p-4 outline-none", className)}
      {...props}
    />
  );
}

const VARIANT_CLASSES = {
  default: "border-border bg-surface text-foreground",
  success: "border-positive/40 bg-surface text-foreground",
  destructive: "border-danger/40 bg-surface text-foreground",
} as const;

export interface ToastRootProps extends ToastPrimitive.ToastProps {
  variant?: keyof typeof VARIANT_CLASSES;
}

export function ToastRoot({ className, variant = "default", ...props }: ToastRootProps) {
  return (
    <ToastPrimitive.Root
      className={cn("relative flex w-full items-start gap-3 rounded-md border p-4 shadow-none", VARIANT_CLASSES[variant], className)}
      {...props}
    />
  );
}

export function ToastTitle({ className, ...props }: ToastPrimitive.ToastTitleProps) {
  return <ToastPrimitive.Title className={cn("text-sm font-semibold", className)} {...props} />;
}

export function ToastDescription({ className, ...props }: ToastPrimitive.ToastDescriptionProps) {
  return <ToastPrimitive.Description className={cn("text-sm text-muted", className)} {...props} />;
}

export function ToastClose({ className, ...props }: ToastPrimitive.ToastCloseProps) {
  return (
    <ToastPrimitive.Close className={cn("absolute right-2 top-2 text-muted hover:text-foreground", className)} {...props}>
      <X className="size-3.5" />
    </ToastPrimitive.Close>
  );
}
