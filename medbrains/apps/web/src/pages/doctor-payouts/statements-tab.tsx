import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack, Text } from "@mantine/core";
import type { LabReferralDoctor, PayoutStatement } from "@medbrains/types";
import { IconFileInvoice } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { DataTable } from "@/components";
import { DoctorSearchSelect } from "@/components/DoctorSearchSelect";
import {
  Alert,
  Badge,
  Button,
  Card,
  Input,
  SegmentedControl,
  Select,
  toast,
} from "@/components/ui";
import { doctorPayoutsService } from "@/services/doctor-payouts.service";
import { labService } from "@/services/lab.service";
import { errorText, monthStartIso, rupees, STATEMENT_TONE, todayIso } from "./shared";
import { StatementDrawer } from "./statement-drawer";

export const prepareSchema = z
  .object({
    payee: z.string().min(1, "Choose who the statement is for"),
    period_start: z.string().min(1, "Start date"),
    period_end: z.string().min(1, "End date"),
  })
  .refine((v) => v.period_end >= v.period_start, {
    path: ["period_end"],
    message: "Ends before it starts",
  });

type PrepareForm = z.infer<typeof prepareSchema>;

/** The columns statement lists share. */
export const statementColumns = [
  {
    key: "payee",
    label: "For",
    render: (s: PayoutStatement) => (
      <Stack gap={0}>
        <Text fw={500}>{s.doctor_name ?? s.partner_name ?? "—"}</Text>
        <Text size="xs" c="dimmed">
          {s.kind === "referral"
            ? "Referral commission"
            : s.kind === "same_day"
              ? "Same-day"
              : "Monthly"}{" "}
          · v{s.version}
        </Text>
      </Stack>
    ),
  },
  {
    key: "period",
    label: "Period",
    render: (s: PayoutStatement) => `${s.period_start} – ${s.period_end}`,
  },
  { key: "gross", label: "Earned", render: (s: PayoutStatement) => rupees(s.incentive_amount) },
  {
    key: "tds",
    label: "TDS",
    render: (s: PayoutStatement) => (s.approved_at ? rupees(s.tds_amount) : "On approval"),
  },
  { key: "net", label: "Net", render: (s: PayoutStatement) => rupees(s.net_payable) },
  {
    key: "status",
    label: "Status",
    render: (s: PayoutStatement) => (
      <Badge tone={STATEMENT_TONE[s.status] ?? "neutral"}>{s.status}</Badge>
    ),
  },
];

function PrepareCard({ kind }: { kind: "doctor" | "referral" }) {
  const queryClient = useQueryClient();
  const partners = useQuery({
    queryKey: ["lab", "referral-doctors"],
    queryFn: () => labService.listLabReferralDoctors(),
    enabled: kind === "referral",
  });
  const { control, handleSubmit } = useForm<PrepareForm>({
    resolver: zodResolver(prepareSchema),
    defaultValues: { payee: "", period_start: monthStartIso(), period_end: todayIso() },
  });
  const prepare = useMutation({
    mutationFn: (v: PrepareForm) =>
      kind === "doctor"
        ? doctorPayoutsService.preparePayoutStatement({
            doctor_id: v.payee,
            period_start: v.period_start,
            period_end: v.period_end,
          })
        : doctorPayoutsService.createReferralStatement({
            referral_doctor_id: v.payee,
            period_start: v.period_start,
            period_end: v.period_end,
          }),
    onSuccess: (d) => {
      void queryClient.invalidateQueries({ queryKey: ["doctor-payouts", "statements"] });
      toast.success(
        `${rupees(d.statement.incentive_amount)} on ${d.lines.length} lines. It now needs approval by someone else.`,
        {
          title: "Statement prepared",
        },
      );
    },
  });
  const partnerOptions = (partners.data ?? []).map((p: LabReferralDoctor) => ({
    value: p.id,
    label: `${p.name}${p.partner_kind === "individual" ? " (individual doctor)" : ""}`,
  }));
  return (
    <Stack gap="sm" component="form" onSubmit={handleSubmit((v) => prepare.mutate(v))}>
      <Group align="flex-end" grow>
        <Controller
          control={control}
          name="payee"
          render={({ field, fieldState }) =>
            kind === "doctor" ? (
              <DoctorSearchSelect
                label="Doctor"
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            ) : (
              <Select
                label="Referral partner"
                data={partnerOptions}
                value={field.value || null}
                onChange={(v) => field.onChange(v ?? "")}
                error={fieldState.error?.message}
              />
            )
          }
        />
        {(["period_start", "period_end"] as const).map((name) => (
          <Controller
            key={name}
            control={control}
            name={name}
            render={({ field, fieldState }) => (
              <Input
                type="date"
                label={name === "period_start" ? "From" : "To"}
                {...field}
                error={fieldState.error?.message}
              />
            )}
          />
        ))}
        <Button
          type="submit"
          leftSection={<IconFileInvoice size={16} />}
          loading={prepare.isPending}
        >
          Prepare
        </Button>
      </Group>
      {partners.isError && <Alert tone="danger">{errorText(partners.error)}</Alert>}
      {prepare.isError && (
        <Alert tone="warning" title="No statement prepared">
          {errorText(prepare.error)}
        </Alert>
      )}
    </Stack>
  );
}

/** Prepare statements for a period, review their lines, adjust or dispute. */
export function StatementsTab() {
  const [kind, setKind] = useState<"doctor" | "referral">("doctor");
  const [status, setStatus] = useState("draft");
  const [openId, setOpenId] = useState<string | null>(null);
  const statements = useQuery({
    queryKey: ["doctor-payouts", "statements", status],
    queryFn: () => doctorPayoutsService.listPayoutStatements(status === "all" ? undefined : status),
  });
  return (
    <Stack gap="md">
      <Card>
        <Stack gap="sm">
          <SegmentedControl
            value={kind}
            onChange={(v) => setKind(v as "doctor" | "referral")}
            data={[
              { value: "doctor", label: "Doctor statement" },
              { value: "referral", label: "Referral commission" },
            ]}
          />
          <PrepareCard key={kind} kind={kind} />
        </Stack>
      </Card>
      <SegmentedControl
        value={status}
        onChange={setStatus}
        data={["draft", "disputed", "approved", "paid", "all"].map((s) => ({
          value: s,
          label: s.charAt(0).toUpperCase() + s.slice(1),
        }))}
      />
      {statements.isError ? (
        <Alert tone="danger" title="Statements could not be loaded">
          {errorText(statements.error)}
        </Alert>
      ) : (
        <DataTable
          columns={statementColumns}
          data={statements.data ?? []}
          loading={statements.isLoading}
          rowKey={(s) => s.id}
          onRowClick={(s) => setOpenId(s.id)}
          emptyTitle="No statements here"
          emptyDescription="Prepare one for a doctor and a period above."
        />
      )}
      <StatementDrawer statementId={openId} onClose={() => setOpenId(null)} />
    </Stack>
  );
}
