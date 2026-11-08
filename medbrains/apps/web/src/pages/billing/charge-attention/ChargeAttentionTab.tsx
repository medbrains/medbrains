// Billing → Charges needing attention: automatic charges a clinical action
// (diet order, OT completion, ER registration, …) could not post. The desk
// posts each one onto the bill or dismisses it with a reason, so nothing done
// for a patient goes unbilled without someone deciding so. The first tile of
// the revenue-leakage view.

import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { type ChargeAttentionItem, type ChargeAttentionStatus, P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DataTable } from "@/components";
import { SegmentedControl, toast } from "@/components/ui";
import { billingService } from "@/services/billing.service";
import { type ChargeAttentionAction, chargeAttentionColumns } from "./charge-attention-columns";
import { DismissChargeModal } from "./DismissChargeModal";

type StatusFilter = ChargeAttentionStatus | "all";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "open", label: "Needs attention" },
  { value: "posted", label: "Posted" },
  { value: "dismissed", label: "Dismissed" },
  { value: "all", label: "All" },
];

const PAGE_SIZE = 25;

/** The queue: status filter, the list, post and dismiss — gated on view and resolve. */
export function ChargeAttentionTab() {
  const canView = useHasPermission(P.BILLING.CHARGE_ATTENTION.VIEW);
  const canResolve = useHasPermission(P.BILLING.CHARGE_ATTENTION.RESOLVE);
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>("open");
  const [page, setPage] = useState(1);
  const [dismissing, setDismissing] = useState<ChargeAttentionItem | null>(null);

  const params = useMemo(() => {
    const p: Record<string, string> = { page: String(page), limit: String(PAGE_SIZE) };
    if (status !== "all") p.status = status;
    return p;
  }, [page, status]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["billing", "charge-attention", params],
    queryFn: () => billingService.listChargeAttention(params),
    enabled: canView,
  });

  const post = useMutation({
    mutationFn: (id: string) => billingService.postChargeAttention(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing"] });
      toast.success("Charge posted to the bill");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const columns = useMemo(
    () =>
      chargeAttentionColumns({
        canResolve,
        pendingId: post.isPending ? (post.variables ?? null) : null,
        onAction: (kind: ChargeAttentionAction, item) =>
          kind === "post" ? post.mutate(item.id) : setDismissing(item),
      }),
    [canResolve, post.isPending, post.variables, post.mutate],
  );

  return (
    <Stack>
      <Group justify="space-between" wrap="wrap">
        <SegmentedControl
          aria-label="Charge status"
          data={STATUS_OPTIONS}
          value={status}
          onChange={(value) => {
            setStatus(value as StatusFilter);
            setPage(1);
          }}
        />
      </Group>
      <Text size="sm" c="dimmed">
        Charges a clinical action raised but could not post. The care went ahead; the bill did not
        follow. Post each one, or dismiss it with a reason.
      </Text>
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        loading={isLoading}
        error={error}
        onRetry={() => refetch()}
        total={data?.meta.total}
        page={page}
        perPage={PAGE_SIZE}
        totalPages={data ? Math.max(1, Math.ceil(data.meta.total / PAGE_SIZE)) : 1}
        onPageChange={setPage}
        rowKey={(row) => row.id}
        emptyTitle={status === "open" ? "No charges need attention" : "No charges"}
        caption="Charges needing attention"
        captionVisuallyHidden
      />
      {dismissing && <DismissChargeModal item={dismissing} onClose={() => setDismissing(null)} />}
    </Stack>
  );
}
