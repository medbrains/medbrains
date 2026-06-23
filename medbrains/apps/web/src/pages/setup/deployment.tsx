import { Card, Group, NumberInput, Select, SimpleGrid, Stack, Text } from "@mantine/core";
import { P } from "@medbrains/types";
import { IconServerCog } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components";
import { Alert, Badge, Table } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";

// Researched mid-2026 reference ranges (monthly, on-demand; committed use cuts 30–60%).
// MedBrains is open source — this is the HOSPITAL's own infra cost, not a fee to us.
type SizeKey = "clinic" | "hospital" | "enterprise";

const SIZES: Record<SizeKey, { label: string; specs: string; hardware: string }> = {
  clinic: {
    label: "Clinic",
    specs: "small app instance + small managed PostgreSQL + ~30 GB storage",
    hardware: "1 server · quad-core · 8–16 GB RAM · 256 GB SSD",
  },
  hospital: {
    label: "Hospital",
    specs: "app instance + managed PostgreSQL (single-AZ) + ~250 GB + object storage",
    hardware: "8–16 cores Xeon · 32 GB RAM · RAID-1 NVMe · backup",
  },
  enterprise: {
    label: "Enterprise / multi-site",
    specs: "HA app + multi-AZ PostgreSQL + object store + analytics replica",
    hardware: "dual-Xeon · 64–256 GB RAM · RAID · HA cluster · backup",
  },
};

interface Provider {
  name: string;
  indiaResident: boolean; // has an India region / data-residency
  note?: string;
  cost: Record<SizeKey, string>;
}

const PROVIDERS: Provider[] = [
  {
    name: "India sovereign (ESDS / Yotta / E2E / CtrlS)",
    indiaResident: true,
    note: "MeitY-empaneled, DPDP-compliant, INR billing — ~30–60% cheaper",
    cost: { clinic: "₹2–4k", hospital: "₹12–22k", enterprise: "₹70k+" },
  },
  {
    name: "AWS (Mumbai)",
    indiaResident: true,
    cost: { clinic: "$45–55", hospital: "$200–350", enterprise: "$1k–3k+" },
  },
  {
    name: "GCP (Mumbai)",
    indiaResident: true,
    cost: { clinic: "$30–40", hospital: "$250–400", enterprise: "$1k–3k+" },
  },
  {
    name: "Azure (India)",
    indiaResident: true,
    cost: { clinic: "$50–70", hospital: "$250–400", enterprise: "$1k–3k+" },
  },
  {
    name: "DigitalOcean (Bangalore)",
    indiaResident: true,
    note: "simple, $200 free credit",
    cost: { clinic: "$25–35", hospital: "$120–250", enterprise: "$700+" },
  },
  {
    name: "Hetzner (EU only)",
    indiaResident: false,
    note: "cheapest, but EU-region — fails India data-residency",
    cost: { clinic: "€20", hospital: "€80–150", enterprise: "€400–900+" },
  },
];

function recommendSize(beds: number, workload: string, multiSite: boolean): SizeKey {
  if (multiSite || beds > 200) return "enterprise";
  if (beds > 20 || workload !== "opd") return "hospital";
  return "clinic";
}

export function DeploymentCostPage() {
  useRequirePermission(P.ADMIN.SETTINGS.GENERAL.MANAGE);

  const [beds, setBeds] = useState<number | string>(15);
  const [workload, setWorkload] = useState<string>("opd");
  const [multiSite, setMultiSite] = useState<string>("no");
  const [residency, setResidency] = useState<string>("india");

  const size = useMemo(
    () => recommendSize(Number(beds) || 0, workload, multiSite === "yes"),
    [beds, workload, multiSite],
  );
  const providers = useMemo(
    () => (residency === "india" ? PROVIDERS.filter((p) => p.indiaResident) : PROVIDERS),
    [residency],
  );

  return (
    <Stack>
      <PageHeader
        title="Deployment & Cost"
        subtitle="MedBrains is open source — there's no licence fee. This estimates YOUR infrastructure cost so you can pick what fits."
      />

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Card withBorder padding="lg">
          <Text fw={600} mb="sm">
            Your profile
          </Text>
          <Stack gap="sm">
            <NumberInput
              label="Number of beds"
              description="Drives the sizing (OPD-only clinics can use 0)"
              value={beds}
              onChange={setBeds}
              min={0}
              max={5000}
            />
            <Select
              label="Workload"
              value={workload}
              onChange={(v) => setWorkload(v ?? "opd")}
              data={[
                { value: "opd", label: "OPD only" },
                { value: "opd_ipd", label: "OPD + IPD" },
                { value: "full", label: "Full (IPD, diagnostics, OT)" },
              ]}
            />
            <Select
              label="Multiple hospitals / sites?"
              value={multiSite}
              onChange={(v) => setMultiSite(v ?? "no")}
              data={[
                { value: "no", label: "Single site" },
                { value: "yes", label: "Multiple sites" },
              ]}
            />
            <Select
              label="Data residency"
              description="Indian hospitals (NABH/ABDM/DPDP) usually need data in India"
              value={residency}
              onChange={(v) => setResidency(v ?? "india")}
              data={[
                { value: "india", label: "Must stay in India" },
                { value: "any", label: "No constraint (cheapest wins)" },
              ]}
            />
          </Stack>
        </Card>

        <Card withBorder padding="lg">
          <Group gap="xs" mb="sm">
            <IconServerCog size={18} />
            <Text fw={600}>Recommended: {SIZES[size].label}</Text>
            <Badge tone="primary" size="sm">
              {size === "clinic" ? "Smallest viable" : size === "enterprise" ? "HA / dedicated" : "Standard"}
            </Badge>
          </Group>
          <Text size="sm" c="dimmed" mb="xs">
            {SIZES[size].specs}
          </Text>
          <Text size="sm" mb="md">
            <b>On-prem hardware:</b> {SIZES[size].hardware}
            {residency === "india" && " — or your own data centre for full residency."}
          </Text>
          <Text size="xs" tt="uppercase" fw={600} c="dimmed" mb={4}>
            Estimated monthly infra cost
          </Text>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Provider</Table.Th>
                <Table.Th>≈ / month</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {providers.map((p) => (
                <Table.Tr key={p.name}>
                  <Table.Td>
                    <Text size="sm">{p.name}</Text>
                    {p.note && (
                      <Text size="xs" c="dimmed">
                        {p.note}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Text fw={600}>{p.cost[size]}</Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      </SimpleGrid>

      <Alert tone="info" title="How to read this">
        On-demand mid-2026 reference ranges — committed/reserved pricing cuts 30–60% for steady
        hospital load. The lean Rust backend runs on a small app instance; PostgreSQL and object
        storage (scans/DICOM) are the real cost drivers. Verify against the provider's live
        calculator before committing. No licence fee to MedBrains — the commercial license is the
        alternative only if you can't meet AGPL.
      </Alert>
    </Stack>
  );
}
