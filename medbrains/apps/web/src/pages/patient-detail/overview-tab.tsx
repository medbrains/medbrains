// PATIENT OverviewTab — split from patient-detail.tsx (pure move).

import { Card, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { useFieldAccess } from "@medbrains/stores";
import type { Patient, PatientAllergy } from "@medbrains/types";
import { fieldAccessText } from "@medbrains/utils";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui";
import { patientDetailService } from "@/services/patientDetail.service";
import { age, formatDate, InfoRow } from "./shared";

export function OverviewTab({ patient }: { patient: Patient }) {
  const uhidAccess = useFieldAccess("patients.uhid");
  const firstNameAccess = useFieldAccess("patients.first_name");
  const middleNameAccess = useFieldAccess("patients.middle_name");
  const lastNameAccess = useFieldAccess("patients.last_name");
  const phoneAccess = useFieldAccess("patients.phone");
  const emailAccess = useFieldAccess("patients.email");
  const dobAccess = useFieldAccess("patients.date_of_birth");
  const { data: allergies } = useQuery({
    queryKey: ["patient-allergies", patient.id],
    queryFn: () => patientDetailService.listPatientAllergies(patient.id),
  });
  const displayName =
    [
      fieldAccessText(firstNameAccess, patient.first_name, "name"),
      fieldAccessText(middleNameAccess, patient.middle_name, "name"),
      fieldAccessText(lastNameAccess, patient.last_name, "name"),
    ]
      .filter((part) => part !== "—")
      .join(" ") || "—";
  const dateOfBirthValue =
    patient.date_of_birth && (dobAccess === "edit" || dobAccess === "view")
      ? `${formatDate(patient.date_of_birth)} (${age(patient.date_of_birth)})`
      : fieldAccessText(dobAccess, patient.date_of_birth, "identifier");

  return (
    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
      <Card withBorder>
        <Title order={5} mb="sm">
          Demographics
        </Title>
        <Stack gap="xs">
          <InfoRow label="UHID" value={fieldAccessText(uhidAccess, patient.uhid, "identifier")} />
          <InfoRow label="Name" value={displayName} />
          <InfoRow label="Gender" value={patient.gender} />
          <InfoRow label="Date of Birth" value={dateOfBirthValue} />
          <InfoRow label="Blood Group" value={patient.blood_group ?? "-"} />
          <InfoRow label="Marital Status" value={patient.marital_status ?? "-"} />
          <InfoRow label="Phone" value={fieldAccessText(phoneAccess, patient.phone, "phone")} />
          <InfoRow label="Email" value={fieldAccessText(emailAccess, patient.email, "email")} />
          <InfoRow label="Category" value={patient.category} />
          <InfoRow label="Financial Class" value={patient.financial_class} />
        </Stack>
      </Card>

      <Stack gap="md">
        <Card withBorder>
          <Title order={5} mb="sm">
            Visit Summary
          </Title>
          <Stack gap="xs">
            <InfoRow label="Total Visits" value={String(patient.total_visits)} />
            <InfoRow label="Last Visit" value={formatDate(patient.last_visit_date ?? null)} />
            <InfoRow label="Registration" value={patient.registration_type} />
            <InfoRow label="Registered" value={formatDate(patient.created_at)} />
          </Stack>
        </Card>

        <Card withBorder>
          <Title order={5} mb="sm">
            Allergies
          </Title>
          {patient.no_known_allergies ? (
            <Text size="sm" c="dimmed">
              No known allergies (NKDA)
            </Text>
          ) : allergies && allergies.length > 0 ? (
            <Stack gap="xs">
              {allergies.map((a: PatientAllergy) => (
                <Group key={a.id} gap="xs">
                  <Badge
                    tone={
                      a.severity === "severe" || a.severity === "life_threatening"
                        ? "danger"
                        : a.severity === "moderate"
                          ? "warning"
                          : "warning"
                    }
                    size="sm"
                  >
                    {a.severity}
                  </Badge>
                  <Text size="sm">
                    {a.allergen_name} ({a.allergy_type})
                  </Text>
                </Group>
              ))}
            </Stack>
          ) : (
            <Text size="sm" c="dimmed">
              No allergies recorded
            </Text>
          )}
        </Card>

        {(patient.is_vip || patient.is_medico_legal || patient.is_deceased) && (
          <Card withBorder>
            <Title order={5} mb="sm">
              Flags
            </Title>
            <Group gap="xs">
              {patient.is_vip && <Badge tone="accent">VIP</Badge>}
              {patient.is_medico_legal && <Badge tone="danger">Medico-Legal</Badge>}
              {patient.is_deceased && (
                <Badge tone="neutral" variant="filled">
                  Deceased
                </Badge>
              )}
            </Group>
          </Card>
        )}
      </Stack>
    </SimpleGrid>
  );
}

// ── Allergies Tab ─────────────────────────────────────────
