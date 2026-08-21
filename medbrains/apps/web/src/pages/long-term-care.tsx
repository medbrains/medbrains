import { Card, Group, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type { MdsAssessment } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus, IconReportMedical } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, type BadgeTone, Button, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { longTermCareService } from "@/services/longTermCare.service";
import { CreateMdsModal } from "./long-term-care/create-mds-modal";
import { FamilyPanel } from "./long-term-care/family-panel";
import { LtcMedicationsPanel } from "./long-term-care/medications-panel";
import { ReadmissionRiskPanel } from "./long-term-care/readmission-risk-panel";
import { ReferralPanel } from "./long-term-care/referral-panel";
import { RehabPanel } from "./long-term-care/rehab-panel";
import { SnfPanel } from "./long-term-care/snf-panel";

export function LongTermCarePage() {
  useRequirePermission(P.SPECIALTY.LTC.MDS_LIST);
  // One `canManage` flag used to drive the create control on all six panels,
  // so the family-message button was gated on whatever MDS needed. Each panel
  // now resolves its own; the page keeps only the two MDS ones.
  const canCreateMds = useHasPermission(P.SPECIALTY.LTC.MDS_CREATE);
  const canCompleteMds = useHasPermission(P.SPECIALTY.LTC.MDS_COMPLETE);
  const qc = useQueryClient();
  const [patientId, setPatientId] = useState("");
  const [modalOpen, modal] = useDisclosure(false);

  const { data = [], isLoading } = useQuery({
    queryKey: ["mds", patientId],
    queryFn: () => longTermCareService.listMdsAssessments(patientId),
    enabled: !!patientId,
  });

  const complete = useMutation({
    mutationFn: (id: string) => longTermCareService.completeMdsAssessment(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mds", patientId] });
      toast.success("Assessment completed", { title: "Long-term care" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Failed" }),
  });

  const columns: Column<MdsAssessment>[] = [
    { key: "assessment_type", label: "Type", render: (r) => r.assessment_type.replace("_", " ") },
    {
      key: "assessment_date",
      label: "Date",
      render: (r) => new Date(r.assessment_date).toLocaleDateString(),
    },
    { key: "cognitive_status", label: "Cognition", render: (r) => r.cognitive_status ?? "—" },
    { key: "mood_score", label: "Mood", render: (r) => r.mood_score ?? "—" },
    { key: "adl_dependency_score", label: "ADL", render: (r) => r.adl_dependency_score ?? "—" },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Badge tone={(r.status === "completed" ? "success" : "neutral") as BadgeTone}>
          {r.status}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (r) =>
        canCompleteMds && r.status === "draft" ? (
          <Button
            size="xs"
            tone="primary"
            loading={complete.isPending}
            onClick={() => complete.mutate(r.id)}
          >
            Complete
          </Button>
        ) : null,
    },
  ];

  return (
    <Stack gap="md">
      <PageHeader
        title="Long-term care"
        subtitle="MDS assessments for long-stay residents"
        icon={<IconReportMedical size={20} />}
      />
      <Group align="flex-end" gap="sm">
        <PatientSearchSelect value={patientId} onChange={setPatientId} />
        {patientId && canCreateMds && (
          <Button leftSection={<IconPlus size={16} />} onClick={modal.open}>
            New MDS assessment
          </Button>
        )}
      </Group>
      {patientId ? (
        <DataTable
          columns={columns}
          data={data}
          loading={isLoading}
          rowKey={(r) => r.id}
          emptyTitle="No MDS assessments for this resident."
        />
      ) : (
        <Text c="dimmed">Select a resident to view their MDS assessments.</Text>
      )}
      {patientId && (
        <Card withBorder padding="md">
          <LtcMedicationsPanel patientId={patientId} />
        </Card>
      )}
      {patientId && (
        <Card withBorder padding="md">
          <RehabPanel patientId={patientId} />
        </Card>
      )}
      {patientId && (
        <Card withBorder padding="md">
          <ReadmissionRiskPanel patientId={patientId} />
        </Card>
      )}
      {patientId && (
        <Card withBorder padding="md">
          <SnfPanel patientId={patientId} />
        </Card>
      )}
      {patientId && (
        <Card withBorder padding="md">
          <ReferralPanel patientId={patientId} />
        </Card>
      )}
      {patientId && (
        <Card withBorder padding="md">
          <FamilyPanel patientId={patientId} />
        </Card>
      )}
      {patientId && (
        <CreateMdsModal patientId={patientId} opened={modalOpen} onClose={modal.close} />
      )}
    </Stack>
  );
}
