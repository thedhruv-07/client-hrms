import { ToastProvider, ToastViewport, ToastRoot, ToastTitle, ToastDescription, ToastClose } from "@/components/ui/toast";
import { useToasts, dismissToast } from "@/hooks/use-toast";

export function Toaster() {
  const toasts = useToasts();
  return (
    <ToastProvider swipeDirection="right">
      {toasts.map((t) => (
        <ToastRoot
          key={t.id}
          variant={t.variant}
          onOpenChange={(open) => {
            if (!open) dismissToast(t.id);
          }}
        >
          <div className="flex-1">
            {t.title ? <ToastTitle>{t.title}</ToastTitle> : null}
            {t.description ? <ToastDescription>{t.description}</ToastDescription> : null}
          </div>
          <ToastClose />
        </ToastRoot>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}
