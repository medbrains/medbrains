import { zodResolver } from "@hookform/resolvers/zod";
import { Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P, type PayoutStatement } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { DataTable } from "@/components";
import { Alert, Badge, Button, Input, Modal, toast } from "@/components/ui";
import { doctorPayoutsService } from "@/services/doctor-payouts.service";
import { ledgerColumns } from "./ledger-tab";
import { errorText, rupees, STATEMENT_TONE } from "./shared";

export const adjustSchema = z.object({
  amount: z
    .string()
    .regex(/^-?\d+(\.\d{1,2})?$/, "An amount; negative takes money off")
    .refine((v) => Number(v) !== 0, "Not zero"),
  reason: z.string().trim().min(5, "Say why — it goes on the statement"),
});

type AdjustForm = z.infer<typeof adjustSchema>;

function Totals({ s }: { s: PayoutStatement }) {
  const rows: [string, string | null][] = [
    ["Earned", s.incentive_amount],
    ["Of which adjustments", s.adjustments_total],
    ["Of which session minimum", s.session_minimum_total],
    [
      `TDS ${s.tds_section ?? ""} ${s.tds_rate ? `@ ${s.tds_rate}%` : ""}`,
      s.approved_at ? s.tds_amount : null,
    ],
    ["Net payable", s.net_payable],
  ];
  return (
    <SimpleGrid cols={{ base: 2, sm: 5 }}>
      {rows.map(([label, value]) => (
        <Stack key={label} gap={0}>
          <Text size="xs" c="dimmed">
            {label}
          </Text>
          <Text fw={600}>{value === null ? "On approval" : rupees(value)}</Text>
        </Stack>
      ))}
    </SimpleGrid>
  );
}

function AdjustForm({ s, onDone }: { s: PayoutStatement; onDone: () => void }) {
  const queryClient = useQueryClient();
  const { control, handleSubmit, reset } = useForm<AdjustForm>({
    resolver: zodResolver(adjustSchema),
    defaultValues: { amount: "", reason: "" },
  });
  const adjust = useMutation({
    mutationFn: (v: AdjustForm) => doctorPayoutsService.adjustPayoutStatement(s.id, v),
    onSuccess: (d) => {
      void queryClient.invalidateQueries({ queryKey: ["doctor-payouts", "statements"] });
      toast.success(
        `Issued as version ${d.statement.version}; it needs approval by someone else.`,
        { title: "Adjusted" },
      );
      reset();
      onDone();
    },
  });
  return (
    <Stack gap="xs" component="form" onSubmit={handleSubmit((v) => adjust.mutate(v))}>
      <Text fw={600} size="sm">
        Adjust (issues a new version)
      </Text>
      <Group align="flex-start" grow>
        <Controller
          control={control}
          name="amount"
          render={({ field, fieldState }) => (
            <Input label="Amount (Rs)" {...field} error={fieldState.error?.message} />
          )}
        />
        <Controller
          control={control}
          name="reason"
          render={({ field, fieldState }) => (
            <Input label="Reason" {...field} error={fieldState.error?.message} />
          )}
        />
      </Group>
      {adjust.isError && <Alert tone="danger">{errorText(adjust.error)}</Alert>}
      <Group justify="flex-end">
        <Button type="submit" tone="secondary" loading={adjust.isPending}>
          Adjust
        </Button>
      </Group>
    </Stack>
  );
}

const disputeSchema = z.object({ reason: z.string().trim().min(5, "Say what is wrong with it") });

function DisputeForm({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const { control, handleSubmit } = useForm<z.infer<typeof disputeSchema>>({
    resolver: zodResolver(disputeSchema),
    defaultValues: { reason: "" },
  });
  const dispute = useMutation({
    mutationFn: (v: z.infer<typeof disputeSchema>) =>
      doctorPayoutsService.disputePayoutStatement(id, v.reason),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["doctor-payouts"] }),
  });
  return (
    <Group align="flex-end" component="form" onSubmit={handleSubmit((v) => dispute.mutate(v))}>
      <Controller
        control={control}
        name="reason"
        render={({ field, fieldState }) => (
          <Input
            label="Record a dispute"
            placeholder="What the doctor disputes"
            {...field}
            error={fieldState.error?.message}
          />
        )}
      />
      <Button type="submit" tone="secondary" loading={dispute.isPending}>
        Mark disputed
      </Button>
      {dispute.isError && <Alert tone="danger">{errorText(dispute.error)}</Alert>}
    </Group>
  );
}

interface StatementDrawerProps {
  statementId: string | null;
  onClose: () => void;
}

/** One statement, line by line, with adjust and dispute while it is open. */
export function StatementDrawer({ statementId, onClose }: StatementDrawerProps) {
  const canPrepare = useHasPermission(P.DOCTOR_PAYOUTS.STATEMENTS.PREPARE);
  const detail = useQuery({
    queryKey: ["doctor-payouts", "statement", statementId],
    queryFn: () => doctorPayoutsService.getPayoutStatement(statementId ?? ""),
    enabled: Boolean(statementId),
  });
  const s = detail.data?.statement;
  const open = s && (s.status === "draft" || s.status === "disputed");
  return (
    <Modal opened={Boolean(statementId)} onClose={onClose} title="Statement" fullScreen>
      {detail.isError && (
        <Alert tone="danger" title="The statement could not be loaded">
          {errorText(detail.error)}
        </Alert>
      )}
      {s && (
        <Stack gap="md">
          <Group justify="space-between">
            <Text fw={600}>
              {s.doctor_name ?? s.partner_name} · {s.period_start} – {s.period_end} · v{s.version}
            </Text>
            <Badge tone={STATEMENT_TONE[s.status] ?? "neutral"}>{s.status}</Badge>
          </Group>
          {s.disputed_reason && (
            <Alert tone="warning" title="Disputed">
              {s.disputed_reason}
            </Alert>
          )}
          <Totals s={s} />
          <DataTable
            columns={ledgerColumns(false)}
            data={detail.data?.lines ?? []}
            rowKey={(r) => r.id}
            emptyTitle="No lines"
          />
          {open && canPrepare && <AdjustForm s={s} onDone={onClose} />}
          {s.status === "draft" && canPrepare && <DisputeForm id={s.id} />}
        </Stack>
      )}
    </Modal>
  );
}
