// Billing → Charges needing attention: automatic charges a clinical action
// (diet order, OT completion, ER registration, …) could not post, and lab
// tests, imaging and procedures done for a patient that no bill carries. The
// desk posts each one onto the bill or dismisses it with a reason, so nothing
// done for a patient goes unbilled without someone deciding so. Largest
// amount first, with the ₹ total of the open work at the top.

import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import {
  type ChargeAttentionItem,
  type ChargeAttentionKind,
  type ChargeAttentionStatus,
  P,
} from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DataTable } from "@/components";
import { SegmentedControl, toast } from "@/components/ui";
import { billingService } from "@/services/billing.service";
import { ChargeAttentionTotal } from "./ChargeAttentionTotal";
import { type ChargeAttentionAction, chargeAttentionColumns } from "./charge-attention-columns";
import { DismissChargeModal } from "./DismissChargeModal";

type StatusFilter = ChargeAttentionStatus | "all";
type KindFilter = ChargeAttentionKind | "all";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "open", label: "Needs attention" },
  { value: "posted", label: "Posted" },
  { value: "dismissed", label: "Dismissed" },
  { value: "all", label: "All" },
];

const KIND_OPTIONS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unbilled", label: "Done, not billed" },
  { value: "failed", label: "Could not post" },
];

const PAGE_SIZE = 25;

/** The queue: total, filters, the list, post and dismiss — each gated by kind. */
export function ChargeAttentionTab() {
  const canViewFailed = useHasPermission(P.BILLING.CHARGE_ATTENTION.VIEW);
  const canViewUnbilled = useHasPermission(P.BILLING.LEAKAGE.VIEW);
  const canResolve = useHasPermission(P.BILLING.CHARGE_ATTENTION.RESOLVE);
  const canResolveUnbilled = useHasPermission(P.BILLING.LEAKAGE.RESOLVE);
  const canView = canViewFailed || canViewUnbilled;
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>("open");
  const [kindChoice, setKindChoice] = useState<KindFilter>("all");
  const [page, setPage] = useState(1);
  const [dismissing, setDismissing] = useState<ChargeAttentionItem | null>(null);
  // A viewer of one kind only sees that kind; the filter shows only for both.
  const kind: ChargeAttentionKind | null = !canViewFailed
    ? "unbilled"
    : !canViewUnbilled
      ? "failed"
      : kindChoice === "all"
        ? null
        : kindChoice;

  const params = useMemo(() => {
    const p: Record<string, string> = { page: String(page), limit: String(PAGE_SIZE) };
    if (status !== "all") p.status = status;
    if (kind) p.kind = kind;
    return p;
  }, [page, status, kind]);

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

  const summaryParams = kind ? { kind } : undefined;
  const summary = useQuery({
    queryKey: ["billing", "charge-attention", "summary", kind],
    queryFn: () => billingService.chargeAttentionSummary(summaryParams),
    enabled: canView,
  });
  const amountsHidden = summary.data?.open_amount === null;

  const columns = useMemo(
    () =>
      chargeAttentionColumns({
        canResolve,
        canResolveUnbilled,
        amountsHidden,
        pendingId: post.isPending ? (post.variables ?? null) : null,
        onAction: (action: ChargeAttentionAction, item) =>
          action === "post" ? post.mutate(item.id) : setDismissing(item),
      }),
    [canResolve, canResolveUnbilled, amountsHidden, post.isPending, post.variables, post.mutate],
  );

  if (!canView) return null;

  return (
    <Stack>
      <ChargeAttentionTotal
        kind={kind}
        summary={summary.data}
        error={summary.error}
        onRetry={() => summary.refetch()}
        canScan={canResolveUnbilled}
      />
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
        {canViewFailed && canViewUnbilled && (
          <SegmentedControl
            aria-label="Kind of charge"
            data={KIND_OPTIONS}
            value={kindChoice}
            onChange={(value) => {
              setKindChoice(value as KindFilter);
              setPage(1);
            }}
          />
        )}
      </Group>
      <Text size="sm" c="dimmed">
        Care given that the bill did not follow: orders done but never charged, and charges a
        clinical action could not post. Post each one, or dismiss it with a reason.
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
