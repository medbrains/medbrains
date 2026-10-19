import { Group, Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type { NhcxPayment } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { Badge, Button, SegmentedControl } from "@/components/ui";
import { paymentFlag, rupees } from "./claimNhcx";
import { NhcxPostPaymentModal } from "./NhcxPostPaymentModal";

type Filter = "open" | "all";

/** Finance's view of NHCX payment notices: each claim's share of a payer's
 * transfer, with the ones to follow up first — no claim matched, or paid
 * other than approved. */
export function NhcxPaymentsPanel() {
  const canSee = useHasPermission(P.INSURANCE.NHCX.PAYMENTS);
  const [filter, setFilter] = useState<Filter>("open");
  const [posting, setPosting] = useState<NhcxPayment | null>(null);
  const payments = useQuery({
    queryKey: ["nhcx-payments", filter],
    queryFn: () => api.listNhcxPayments(filter),
    enabled: canSee,
  });
  if (!canSee) return null;
  const columns = [
    {
      key: "payment_date" as const,
      label: "Paid on",
      render: (p: NhcxPayment) => p.payment_date ?? "—",
    },
    {
      key: "payer_name" as const,
      label: "Payer",
      render: (p: NhcxPayment) => p.payer_name ?? p.sender_code,
    },
    {
      key: "payment_reference" as const,
      label: "UTR",
      render: (p: NhcxPayment) => (
        <Text size="sm" ff="monospace">
          {p.payment_reference ?? "—"}
        </Text>
      ),
    },
    {
      key: "claim_number" as const,
      label: "Claim",
      render: (p: NhcxPayment) => p.claim_number ?? p.claim_reference ?? "—",
    },
    {
      key: "gross_amount" as const,
      label: "Approved paid / TDS / received",
      render: (p: NhcxPayment) =>
        `${rupees(p.gross_amount)} / ${rupees(p.tds_amount)} / ${rupees(p.net_amount)}`,
    },
    {
      key: "approved_amount" as const,
      label: "Claim approved",
      render: (p: NhcxPayment) => rupees(p.approved_amount),
    },
    {
      key: "is_mismatch" as const,
      label: "Check",
      render: (p: NhcxPayment) => {
        const flag = paymentFlag(p);
        return <Badge tone={flag.tone}>{flag.label}</Badge>;
      },
    },
    {
      key: "bank_matched" as const,
      label: "Bank statement",
      render: (p: NhcxPayment) => (p.bank_matched ? "Matched" : "Not yet"),
    },
    {
      key: "id" as const,
      label: "",
      render: (p: NhcxPayment) =>
        p.status === "unmatched" ? (
          <Button size="xs" tone="tertiary" onClick={() => setPosting(p)}>
            Post to claim
          </Button>
        ) : null,
    },
  ];
  return (
    <Stack gap="xs" mt="lg">
      <Group justify="space-between">
        <Text fw={600}>NHCX payments</Text>
        <SegmentedControl
          size="xs"
          value={filter}
          onChange={(v) => setFilter(v as Filter)}
          data={[
            { value: "open", label: "To follow up" },
            { value: "all", label: "All" },
          ]}
        />
      </Group>
      <DataTable
        columns={columns}
        data={payments.data ?? []}
        loading={payments.isLoading}
        error={payments.error}
        rowKey={(p) => p.id}
        emptyTitle={filter === "open" ? "Nothing to follow up" : "No NHCX payments yet"}
        emptyDescription={
          filter === "open"
            ? "Every NHCX payment matched its claim and what the payer approved."
            : "Payments appear here when a payer sends a payment notice through NHCX."
        }
      />
      <NhcxPostPaymentModal payment={posting} onClose={() => setPosting(null)} />
    </Stack>
  );
}
