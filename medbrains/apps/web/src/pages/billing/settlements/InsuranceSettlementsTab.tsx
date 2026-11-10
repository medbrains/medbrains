// Billing → Insurance settlements: insurer money waiting to be posted
// against its bill. Finance reviews claim vs bill vs settlement and
// approves or rejects; nothing reaches a bill without that second person.

import { Group, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useAuthStore, useHasPermission } from "@medbrains/stores";
import { type ClaimSettlementPosting, type ClaimSettlementStatus, P } from "@medbrains/types";
import { IconDatabaseImport, IconPlus } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DataTable } from "@/components";
import { Button, SegmentedControl } from "@/components/ui";
import { billingService } from "@/services/billing.service";
import { BackfillModal } from "./BackfillModal";
import { type DecisionKind, DecisionModal } from "./DecisionModal";
import { RecordSettlementModal } from "./RecordSettlementModal";
import { settlementColumns } from "./settlement-columns";

type StatusFilter = ClaimSettlementStatus | "all";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "reversed", label: "Reversed" },
  { value: "all", label: "All" },
];

const PAGE_SIZE = 25;

export function InsuranceSettlementsTab() {
  const canRecord = useHasPermission(P.BILLING.CLAIMS.SETTLEMENT.RECORD);
  const canApprove = useHasPermission(P.BILLING.CLAIMS.SETTLEMENT.APPROVE);
  const canReverse = useHasPermission(P.BILLING.CLAIMS.SETTLEMENT.REVERSE);
  const canBackfill = useHasPermission(P.BILLING.CLAIMS.SETTLEMENT.BACKFILL);
  const userId = useAuthStore((s) => s.user?.id);
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [page, setPage] = useState(1);
  const [decision, setDecision] = useState<{
    kind: DecisionKind;
    posting: ClaimSettlementPosting;
  } | null>(null);
  const [recordOpened, recordModal] = useDisclosure(false);
  const [backfillOpened, backfillModal] = useDisclosure(false);

  const params = useMemo(() => {
    const p: Record<string, string> = { page: String(page), limit: String(PAGE_SIZE) };
    if (status !== "all") p.status = status;
    return p;
  }, [page, status]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["billing", "claim-settlements", params],
    queryFn: () => billingService.listClaimSettlements(params),
    enabled: canRecord || canApprove,
  });

  const columns = useMemo(
    () =>
      settlementColumns({
        userId,
        canApprove,
        canReverse,
        onDecide: (kind, posting) => setDecision({ kind, posting }),
      }),
    [userId, canApprove, canReverse],
  );

  return (
    <Stack>
      <Group justify="space-between" wrap="wrap">
        <SegmentedControl
          aria-label="Settlement status"
          data={STATUS_OPTIONS}
          value={status}
          onChange={(value) => {
            setStatus(value as StatusFilter);
            setPage(1);
          }}
        />
        <Group gap="xs">
          {canBackfill && (
            <Button
              tone="secondary"
              leftSection={<IconDatabaseImport size={16} />}
              onClick={backfillModal.open}
            >
              File past settlements
            </Button>
          )}
          {canRecord && (
            <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={recordModal.open}>
              Record settlement
            </Button>
          )}
        </Group>
      </Group>
      <Text size="sm" c="dimmed">
        Insurer payments wait here until someone other than the person who recorded them approves
        them. Approving posts the payment on the bill; the patient's share stays owing.
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
        emptyTitle={status === "pending" ? "No settlements waiting" : "No settlements"}
        caption="Insurance settlements"
        captionVisuallyHidden
      />
      {decision && (
        <DecisionModal
          kind={decision.kind}
          posting={decision.posting}
          onClose={() => setDecision(null)}
        />
      )}
      <RecordSettlementModal opened={recordOpened} onClose={recordModal.close} />
      <BackfillModal opened={backfillOpened} onClose={backfillModal.close} />
    </Stack>
  );
}
