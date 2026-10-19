import { Group, Stack, Text } from "@mantine/core";
import { type H1RegisterEntry, P } from "@medbrains/types";
import { IconNotebook } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { PageHeader } from "@/components/PageHeader";
import { Alert, Input } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { storefrontService } from "@/services/storefront.service";

const DAY_MS = 86_400_000;
/** The register opens on the last month. */
const DEFAULT_DAYS = 30;

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/**
 * The Schedule H1 register (Rule 65): every H1 supply with prescriber,
 * patient and address, drug, batch, expiry, quantity and bill — built from
 * what was dispensed, at the counter or online, for an inspector.
 */
export function H1RegisterPage() {
  useRequirePermission(P.PHARMACY.H1_REGISTER.VIEW);
  const [to, setTo] = useState(() => isoDay(new Date()));
  const [from, setFrom] = useState(() => isoDay(new Date(Date.now() - DEFAULT_DAYS * DAY_MS)));
  const { data, isLoading, isError } = useQuery({
    queryKey: ["h1-register", from, to],
    queryFn: () => storefrontService.getH1Register(from, to),
  });
  const columns = [
    {
      key: "when",
      label: "Dispensed",
      render: (e: H1RegisterEntry) => (
        <Text size="sm">{e.dispensed_at ? new Date(e.dispensed_at).toLocaleString() : "—"}</Text>
      ),
    },
    {
      key: "patient",
      label: "Patient",
      render: (e: H1RegisterEntry) => (
        <Stack gap={0}>
          <Text size="sm">{e.patient_name ?? "—"}</Text>
          <Text size="xs" c="dimmed">
            {e.patient_address ?? "No address"}
          </Text>
        </Stack>
      ),
    },
    {
      key: "prescriber",
      label: "Prescriber",
      render: (e: H1RegisterEntry) => (
        <Text size="sm">
          {[e.prescriber_name, e.prescriber_registration].filter(Boolean).join(" · ") || "—"}
        </Text>
      ),
    },
    {
      key: "drug",
      label: "Drug",
      render: (e: H1RegisterEntry) => <Text size="sm">{e.drug_name}</Text>,
    },
    {
      key: "batch",
      label: "Batch · expiry",
      render: (e: H1RegisterEntry) => (
        <Text size="sm">{[e.batch_number, e.expiry_date].filter(Boolean).join(" · ") || "—"}</Text>
      ),
    },
    {
      key: "qty",
      label: "Quantity",
      render: (e: H1RegisterEntry) => <Text size="sm">{e.quantity}</Text>,
    },
    {
      key: "bill",
      label: "Bill",
      render: (e: H1RegisterEntry) => <Text size="sm">{e.bill_number ?? "—"}</Text>,
    },
  ];
  return (
    <Stack>
      <PageHeader
        title="Schedule H1 register"
        subtitle="Kept five years, open to inspection"
        icon={<IconNotebook size={20} stroke={1.5} />}
      />
      <Group>
        <Input
          type="date"
          label="From"
          value={from}
          onChange={(e) => setFrom(e.currentTarget.value)}
        />
        <Input type="date" label="To" value={to} onChange={(e) => setTo(e.currentTarget.value)} />
      </Group>
      {isError ? (
        <Alert tone="danger" title="The register could not be loaded">
          This is not an empty register. Try again, or choose a period of a year or less.
        </Alert>
      ) : (
        <DataTable
          columns={columns}
          data={data ?? []}
          loading={isLoading}
          rowKey={(e) => `${e.order_id}-${e.drug_name}`}
          emptyTitle="No H1 supplies in this period"
        />
      )}
    </Stack>
  );
}
