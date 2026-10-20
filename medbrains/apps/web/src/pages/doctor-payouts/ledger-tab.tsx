import { Group, Stack, Text } from "@mantine/core";
import type { PayoutLedgerLine } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { DoctorSearchSelect } from "@/components/DoctorSearchSelect";
import { Alert, Badge, Input, Select } from "@/components/ui";
import { doctorPayoutsService } from "@/services/doctor-payouts.service";
import { EVENT_LABEL, errorText, monthStartIso, rupees, todayIso } from "./shared";

/** The columns every ledger view shares. `withDoctor` adds who earned it. */
export function ledgerColumns(withDoctor: boolean) {
  const cols = [
    { key: "date", label: "Date", render: (r: PayoutLedgerLine) => r.service_date },
    {
      key: "event",
      label: "Entry",
      render: (r: PayoutLedgerLine) => (
        <Badge tone={Number(r.amount) < 0 ? "danger" : "info"}>
          {EVENT_LABEL[r.event] ?? r.event}
        </Badge>
      ),
    },
    {
      key: "service",
      label: "Service",
      render: (r: PayoutLedgerLine) => (
        <Stack gap={0}>
          <Text size="sm">{r.description ?? r.reason ?? "—"}</Text>
          <Text size="xs" c="dimmed">
            {[r.invoice_number, r.patient, r.role !== "primary" ? r.role : null]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </Stack>
      ),
    },
    { key: "base", label: "On", render: (r: PayoutLedgerLine) => rupees(r.base_amount) },
    {
      key: "amount",
      label: "Amount",
      render: (r: PayoutLedgerLine) => <Text fw={600}>{rupees(r.amount)}</Text>,
    },
  ];
  return withDoctor
    ? [
        { key: "doctor", label: "Doctor", render: (r: PayoutLedgerLine) => r.doctor_name ?? "—" },
        ...cols,
      ]
    : cols;
}

const EVENTS = [
  { value: "", label: "All entries" },
  ...Object.entries(EVENT_LABEL).map(([value, label]) => ({ value, label })),
];

/** Every accrual, reversal and adjustment — append-only, never edited. */
export function LedgerTab() {
  const [doctor, setDoctor] = useState("");
  const [from, setFrom] = useState(monthStartIso());
  const [to, setTo] = useState(todayIso());
  const [event, setEvent] = useState("");
  const ledger = useQuery({
    queryKey: ["doctor-payouts", "ledger", doctor, from, to, event],
    queryFn: () =>
      doctorPayoutsService.listPayoutLedger({
        doctor_id: doctor || undefined,
        from,
        to,
        event: event || undefined,
      }),
    enabled: Boolean(from && to),
  });
  const total = (ledger.data ?? []).reduce((sum, r) => sum + Number(r.amount), 0);
  return (
    <Stack gap="sm">
      <Group align="flex-end" grow>
        <DoctorSearchSelect
          label="Doctor"
          value={doctor}
          onChange={setDoctor}
          placeholder="All doctors"
        />
        <Input
          type="date"
          label="From"
          value={from}
          onChange={(e) => setFrom(e.currentTarget.value)}
        />
        <Input type="date" label="To" value={to} onChange={(e) => setTo(e.currentTarget.value)} />
        <Select
          label="Entry"
          data={EVENTS}
          value={event}
          allowDeselect={false}
          onChange={(v) => setEvent(v ?? "")}
        />
      </Group>
      {ledger.isError ? (
        <Alert tone="danger" title="The ledger could not be loaded">
          {errorText(ledger.error)} Nothing here means nothing loaded, not nothing earned.
        </Alert>
      ) : (
        <>
          <Text size="sm">
            Net of these entries: <strong>{rupees(String(total))}</strong>
          </Text>
          <DataTable
            columns={ledgerColumns(!doctor)}
            data={ledger.data ?? []}
            loading={ledger.isLoading}
            rowKey={(r) => r.id}
            emptyTitle="Nothing earned in this period"
            emptyDescription="Earnings appear as bills are issued, paid or settled, per each doctor's agreement."
          />
        </>
      )}
    </Stack>
  );
}
