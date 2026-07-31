import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Construction } from "lucide-react";
import { reportDefinitions } from "@/services/reports";
import { Card, CardContent } from "@/components/ui/card";

export function ReportDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const report = reportDefinitions.find((r) => r.slug === slug);

  return (
    <div className="flex flex-col gap-4">
      <Link to="/reports" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" />
        Back to Reports
      </Link>

      <Card className="max-w-xl">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <Construction className="size-8 text-accent" />
          <h1 className="font-display text-xl font-semibold">{report?.title ?? "Report"}</h1>
          <p className="max-w-sm text-sm text-muted">{report?.description}</p>
          <p className="mt-2 text-xs text-muted">
            Coming soon — backed by <code className="figure">GET /reports/{slug}</code> on the real API (server/src/routes/reports.ts).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
