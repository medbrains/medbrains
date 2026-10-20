import { Group, Stack, Text } from "@mantine/core";
import { useAuthStore } from "@medbrains/stores";
import type { PayoutStatement } from "@medbrains/types";
import { IconCheck } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { Alert, Button, toast } from "@/components/ui";
import { doctorPayoutsService } from "@/services/doctor-payouts.service";
import { errorText, rupees } from "./shared";
import { StatementDrawer } from "./statement-drawer";
import { statementColumns } from "./statements-tab";

/**
 * Drafts waiting for a finance approver. Maker-checker: whoever prepared
 * (or last adjusted) a statement cannot approve it — the server refuses,
 * and the button says so before anyone tries.
 */
export function ApprovalsTab() {
  const me = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const drafts = useQuery({
    queryKey: ["doctor-payouts", "statements", "draft"],
    queryFn: () => doctorPayoutsService.listPayoutStatements("draft"),
  });
  const approve = useMutation({
    mutationFn: (id: string) => doctorPayoutsService.approvePayoutStatement(id),
    onSuccess: (s) => {
      void queryClient.invalidateQueries({ queryKey: ["doctor-payouts", "statements"] });
      toast.success(`TDS ${rupees(s.tds_amount)}; ${rupees(s.net_payable)} to pay.`, {
        title: "Approved",
      });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Not approved" }),
  });
  const columns = [
    ...statementColumns,
    {
      key: "approve",
      label: "",
      render: (s: PayoutStatement) =>
        s.prepared_by === me ? (
          <Text size="xs" c="dimmed">
            You prepared this
          </Text>
        ) : (
          <Button
            size="xs"
            leftSection={<IconCheck size={14} />}
            loading={approve.isPending && approve.variables === s.id}
            onClick={(e) => {
              e.stopPropagation();
              approve.mutate(s.id);
            }}
          >
            Approve
          </Button>
        ),
    },
  ];
  return (
    <Stack gap="sm">
      <Group>
        <Text size="sm" c="dimmed">
          Approving computes TDS on the doctor's aggregate for the year and makes the statement
          payable.
        </Text>
      </Group>
      {drafts.isError ? (
        <Alert tone="danger" title="Drafts could not be loaded">
          {errorText(drafts.error)}
        </Alert>
      ) : (
        <DataTable
          columns={columns}
          data={drafts.data ?? []}
          loading={drafts.isLoading}
          rowKey={(s) => s.id}
          onRowClick={(s) => setOpenId(s.id)}
          emptyTitle="Nothing waiting for approval"
        />
      )}
      <StatementDrawer statementId={openId} onClose={() => setOpenId(null)} />
    </Stack>
  );
}
