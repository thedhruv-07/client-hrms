import { useQuery } from "@tanstack/react-query";
import { Users, Wallet, CalendarCheck, Clock, CheckCircle2, Receipt, FileText } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { useModule } from "@/hooks/useModule";
import { getDashboardStats, getPayrollTrend, getRecentActivity } from "@/services/dashboard";
import { StatCard, StatCardSkeleton } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatNumber } from "@/lib/format";

function ActivitySkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="mt-1.5 h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Dashboard() {
  const { module } = useModule();

  const statsQuery = useQuery({ queryKey: ["dashboard-stats", module], queryFn: () => getDashboardStats(module) });
  const trendQuery = useQuery({ queryKey: ["dashboard-trend", module], queryFn: () => getPayrollTrend(module) });
  const activityQuery = useQuery({ queryKey: ["dashboard-activity"], queryFn: () => getRecentActivity() });

  const stats = statsQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted">{module === "CONTRACT" ? "Contract Billing" : "In-House Payroll"} overview</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {statsQuery.isLoading || !stats ? (
          Array.from({ length: 7 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard label={module === "CONTRACT" ? "Total Workers" : "Total Employees"} value={formatNumber(stats.totalEmployees)} icon={Users} />
            <StatCard label="Monthly Salary" value={formatCurrency(stats.monthlySalary)} icon={Wallet} />
            <StatCard
              label="Today's Attendance"
              value={`${stats.todaysAttendance.present}/${stats.todaysAttendance.total}`}
              icon={CalendarCheck}
            />
            <StatCard label="Pending Salary" value={formatCurrency(stats.pendingSalary)} icon={Clock} tone={stats.pendingSalary > 0 ? "danger" : "default"} />
            <StatCard label="Salary Paid" value={formatCurrency(stats.salaryPaid)} icon={CheckCircle2} tone="positive" />
            {module === "CONTRACT" ? (
              <StatCard label="Bills Generated" value={formatNumber(stats.billsGenerated)} icon={Receipt} />
            ) : (
              <StatCard label="Salary Slips Generated" value={formatNumber(stats.salarySlipsGenerated)} icon={FileText} />
            )}
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Payroll cost — last 6 months</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            {trendQuery.isLoading || !trendQuery.data ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={trendQuery.data} margin={{ left: 8, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} stroke="var(--color-border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--color-muted)" }} axisLine={{ stroke: "var(--color-border)" }} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 12, fill: "var(--color-muted)" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => formatCurrency(v)}
                    width={72}
                  />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value))}
                    contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 12 }}
                  />
                  <Bar dataKey="total" fill="var(--color-accent)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            {activityQuery.isLoading || !activityQuery.data ? (
              <ActivitySkeleton />
            ) : (
              <ul className="flex flex-col gap-3">
                {activityQuery.data.map((entry) => (
                  <li key={entry.id} className="flex items-start gap-3 text-sm">
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-border/20 font-mono text-[10px] uppercase text-muted">
                      {entry.action.slice(0, 2)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate">
                        <span className="font-medium">{entry.userName}</span> {entry.action.toLowerCase()}d {entry.entityType}
                      </p>
                      <p className="text-xs text-muted">{new Date(entry.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
