import { Group, Stack, Text } from "@mantine/core";
import type { DoctorPayout, PayoutStatement, RunPayoutsRequest } from "@medbrains/types";
import { IconDownload, IconSend } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Input,
  SegmentedControl,
  Select,
  toast,
} from "@/components/ui";
import { doctorPayoutsService } from "@/services/doctor-payouts.service";
import { PayoutActions } from "./payout-actions";
import { downloadText, errorText, rupees } from "./shared";

type Provider = RunPayoutsRequest["provider"];

const PAYOUT_TONE = {
  pending: "info",
  processing: "warning",
  paid: "success",
  failed: "danger",
  reversed: "neutral",
} as const;

/** Pay approved statements: a bank file, RazorpayX, or recorded by hand. */
export function PayoutRunTab() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [provider, setProvider] = useState<Provider>("bank_file");
  const [mode, setMode] = useState<string>("cash");
  const [reference, setReference] = useState("");
  const [lastRun, setLastRun] = useState<string | null>(null);
  const approved = useQuery({
    queryKey: ["doctor-payouts", "statements", "approved"],
    queryFn: () => doctorPayoutsService.listPayoutStatements("approved"),
  });
  const payouts = useQuery({
    queryKey: ["doctor-payouts", "payouts"],
    queryFn: () => doctorPayoutsService.listDoctorPayouts(),
  });
  const run = useMutation({
    mutationFn: () =>
      doctorPayoutsService.runDoctorPayouts({
        statement_ids: [...selected],
        provider,
        ...(provider === "manual"
          ? { mode: mode as RunPayoutsRequest["mode"], reference: reference || undefined }
          : {}),
      }),
    onSuccess: (r) => {
      void queryClient.invalidateQueries({ queryKey: ["doctor-payouts"] });
      setSelected(new Set());
      setLastRun(provider === "bank_file" ? r.run_id : null);
      for (const w of r.warnings) toast.warning(w, { title: "Cash above the daily limit" });
      toast.success(
        provider === "bank_file"
          ? "Download the bank file and upload it to the bank."
          : "Payout recorded.",
        { title: "Run done" },
      );
    },
  });
  const bankFile = useMutation({
    mutationFn: (runId: string) => doctorPayoutsService.getPayoutBankFile(runId),
    onSuccess: (f) => downloadText(f.filename, f.csv),
    onError: (e: Error) => toast.error(e.message, { title: "Bank file not built" }),
  });
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const statementColumns = [
    {
      key: "pick",
      label: "",
      render: (s: PayoutStatement) => (
        <Checkbox
          aria-label={`Pay ${s.doctor_name ?? s.partner_name}`}
          checked={selected.has(s.id)}
          onChange={() => toggle(s.id)}
        />
      ),
    },
    {
      key: "payee",
      label: "Payee",
      render: (s: PayoutStatement) => s.doctor_name ?? s.partner_name ?? "—",
    },
    {
      key: "period",
      label: "Period",
      render: (s: PayoutStatement) => `${s.period_start} – ${s.period_end}`,
    },
    { key: "tds", label: "TDS", render: (s: PayoutStatement) => rupees(s.tds_amount) },
    {
      key: "net",
      label: "Net payable",
      render: (s: PayoutStatement) => <Text fw={600}>{rupees(s.net_payable)}</Text>,
    },
  ];
  const payoutColumns = [
    { key: "payee", label: "Payee", render: (p: DoctorPayout) => p.payee_name ?? "—" },
    {
      key: "how",
      label: "How",
      render: (p: DoctorPayout) => `${p.mode} · ${p.provider.replace("_", " ")}`,
    },
    { key: "amount", label: "Amount", render: (p: DoctorPayout) => rupees(p.amount) },
    {
      key: "status",
      label: "Status",
      render: (p: DoctorPayout) => (
        <Stack gap={0}>
          <Badge tone={PAYOUT_TONE[p.status]}>{p.status}</Badge>
          {(p.warning || p.failure_reason) && (
            <Text size="xs" c="dimmed">
              {p.failure_reason ?? p.warning}
            </Text>
          )}
        </Stack>
      ),
    },
    { key: "utr", label: "UTR", render: (p: DoctorPayout) => p.utr ?? "—" },
    { key: "act", label: "", render: (p: DoctorPayout) => <PayoutActions payout={p} /> },
  ];

  return (
    <Stack gap="md">
      <Text fw={600}>Approved, waiting to be paid</Text>
      {approved.isError ? (
        <Alert tone="danger" title="Approved statements could not be loaded">
          {errorText(approved.error)}
        </Alert>
      ) : (
        <DataTable
          columns={statementColumns}
          data={approved.data ?? []}
          loading={approved.isLoading}
          rowKey={(s) => s.id}
          emptyTitle="Nothing approved to pay"
        />
      )}
      <Group align="flex-end">
        <SegmentedControl
          value={provider}
          onChange={(v) => setProvider(v as Provider)}
          data={[
            { value: "bank_file", label: "Bank file" },
            { value: "razorpayx", label: "RazorpayX" },
            { value: "manual", label: "Paid by hand" },
          ]}
        />
        {provider === "manual" && (
          <>
            <Select
              label="Paid by"
              data={["cash", "upi", "bank"]}
              value={mode}
              allowDeselect={false}
              onChange={(v) => setMode(v ?? "cash")}
            />
            <Input
              label="Receipt / reference"
              value={reference}
              onChange={(e) => setReference(e.currentTarget.value)}
            />
          </>
        )}
        <Button
          leftSection={<IconSend size={16} />}
          disabled={selected.size === 0}
          loading={run.isPending}
          onClick={() => run.mutate()}
        >
          Pay {selected.size || ""} selected
        </Button>
        {lastRun && (
          <Button
            tone="secondary"
            leftSection={<IconDownload size={16} />}
            loading={bankFile.isPending}
            onClick={() => bankFile.mutate(lastRun)}
          >
            Download bank file
          </Button>
        )}
      </Group>
      {run.isError && (
        <Alert tone="danger" title="Run not made">
          {errorText(run.error)}
        </Alert>
      )}
      <Text fw={600}>Payouts</Text>
      {payouts.isError ? (
        <Alert tone="danger" title="Payouts could not be loaded">
          {errorText(payouts.error)}
        </Alert>
      ) : (
        <DataTable
          columns={payoutColumns}
          data={payouts.data ?? []}
          loading={payouts.isLoading}
          rowKey={(p) => p.id}
          emptyTitle="No payouts yet"
        />
      )}
    </Stack>
  );
}
