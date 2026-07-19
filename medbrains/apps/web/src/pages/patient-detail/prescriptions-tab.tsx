// PATIENT PrescriptionsTab — split from patient-detail.tsx (pure move).

import { Loader, Text } from "@mantine/core";
import type { Patient, PatientAllergy, PrescriptionHistoryItem } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { PrescriptionViews } from "@/components/Clinical";
import { patientDetailService } from "@/services/patientDetail.service";
import { age } from "./shared";

export function PrescriptionsTab({ patient }: { patient: Patient }) {
  const { data: history = [], isLoading } = useQuery<PrescriptionHistoryItem[]>({
    queryKey: ["patient-prescriptions", patient.id],
    queryFn: () => patientDetailService.listPatientPrescriptions(patient.id),
  });

  const { data: allergies } = useQuery({
    queryKey: ["patient-allergies", patient.id],
    queryFn: () => patientDetailService.listPatientAllergies(patient.id),
  });

  if (isLoading) return <Loader size="sm" />;

  const items = history;

  if (items.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="xl">
        No prescriptions found.
      </Text>
    );
  }

  const allergyNames = (allergies ?? []).map((a: PatientAllergy) => a.allergen_name);
  const fullName = `${patient.first_name} ${patient.middle_name ?? ""} ${patient.last_name}`.trim();
  const patientAge = age(patient.date_of_birth);

  return (
    <PrescriptionViews
      prescriptions={items}
      patientName={fullName}
      uhid={patient.uhid}
      patientAge={patientAge}
      allergies={allergyNames}
      doctorName={items[0]?.doctor_name ?? undefined}
    />
  );
}

// ── Lab Orders Tab ─────────────────────────────────────────
