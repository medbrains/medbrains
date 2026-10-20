import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack, Text } from "@mantine/core";
import { P, type PayoutStatement } from "@medbrains/types";
import { IconChartBar } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { DataTable } from "@/components";
import { PageHeader } from "@/components/PageHeader";
import { Alert, Button, Input, Modal } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { doctorPayoutsService } from "@/services/doctor-payouts.service";
import { ledgerColumns } from "./doctor-payouts/ledger-tab";
import { errorText, monthStartIso, rupees, todayIso } from "./doctor-payouts/shared";
import { statementColumns } from "./doctor-payouts/statements-tab";

export const myDisputeSchema = z.object({ reason: z.string().trim().min(5, "Say what is wrong") });

function DisputeModal({
  statement,
  onClose,
}: {
  statement: PayoutStatement | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { control, handleSubmit, reset } = useForm<z.infer<typeof myDisputeSchema>>({
    resolver: zodResolver(myDisputeSchema),
    defaultValues: { reason: "" },
  });
  const dispute = useMutation({
    mutationFn: (v: z.infer<typeof myDisputeSchema>) =>
      doctorPayoutsService.disputeMyPayoutStatement(statement?.id ?? "", v.reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["my-earnings"] });
      reset();
      onClose();
    },
  });
  return (
    <Modal opened={Boolean(statement)} onClose={onClose} title="Dispute this statement">
      <Stack gap="sm" component="form" onSubmit={handleSubmit((v) => dispute.mutate(v))}>
        <Text size="sm">Finance reviews it and issues a corrected version before it is paid.</Text>
        <Controller
          control={control}
          name="reason"
          render={({ field, fieldState }) => (
            <Input label="What is wrong" {...field} error={fieldState.error?.message} />
          )}
        />
        {dispute.isError && <Alert tone="danger">{errorText(dispute.error)}</Alert>}
        <Group justify="flex-end">
          <Button type="submit" loading={dispute.isPending}>
            Send dispute
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

/** A doctor's own earnings and statements — never anyone else's. */
export function MyEarningsPage() {
  useRequirePermission(P.DOCTOR_PAYOUTS.SELF_SERVICE.VIEW);
  const [from, setFrom] = useState(monthStartIso());
  const [to, setTo] = useState(todayIso());
  const [disputing, setDisputing] = useState<PayoutStatement | null>(null);
  const ledger = useQuery({
    queryKey: ["my-earnings", "ledger", from, to],
    queryFn: () => doctorPayoutsService.getMyEarnings(from, to),
  });
  const statements = useQuery({
    queryKey: ["my-earnings", "statements"],
    queryFn: () => doctorPayoutsService.getMyPayoutStatements(),
  });
  const total = (ledger.data ?? []).reduce((sum, r) => sum + Number(r.amount), 0);
  const columns = [
    ...statementColumns,
    {
      key: "dispute",
      label: "",
      render: (s: PayoutStatement) =>
        s.status === "draft" ? (
          <Button size="xs" tone="secondary" onClick={() => setDisputing(s)}>
            Dispute
          </Button>
        ) : null,
    },
  ];
  return (
    <Stack gap="md">
      <PageHeader
        title="My earnings"
        icon={<IconChartBar size={20} />}
        description="What you earned, line by line, and your statements."
      />
      <Group align="flex-end">
        <Input
          type="date"
          label="From"
          value={from}
          onChange={(e) => setFrom(e.currentTarget.value)}
        />
        <Input type="date" label="To" value={to} onChange={(e) => setTo(e.currentTarget.value)} />
        {ledger.data && (
          <Text>
            Earned in this period: <strong>{rupees(String(total))}</strong>
          </Text>
        )}
      </Group>
      {ledger.isError ? (
        <Alert tone="danger" title="Your earnings could not be loaded">
          {errorText(ledger.error)} This is not a statement that you earned nothing.
        </Alert>
      ) : (
        <DataTable
          columns={ledgerColumns(false)}
          data={ledger.data ?? []}
          loading={ledger.isLoading}
          rowKey={(r) => r.id}
          emptyTitle="Nothing earned in this period"
        />
      )}
      <Text fw={600}>Statements</Text>
      {statements.isError ? (
        <Alert tone="danger" title="Your statements could not be loaded">
          {errorText(statements.error)}
        </Alert>
      ) : (
        <DataTable
          columns={columns}
          data={statements.data ?? []}
          loading={statements.isLoading}
          rowKey={(s) => s.id}
          emptyTitle="No statements yet"
        />
      )}
      <DisputeModal statement={disputing} onClose={() => setDisputing(null)} />
    </Stack>
  );
}
