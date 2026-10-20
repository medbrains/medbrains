import { Group, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { DoctorAgreement } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { Alert, Badge, Button } from "@/components/ui";
import { doctorPayoutsService } from "@/services/doctor-payouts.service";
import { AgreementDrawer } from "./agreement-drawer";
import { BASES, ENGAGEMENTS, errorText } from "./shared";

const label = (list: { value: string; label: string }[], v: string | null) =>
  v ? (list.find((x) => x.value === v)?.label ?? v) : "Hospital default";

/** Each doctor's agreement: how they are engaged and paid. */
export function AgreementsTab() {
  const [opened, drawer] = useDisclosure(false);
  const [editing, setEditing] = useState<DoctorAgreement | null>(null);
  const agreements = useQuery({
    queryKey: ["doctor-payouts", "agreements"],
    queryFn: () => doctorPayoutsService.listDoctorAgreements(),
  });

  const open = (row: DoctorAgreement | null) => {
    setEditing(row);
    drawer.open();
  };

  const columns = [
    {
      key: "doctor",
      label: "Doctor",
      render: (r: DoctorAgreement) => <Text fw={500}>{r.doctor_name ?? r.doctor_id}</Text>,
    },
    {
      key: "engagement",
      label: "Engagement",
      render: (r: DoctorAgreement) => label(ENGAGEMENTS, r.engagement_type),
    },
    { key: "basis", label: "Earns", render: (r: DoctorAgreement) => label(BASES, r.accrual_basis) },
    {
      key: "card",
      label: "Rate card",
      render: (r: DoctorAgreement) => r.plan_name ?? "—",
    },
    {
      key: "dates",
      label: "From – to",
      render: (r: DoctorAgreement) => `${r.effective_from} – ${r.effective_to ?? "open"}`,
    },
    {
      key: "pan",
      label: "PAN",
      render: (r: DoctorAgreement) => r.pan ?? <Badge tone="warning">No PAN — TDS at 20%</Badge>,
    },
    {
      key: "status",
      label: "Status",
      render: (r: DoctorAgreement) => (
        <Badge tone={r.is_active ? "success" : "neutral"}>{r.is_active ? "Active" : "Ended"}</Badge>
      ),
    },
  ];

  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          A doctor earns only under an agreement. Terms left blank follow the hospital's policy.
        </Text>
        <Button leftSection={<IconPlus size={16} />} onClick={() => open(null)}>
          New agreement
        </Button>
      </Group>
      {agreements.isError ? (
        <Alert tone="danger" title="Agreements could not be loaded">
          {errorText(agreements.error)} This is not an empty list.
        </Alert>
      ) : (
        <DataTable
          columns={columns}
          data={agreements.data ?? []}
          loading={agreements.isLoading}
          rowKey={(r) => r.id}
          onRowClick={(r) => open(r)}
          emptyTitle="No agreements yet"
          emptyDescription="Add one for each visiting, day or fee-for-service doctor."
        />
      )}
      <AgreementDrawer opened={opened} onClose={drawer.close} agreement={editing} />
    </Stack>
  );
}
