import { Card, Group, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type { HomeMedAdministration } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconHome2, IconPlus } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, type BadgeTone, Button } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { homeHealthService } from "@/services/homeHealth.service";
import { AdvanceDirectivesPanel } from "./home-healthcare/advance-directives-panel";
import { BereavementPanel } from "./home-healthcare/bereavement-panel";
import { BillingPanel } from "./home-healthcare/billing-panel";
import { CaregiverEducationPanel } from "./home-healthcare/caregiver-education-panel";
import { DischargePanel } from "./home-healthcare/discharge-panel";
import { EscalationsPanel } from "./home-healthcare/escalations-panel";
import { HospicePanel } from "./home-healthcare/hospice-panel";
import { ProgressNotesPanel } from "./home-healthcare/progress-notes-panel";
import { RecordModal } from "./home-healthcare/record-modal";
import { RemoteVitalsPanel } from "./home-healthcare/remote-vitals-panel";
import { ScheduleModal } from "./home-healthcare/schedule-modal";

function statusTone(s: string): BadgeTone {
  if (s === "administered") return "success";
  if (s === "missed") return "danger";
  if (s === "held") return "warning";
  return "neutral";
}

export function HomeHealthcarePage() {
  useRequirePermission(P.IPD.MAR_LIST);
  const canRecord = useHasPermission(P.IPD.MAR_CREATE);
  const [patientId, setPatientId] = useState("");
  const [scheduleOpen, schedule] = useDisclosure(false);
  const [recordMed, setRecordMed] = useState<HomeMedAdministration | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["home-meds", patientId],
    queryFn: () => homeHealthService.listHomeMeds(patientId),
    enabled: !!patientId,
  });

  const columns: Column<HomeMedAdministration>[] = [
    {
      key: "drug",
      label: "Medication",
      render: (r) => (
        <Stack gap={0}>
          <Text size="sm" fw={500}>
            {r.drug_name} · {r.dose}
          </Text>
          <Text size="xs" c="dimmed">
            {r.route}
            {r.is_infusion ? ` · infusion ${r.infusion_rate ?? ""}` : ""}
          </Text>
        </Stack>
      ),
    },
    {
      key: "scheduled_at",
      label: "Scheduled",
      render: (r) => new Date(r.scheduled_at).toLocaleString(),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge>,
    },
    {
      key: "administered_at",
      label: "Given",
      render: (r) => (r.administered_at ? new Date(r.administered_at).toLocaleString() : "—"),
    },
    {
      key: "actions",
      label: "",
      render: (r) =>
        canRecord && r.status === "scheduled" ? (
          <Button size="xs" tone="secondary" onClick={() => setRecordMed(r)}>
            Record
          </Button>
        ) : null,
    },
  ];

  return (
    <Stack gap="md">
      <PageHeader
        title="Home healthcare"
        subtitle="Home medication administration — IV antibiotics & infusions"
        icon={<IconHome2 size={20} />}
      />
      <Group align="flex-end" gap="sm">
        <PatientSearchSelect value={patientId} onChange={setPatientId} />
        {patientId && canRecord && (
          <Button leftSection={<IconPlus size={16} />} onClick={schedule.open}>
            Schedule dose
          </Button>
        )}
      </Group>

      {patientId ? (
        <DataTable
          columns={columns}
          data={data}
          loading={isLoading}
          rowKey={(r) => r.id}
          emptyTitle="No home medications scheduled for this patient."
        />
      ) : (
        <Text c="dimmed">Select a patient to view their home medication schedule.</Text>
      )}

      {patientId && (
        <Card withBorder padding="md">
          <RemoteVitalsPanel patientId={patientId} canManage={canRecord} />
        </Card>
      )}
      {patientId && (
        <Card withBorder padding="md">
          <BillingPanel patientId={patientId} canManage={canRecord} />
        </Card>
      )}
      {patientId && (
        <Card withBorder padding="md">
          <CaregiverEducationPanel patientId={patientId} canManage={canRecord} />
        </Card>
      )}
      {patientId && (
        <Card withBorder padding="md">
          <HospicePanel patientId={patientId} canManage={canRecord} />
        </Card>
      )}
      {patientId && (
        <Card withBorder padding="md">
          <AdvanceDirectivesPanel patientId={patientId} canManage={canRecord} />
        </Card>
      )}
      {patientId && (
        <Card withBorder padding="md">
          <BereavementPanel patientId={patientId} canManage={canRecord} />
        </Card>
      )}
      {patientId && (
        <Card withBorder padding="md">
          <EscalationsPanel patientId={patientId} canManage={canRecord} />
        </Card>
      )}
      {patientId && (
        <Card withBorder padding="md">
          <ProgressNotesPanel patientId={patientId} canManage={canRecord} />
        </Card>
      )}
      {patientId && (
        <Card withBorder padding="md">
          <DischargePanel patientId={patientId} canManage={canRecord} />
        </Card>
      )}

      {patientId && (
        <ScheduleModal patientId={patientId} opened={scheduleOpen} onClose={schedule.close} />
      )}
      <RecordModal med={recordMed} onClose={() => setRecordMed(null)} />
    </Stack>
  );
}
