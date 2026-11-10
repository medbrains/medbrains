// Radiology DicomStudiesTab — split from radiology.tsx (pure move).

import { Group, Text } from "@mantine/core";
import type { RadiologyDicomStudy } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, PageHeader } from "@/components";
import { PatientNameCell } from "@/components/PatientNameCell";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { StudyImageActions } from "@/components/Radiology/StudyImageActions";
import { Badge } from "@/components/ui";
import { radiologyService } from "@/services/radiology.service";

export function DicomStudiesTab() {
  const [patientId, setPatientId] = useState("");

  const { data: studies = [], isLoading } = useQuery({
    queryKey: ["radiology-dicom-studies", patientId],
    queryFn: () =>
      radiologyService.listRadiologyDicomStudies(patientId ? { patient_id: patientId } : undefined),
  });

  const columns = [
    {
      key: "patient_id" as const,
      label: "Patient",
      render: (study: RadiologyDicomStudy) =>
        study.patient_id ? <PatientNameCell patientId={study.patient_id} showUhid={false} /> : "—",
    },
    {
      key: "modality" as const,
      label: "Modality",
      render: (study: RadiologyDicomStudy) => (
        <Badge size="xs" tone="neutral">
          {study.modality}
        </Badge>
      ),
    },
    {
      key: "study_description" as const,
      label: "Study",
      render: (study: RadiologyDicomStudy) => (
        <div>
          <Text size="sm" fw={500}>
            {study.study_description ?? "DICOM Study"}
          </Text>
          <Text size="xs" c="dimmed" ff="monospace">
            {study.study_instance_uid}
          </Text>
        </div>
      ),
    },
    {
      key: "instance_count" as const,
      label: "Instances",
      render: (study: RadiologyDicomStudy) =>
        `${study.series_count} series / ${study.instance_count} images`,
    },
    {
      key: "study_date" as const,
      label: "Date",
      render: (study: RadiologyDicomStudy) =>
        study.study_date ? new Date(study.study_date).toLocaleDateString() : "—",
    },
    {
      key: "viewer_url" as const,
      label: "Images",
      render: (study: RadiologyDicomStudy) => <StudyImageActions studyId={study.id} size="xs" />,
    },
  ];

  return (
    <>
      <PageHeader
        title="DICOM Studies"
        subtitle="PACS-linked studies, viewer URLs, and prior imaging"
        actions={
          <Group align="end">
            <PatientSearchSelect
              value={patientId}
              onChange={setPatientId}
              label="Filter by patient"
              placeholder="Search patient..."
              size="xs"
            />
          </Group>
        }
      />

      <DataTable
        columns={columns}
        data={studies}
        rowKey={(study) => study.id}
        loading={isLoading}
      />
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  TAT Analytics Tab
// ══════════════════════════════════════════════════════════
