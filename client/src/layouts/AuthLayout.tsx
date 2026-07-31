import { Outlet } from "react-router-dom";

export function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-display text-2xl font-semibold text-foreground">Ledger HRMS</h1>
          <p className="mt-1 text-sm text-muted">Payroll &amp; Contract-Labour Billing</p>
        </div>
        <div className="rounded-md border border-border bg-surface p-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
