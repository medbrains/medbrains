import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui";

/**
 * Whether a report's chart is on the reader's own dashboard, and the toggle
 * that puts it there or takes it off — the same chart, in either place.
 */
export function useReportOnDashboard(reportId: string) {
  const canPlace = useHasPermission(P.DASHBOARD.VIEW);
  const queryClient = useQueryClient();
  const { data: mine } = useQuery({
    queryKey: ["my-dashboard"],
    queryFn: () => api.getMyDashboard(),
    staleTime: 120_000,
    enabled: canPlace,
  });
  const placed = (mine?.widgets ?? []).some(
    (w) => w.data_source?.type === "report" && w.data_source.report_id === reportId,
  );
  const toggle = useMutation({
    mutationFn: () => api.setMyReportWidget(reportId, !placed),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["my-dashboard"] });
      toast.success(placed ? "Removed from your dashboard" : "Added to your dashboard");
    },
    onError: () => toast.error("Could not change your dashboard. Try again."),
  });
  return { canPlace, placed, onToggle: () => toggle.mutate() };
}
