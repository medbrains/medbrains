import { Skeleton } from "@mantine/core";
import { lazy, Suspense } from "react";
import { useReportWidgetData } from "./useReportWidgetData";

// The chart code (recharts) loads after the dashboard has drawn.
const ReportWidgetChart = lazy(() =>
  import("./ReportWidgetChart").then((m) => ({ default: m.ReportWidgetChart })),
);
const CHART_LOADING_HEIGHT = 160;

/** A report widget's body on the dashboard; its chart is fetched on first draw. */
export function ReportWidgetTile({
  reportId,
  stacked,
}: {
  reportId: string | undefined;
  stacked?: boolean;
}) {
  const { shape, isLoading, isError } = useReportWidgetData(reportId);
  return (
    <Suspense fallback={<Skeleton height={CHART_LOADING_HEIGHT} />}>
      <ReportWidgetChart shape={shape} loading={isLoading} failed={isError} stacked={stacked} />
    </Suspense>
  );
}
