import { ReportWidgetChart } from "./ReportWidgetChart";
import { useReportWidgetData } from "./useReportWidgetData";

/** A report widget's body on the dashboard. */
export function ReportWidgetTile({
  reportId,
  stacked,
}: {
  reportId: string | undefined;
  stacked?: boolean;
}) {
  const { shape, isLoading, isError } = useReportWidgetData(reportId);
  return <ReportWidgetChart shape={shape} loading={isLoading} failed={isError} stacked={stacked} />;
}
