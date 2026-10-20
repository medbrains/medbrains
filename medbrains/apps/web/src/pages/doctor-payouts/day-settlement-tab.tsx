import { zodResolver } from "@hookform/resolvers/zod";
import { Group, SimpleGrid, Stack, Text } from "@mantine/core";
import type { DaySettlementSummary } from "@medbrains/types";
import { IconCash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { DataTable } from "@/components";
import { DoctorSearchSelect } from "@/components/DoctorSearchSelect";
import { Alert, Button, Card, Input, SegmentedControl, toast } from "@/components/ui";
import { doctorPayoutsService } from "@/services/doctor-payouts.service";
import { ledgerColumns } from "./ledger-tab";
import { errorText, rupees, todayIso } from "./shared";

export const settleSchema = z
  .object({
    mode: z.enum(["cash", "upi", "bank", "roll"]),
    reference: z.string().trim(),
  })
  .refine((v) => v.mode === "cash" || v.mode === "roll" || v.reference.length >= 4, {
    path: ["reference"],
    message: "The UPI or bank transaction reference",
  });

type SettleForm = z.infer<typeof settleSchema>;

function Figures({ day }: { day: DaySettlementSummary }) {
  const figures: [string, string][] = [
    ["Earned today", day.earned],
    ["Session minimum top-up", day.session_topup],
    ["To settle", day.total],
    ["Cash already paid today", day.cash_paid_today],
  ];
  return (
    <SimpleGrid cols={{ base: 2, sm: 4 }}>
      {figures.map(([label, value]) => (
        <Stack key={label} gap={0}>
          <Text size="xs" c="dimmed">
            {label}
          </Text>
          <Text fw={700} size="lg">
            {rupees(value)}
          </Text>
        </Stack>
      ))}
    </SimpleGrid>
  );
}

function SettleCard({ day }: { day: DaySettlementSummary }) {
  const queryClient = useQueryClient();
  const { control, handleSubmit, watch } = useForm<SettleForm>({
    resolver: zodResolver(settleSchema),
    defaultValues: { mode: day.payout_mode === "cash" ? "cash" : "upi", reference: "" },
  });
  const mode = watch("mode");
  const settle = useMutation({
    mutationFn: (v: SettleForm) =>
      doctorPayoutsService.settleDoctorDay({
        doctor_id: day.doctor_id,
        date: day.date,
        mode: v.mode,
        reference: v.reference || undefined,
      }),
    onSuccess: (r) => {
      void queryClient.invalidateQueries({ queryKey: ["doctor-payouts"] });
      if (r.warning) toast.warning(r.warning, { title: "Paid, with a cash warning" });
      toast.success(
        r.rolled ? "Left for the monthly statement." : `${rupees(r.statement?.net_payable)} paid.`,
        {
          title: r.rolled ? "Rolled over" : "Settled",
        },
      );
    },
  });
  return (
    <Stack gap="sm" component="form" onSubmit={handleSubmit((v) => settle.mutate(v))}>
      {mode === "cash" && day.cash_warning && (
        <Alert tone="warning" title={`Cash above ${rupees(day.cash_limit)} a day`}>
          {day.cash_warning} You can still pay in cash.
        </Alert>
      )}
      <Group align="flex-end">
        <Controller
          control={control}
          name="mode"
          render={({ field }) => (
            <SegmentedControl
              value={field.value}
              onChange={field.onChange}
              data={[
                { value: "upi", label: "UPI" },
                { value: "bank", label: "Bank" },
                { value: "cash", label: "Cash" },
                { value: "roll", label: "Add to monthly" },
              ]}
            />
          )}
        />
        {(mode === "upi" || mode === "bank") && (
          <Controller
            control={control}
            name="reference"
            render={({ field, fieldState }) => (
              <Input label="Transaction reference" {...field} error={fieldState.error?.message} />
            )}
          />
        )}
        <Button type="submit" leftSection={<IconCash size={16} />} loading={settle.isPending}>
          {mode === "roll" ? "Close the session" : "Settle and pay"}
        </Button>
      </Group>
      {settle.isError && (
        <Alert tone="danger" title="Not settled">
          {errorText(settle.error)}
        </Alert>
      )}
    </Stack>
  );
}

/** At session close: what a day or visiting doctor earned, and pay it. */
export function DaySettlementTab() {
  const [doctor, setDoctor] = useState("");
  const [date, setDate] = useState(todayIso());
  const day = useQuery({
    queryKey: ["doctor-payouts", "day", doctor, date],
    queryFn: () => doctorPayoutsService.getDaySettlement(doctor, date),
    enabled: Boolean(doctor && date),
  });
  return (
    <Stack gap="md">
      <Group align="flex-end" grow>
        <DoctorSearchSelect label="Doctor" value={doctor} onChange={setDoctor} />
        <Input
          type="date"
          label="Session date"
          value={date}
          onChange={(e) => setDate(e.currentTarget.value)}
        />
      </Group>
      {!doctor && <Alert tone="info">Pick the doctor whose session is closing.</Alert>}
      {day.isError && (
        <Alert tone="danger" title="The day could not be loaded">
          {errorText(day.error)} Do not pay from memory.
        </Alert>
      )}
      {day.data && !day.data.has_agreement && (
        <Alert tone="warning" title="No agreement">
          This doctor has no payout agreement covering the day, so nothing is earned. Add one under
          Agreements.
        </Alert>
      )}
      {day.data && (
        <Card>
          <Stack gap="md">
            <Figures day={day.data} />
            <DataTable
              columns={ledgerColumns(false)}
              data={day.data.lines}
              rowKey={(r) => r.id}
              emptyTitle="No patients earned on yet today"
              emptyDescription="Lines appear as each bill is issued or paid, per the doctor's agreement."
            />
            {Number(day.data.total) > 0 && <SettleCard key={`${doctor}-${date}`} day={day.data} />}
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
