// Emergency MLC print-preview components — split from emergency.tsx (pure move).

import { Box, Paper, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import type {
  MlcDocumentationPrintData,
  MlcPoliceIntimationPrintData,
  MlcRegisterPrintData,
} from "@medbrains/types";
import {
  protectedEmergencyPatientIdentifier,
  protectedEmergencyPatientName,
  useEmergencyPatientIdentityAccess,
} from "./shared";

function printDisplayValue(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) {
    return "---";
  }
  const text = String(value).trim();
  return text.length > 0 ? text : "---";
}

function PrintDataField({
  label,
  value,
}: {
  label: string;
  value: string | number | boolean | null | undefined;
}) {
  return (
    <Box>
      <Text className="print-label" size="xs" c="dimmed" tt="uppercase">
        {label}
      </Text>
      <Text className="print-value" size="sm" fw={600}>
        {printDisplayValue(value)}
      </Text>
    </Box>
  );
}

export function MlcRegisterPrintPreview({ data }: { data: MlcRegisterPrintData }) {
  const patientIdentityAccess = useEmergencyPatientIdentityAccess();

  return (
    <Stack gap="md">
      <SimpleGrid className="print-grid" cols={{ base: 1, sm: 2 }}>
        <PrintDataField label="MLC number" value={data.mlc_number} />
        <PrintDataField
          label="Registered"
          value={`${data.registration_date} ${data.registration_time}`}
        />
        <PrintDataField
          label="Patient"
          value={protectedEmergencyPatientName(data.patient_name, patientIdentityAccess.name)}
        />
        <PrintDataField
          label="UHID"
          value={protectedEmergencyPatientIdentifier(data.uhid, patientIdentityAccess.uhid)}
        />
        <PrintDataField label="Age" value={data.age} />
        <PrintDataField label="Gender" value={data.gender} />
        <PrintDataField label="Brought by" value={data.brought_by} />
        <PrintDataField label="Police station" value={data.police_station} />
        <PrintDataField label="Police officer" value={data.police_officer_name} />
        <PrintDataField label="Police rank" value={data.police_officer_rank} />
        <PrintDataField label="DD number" value={data.police_dd_number} />
        <PrintDataField label="Nature of case" value={data.nature_of_case} />
        <PrintDataField label="Incident date/time" value={data.date_time_of_incident} />
        <PrintDataField label="Incident place" value={data.place_of_incident} />
        <PrintDataField label="Weapon used" value={data.weapon_used} />
        <PrintDataField label="Examined by" value={data.examining_doctor} />
        <PrintDataField label="Examined at" value={data.examined_at} />
      </SimpleGrid>

      <Box className="print-section">
        <Title order={6}>Alleged History</Title>
        <Text size="sm">{printDisplayValue(data.alleged_history)}</Text>
      </Box>

      <Box className="print-section">
        <Title order={6}>Condition and Treatment</Title>
        <SimpleGrid className="print-grid" cols={{ base: 1, sm: 2 }}>
          <PrintDataField label="Condition on arrival" value={data.condition_on_arrival} />
          <PrintDataField label="Treatment given" value={data.treatment_given} />
          <PrintDataField label="Samples handed to" value={data.samples_handed_to} />
          <PrintDataField label="Opinion" value={data.opinion} />
          <PrintDataField
            label="Condition at discharge"
            value={data.patient_condition_at_discharge}
          />
        </SimpleGrid>
      </Box>

      <Box className="print-section">
        <Title order={6}>Injuries Noted</Title>
        {data.injuries_noted.length > 0 ? (
          <Stack gap="xs">
            {data.injuries_noted.map((injury) => (
              <Paper key={injury.injury_number} withBorder p="xs">
                <Text size="sm" fw={600}>
                  {injury.injury_number}. {injury.injury_type} - {injury.location}
                </Text>
                <Text size="sm">{injury.description}</Text>
                <Text size="xs" c="dimmed">
                  Size: {printDisplayValue(injury.size_cm)} · Age:{" "}
                  {printDisplayValue(injury.probable_age)} · Weapon:{" "}
                  {printDisplayValue(injury.probable_weapon)}
                </Text>
              </Paper>
            ))}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">
            No injuries recorded.
          </Text>
        )}
      </Box>

      <Box className="print-section">
        <Title order={6}>Samples Collected</Title>
        {data.samples_collected.length > 0 ? (
          <Stack gap={2}>
            {data.samples_collected.map((sample) => (
              <Text key={sample} size="sm">
                {sample}
              </Text>
            ))}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">
            No samples recorded.
          </Text>
        )}
      </Box>
    </Stack>
  );
}

export function MlcDocumentationPrintPreview({ data }: { data: MlcDocumentationPrintData }) {
  const patientIdentityAccess = useEmergencyPatientIdentityAccess();

  return (
    <Stack gap="md">
      <SimpleGrid className="print-grid" cols={{ base: 1, sm: 2 }}>
        <PrintDataField label="MLC number" value={data.mlc_number} />
        <PrintDataField
          label="Patient"
          value={protectedEmergencyPatientName(data.patient_name, patientIdentityAccess.name)}
        />
        <PrintDataField
          label="UHID"
          value={protectedEmergencyPatientIdentifier(data.uhid, patientIdentityAccess.uhid)}
        />
        <PrintDataField label="Age" value={data.age} />
        <PrintDataField label="Gender" value={data.gender} />
        <PrintDataField label="Admission date" value={data.admission_date} />
        <PrintDataField label="Discharge date" value={data.discharge_date} />
        <PrintDataField label="Police station" value={data.police_station} />
        <PrintDataField label="FIR number" value={data.fir_number} />
        <PrintDataField label="Court case" value={data.court_case_number} />
        <PrintDataField label="Prepared by" value={data.prepared_by} />
        <PrintDataField label="Verified by" value={data.verified_by} />
        <PrintDataField label="Prepared at" value={data.prepared_at} />
      </SimpleGrid>

      <Box className="print-section">
        <Title order={6}>Clinical Summary</Title>
        <SimpleGrid className="print-grid" cols={{ base: 1, sm: 2 }}>
          <PrintDataField label="Final diagnosis" value={data.final_diagnosis} />
          <PrintDataField label="Treatment summary" value={data.treatment_summary} />
          <PrintDataField label="Investigation summary" value={data.investigation_summary} />
          <PrintDataField
            label="Findings at discharge"
            value={data.clinical_findings_at_discharge}
          />
          <PrintDataField label="Complications" value={data.complications} />
          <PrintDataField label="Prognosis" value={data.prognosis} />
          <PrintDataField label="Permanent disability" value={data.permanent_disability} />
          <PrintDataField label="Disability percentage" value={data.disability_percentage} />
        </SimpleGrid>
      </Box>

      <Box className="print-section">
        <Title order={6}>Operative Procedures</Title>
        {data.operative_procedures.length > 0 ? (
          <Stack gap={2}>
            {data.operative_procedures.map((procedure) => (
              <Text key={procedure} size="sm">
                {procedure}
              </Text>
            ))}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">
            No procedures recorded.
          </Text>
        )}
      </Box>

      <Box className="print-section">
        <Title order={6}>Police Visits</Title>
        {data.police_visits.length > 0 ? (
          <Stack gap="xs">
            {data.police_visits.map((visit) => (
              <Paper key={`${visit.visit_date}-${visit.officer_name}`} withBorder p="xs">
                <Text size="sm" fw={600}>
                  {visit.visit_date} · {visit.officer_name}
                </Text>
                <Text size="sm">{visit.purpose}</Text>
                <Text size="xs" c="dimmed">
                  Rank: {visit.officer_rank} · Statement recorded:{" "}
                  {visit.statement_recorded ? "Yes" : "No"}
                </Text>
              </Paper>
            ))}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">
            No police visits recorded.
          </Text>
        )}
      </Box>

      <Box className="print-section">
        <Title order={6}>Samples Preserved</Title>
        {data.samples_preserved.length > 0 ? (
          <Stack gap="xs">
            {data.samples_preserved.map((sample) => (
              <Paper key={`${sample.sample_type}-${sample.collected_date}`} withBorder p="xs">
                <Text size="sm" fw={600}>
                  {sample.sample_type}
                </Text>
                <Text size="xs" c="dimmed">
                  Quantity: {sample.quantity} · Preserved in: {sample.preservation_method} ·
                  Collected: {sample.collected_date}
                </Text>
                <Text size="xs" c="dimmed">
                  Handed to: {printDisplayValue(sample.handed_to)} · Handed date:{" "}
                  {printDisplayValue(sample.handed_date)}
                </Text>
              </Paper>
            ))}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">
            No preserved samples recorded.
          </Text>
        )}
      </Box>

      <Box className="print-section">
        <Title order={6}>Important Dates</Title>
        {data.important_dates.length > 0 ? (
          <Stack gap={2}>
            {data.important_dates.map((entry) => (
              <Text key={`${entry.event_date}-${entry.event_description}`} size="sm">
                <Text span fw={600}>
                  {entry.event_date}:
                </Text>{" "}
                {entry.event_description}
              </Text>
            ))}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">
            No timeline entries recorded.
          </Text>
        )}
      </Box>

      <Box className="print-section">
        <Title order={6}>Certificates Issued</Title>
        {data.certificates_issued.length > 0 ? (
          <Stack gap={2}>
            {data.certificates_issued.map((certificate) => (
              <Text key={certificate} size="sm">
                {certificate}
              </Text>
            ))}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">
            No certificates recorded.
          </Text>
        )}
      </Box>
    </Stack>
  );
}

export function MlcPoliceIntimationPrintPreview({ data }: { data: MlcPoliceIntimationPrintData }) {
  const patientIdentityAccess = useEmergencyPatientIdentityAccess();

  return (
    <Stack gap="md">
      <SimpleGrid className="print-grid" cols={{ base: 1, sm: 2 }}>
        <PrintDataField label="Intimation number" value={data.intimation_number} />
        <PrintDataField label="MLC number" value={data.mlc_number} />
        <PrintDataField
          label="Patient"
          value={protectedEmergencyPatientName(data.patient_name, patientIdentityAccess.name)}
        />
        <PrintDataField
          label="UHID"
          value={protectedEmergencyPatientIdentifier(data.uhid, patientIdentityAccess.uhid)}
        />
        <PrintDataField label="Age" value={data.age} />
        <PrintDataField label="Gender" value={data.gender} />
        <PrintDataField label="Police station" value={data.police_station} />
        <PrintDataField label="Sent at" value={data.sent_at} />
        <PrintDataField label="Sent via" value={data.sent_via} />
        <PrintDataField label="Sent by" value={data.sent_by} />
      </SimpleGrid>

      <Box className="print-section">
        <Title order={6}>Police Contact</Title>
        <SimpleGrid className="print-grid" cols={{ base: 1, sm: 2 }}>
          <PrintDataField label="Officer" value={data.officer_name} />
          <PrintDataField label="Designation" value={data.officer_designation} />
          <PrintDataField label="Contact" value={data.officer_contact} />
          <PrintDataField
            label="Receipt"
            value={data.receipt_confirmed ? "Confirmed" : "Pending"}
          />
          <PrintDataField label="Receipt number" value={data.receipt_number} />
          <PrintDataField label="Receipt confirmed at" value={data.receipt_confirmed_at} />
        </SimpleGrid>
      </Box>

      <Box className="print-section">
        <Title order={6}>Notes</Title>
        <Text size="sm">{printDisplayValue(data.notes)}</Text>
      </Box>

      <Text size="xs" c="dimmed">
        Generated at {data.generated_at}
      </Text>
    </Stack>
  );
}
