import { Link } from "react-router-dom";
import { ArrowRight, BarChart3 } from "lucide-react";
import { reportDefinitions } from "@/services/reports";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export function ReportsPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-muted">The 10 report types from the original spec — each links through to a coming-soon state.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reportDefinitions.map((report) => (
          <Link key={report.slug} to={`/reports/${report.slug}`}>
            <Card className="h-full transition-colors hover:border-accent/50">
              <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
                <div className="flex items-start gap-3">
                  <BarChart3 className="mt-0.5 size-4 shrink-0 text-accent" />
                  <div>
                    <CardTitle className="text-sm">{report.title}</CardTitle>
                    <CardDescription className="mt-1">{report.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex justify-end pt-0">
                <span className="inline-flex items-center gap-1 text-xs text-muted">
                  View <ArrowRight className="size-3" />
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
