import { ReportWidgetChart } from "./ReportWidgetChart";
import { useReportWidgetData } from "./useReportWidgetData";

/** A report widget's body on the dashboard. */
export function ReportWidgetTile({ reportId }: { reportId: string | undefined }) {
  const { shape, isLoading, isError } = useReportWidgetData(reportId);
  return <ReportWidgetChart shape={shape} loading={isLoading} failed={isError} />;
}
