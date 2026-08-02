import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/hooks/useAuth";
import { ModuleProvider } from "@/hooks/useModule";
import { ThemeProvider } from "@/hooks/useTheme";
import { PeriodProvider } from "@/hooks/usePeriod";
import { RequireAuth } from "@/components/require-auth";
import { AppLayout } from "@/layouts/AppLayout";
import { AuthLayout } from "@/layouts/AuthLayout";
import { Toaster } from "@/components/toaster";
import { Login } from "@/pages/Login";
import { Dashboard } from "@/pages/Dashboard";
import { WorkersPage } from "@/pages/WorkersPage";
import { ClientsPage } from "@/pages/ClientsPage";
import { EmployeesPage } from "@/pages/EmployeesPage";
import { PayrollRunPage } from "@/pages/PayrollRunPage";
import { BillsPage } from "@/pages/BillsPage";
import { BillDetailPage } from "@/pages/BillDetailPage";
import { SalarySlipsPage } from "@/pages/SalarySlipsPage";
import { ReportsPage } from "@/pages/ReportsPage";
import { ReportDetailPage } from "@/pages/ReportDetailPage";
import { SettingsPage } from "@/pages/SettingsPage";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <ModuleProvider>
            <PeriodProvider>
              <BrowserRouter>
                <Routes>
                  <Route element={<AuthLayout />}>
                    <Route path="/login" element={<Login />} />
                  </Route>

                  <Route element={<RequireAuth />}>
                    <Route element={<AppLayout />}>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/workers" element={<WorkersPage />} />
                      <Route path="/clients" element={<ClientsPage />} />
                      <Route path="/employees" element={<EmployeesPage />} />
                      <Route path="/payroll-runs" element={<PayrollRunPage />} />
                      <Route path="/bills" element={<BillsPage />} />
                      <Route path="/bills/:id" element={<BillDetailPage />} />
                      <Route path="/salary-slips" element={<SalarySlipsPage />} />
                      <Route path="/reports" element={<ReportsPage />} />
                      <Route path="/reports/:slug" element={<ReportDetailPage />} />
                      <Route path="/settings" element={<SettingsPage />} />
                    </Route>
                  </Route>
                </Routes>
              </BrowserRouter>
              <Toaster />
            </PeriodProvider>
          </ModuleProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
