import { useQuery } from "@tanstack/react-query";
import { reportSeries } from "@/pages/reports/report-series";
import { reportsService } from "@/services/reports.service";

const DAYS = 30;

function since(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * A report widget's rows and their chart shape — the same reading the
 * reports page gives, through the report's own permission-checked endpoint.
 * The tile and its expanded view share the one fetch.
 */
export function useReportWidgetData(reportId: string | undefined) {
  const from = since(DAYS);
  const query = useQuery({
    queryKey: ["reports", "data", reportId, from],
    queryFn: () => reportsService.getReportData(reportId ?? "", { from }),
    enabled: Boolean(reportId),
    staleTime: 60_000,
  });
  const rows = (query.data?.rows ?? []) as Record<string, unknown>[];
  return { ...query, rows, shape: rows.length ? reportSeries(rows) : null };
}
