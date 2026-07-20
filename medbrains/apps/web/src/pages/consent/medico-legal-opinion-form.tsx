// Consent MedicoLegalOpinionForm — split from consent.tsx (pure move).

import {
  Divider,
  Grid,
  Group,
  NumberInput,
  Radio,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import type { CreateConsentTemplateRequest } from "@medbrains/types";
import { IconScale } from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "@/components/ui";

const INJURY_CLASSIFICATION_OPTIONS = [
  { value: "simple", label: "Simple" },
  { value: "grievous", label: "Grievous" },
  { value: "dangerous", label: "Dangerous to life" },
];

export function MedicoLegalOpinionForm({
  onSubmit,
  loading,
}: {
  onSubmit: (v: CreateConsentTemplateRequest) => void;
  loading: boolean;
}) {
  const [caseReference, setCaseReference] = useState("");
  const [examinationDate, setExaminationDate] = useState("");
  const [patientName, setPatientName] = useState("");
  const [patientAge, setPatientAge] = useState<number | string>("");
  const [patientSex, setPatientSex] = useState<string | null>(null);
  const [historyOfIncident, setHistoryOfIncident] = useState("");
  const [findingsOnExamination, setFindingsOnExamination] = useState("");
  const [investigationsDone, setInvestigationsDone] = useState("");
  const [opinion, setOpinion] = useState("");
  const [injuryClassification, setInjuryClassification] = useState<string | null>(null);
  const [weaponUsedLikely, setWeaponUsedLikely] = useState("");
  const [timeSinceInjuryEstimate, setTimeSinceInjuryEstimate] = useState("");
  const [fitnessForDischarge, setFitnessForDischarge] = useState<string>("yes");
  const [dischargeConditions, setDischargeConditions] = useState("");
  const [examiningDoctor, setExaminingDoctor] = useState("");
  const [doctorRegistrationNo, setDoctorRegistrationNo] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = () => {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, "");
    const code = `MLO-${timestamp}`;

    const content: Record<string, string> = {
      case_reference: caseReference,
      examination_date: examinationDate,
      patient_name: patientName,
      patient_age: String(patientAge),
      patient_sex: patientSex ?? "",
      history_of_incident: historyOfIncident,
      findings_on_examination: findingsOnExamination,
      investigations_done: investigationsDone,
      opinion,
      injury_classification: injuryClassification ?? "",
      weapon_used_likely: weaponUsedLikely,
      time_since_injury_estimate: timeSinceInjuryEstimate,
      fitness_for_discharge: fitnessForDischarge,
      discharge_conditions: dischargeConditions,
      examining_doctor: examiningDoctor,
      doctor_registration_no: doctorRegistrationNo,
      notes,
    };

    onSubmit({
      code,
      name: `Medico-Legal Opinion — ${patientName || "Unnamed"} — ${caseReference || "No Ref"}`,
      category: "custom" as CreateConsentTemplateRequest["category"],
      version: 1,
      body_text: content,
      requires_witness: false,
      requires_doctor: true,
      is_active: true,
      sort_order: 0,
    });
  };

  return (
    <Stack>
      <Title order={5}>Medico-Legal Opinion / Certificate</Title>
      <Text size="xs" c="dimmed">
        As per Indian Penal Code (IPC) Sections 319-326, Classification of Injuries Act, and
        Medico-Legal Practice Guidelines.
      </Text>

      <Divider label="Case Details" labelPosition="left" />

      <Grid>
        <Grid.Col span={6}>
          <TextInput
            label="Case Reference / FIR No."
            required
            value={caseReference}
            onChange={(e) => setCaseReference(e.target.value)}
            description="MLC number or FIR reference"
          />
        </Grid.Col>
        <Grid.Col span={6}>
          <TextInput
            label="Date of Examination"
            type="date"
            required
            value={examinationDate}
            onChange={(e) => setExaminationDate(e.target.value)}
          />
        </Grid.Col>
      </Grid>

      <Divider label="Patient Details" labelPosition="left" />

      <Grid>
        <Grid.Col span={6}>
          <TextInput
            label="Patient Name"
            required
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
          />
        </Grid.Col>
        <Grid.Col span={3}>
          <NumberInput label="Age" value={patientAge} onChange={setPatientAge} min={0} max={150} />
        </Grid.Col>
        <Grid.Col span={3}>
          <Select
            label="Sex"
            data={[
              { value: "male", label: "Male" },
              { value: "female", label: "Female" },
              { value: "other", label: "Other" },
            ]}
            value={patientSex}
            onChange={setPatientSex}
          />
        </Grid.Col>
      </Grid>

      <Divider label="Clinical Examination" labelPosition="left" />

      <Textarea
        label="History of Incident"
        required
        value={historyOfIncident}
        onChange={(e) => setHistoryOfIncident(e.target.value)}
        minRows={3}
        description="As narrated by patient/attendant/police"
      />

      <Textarea
        label="Findings on Examination"
        required
        value={findingsOnExamination}
        onChange={(e) => setFindingsOnExamination(e.target.value)}
        minRows={4}
        description="Describe all injuries with location, size, shape, type (laceration/contusion/abrasion/fracture)"
      />

      <Textarea
        label="Investigations Done"
        value={investigationsDone}
        onChange={(e) => setInvestigationsDone(e.target.value)}
        minRows={2}
        description="X-ray, CT, blood tests, and their findings"
      />

      <Divider label="Medical Opinion" labelPosition="left" />

      <Textarea
        label="Opinion"
        required
        value={opinion}
        onChange={(e) => setOpinion(e.target.value)}
        minRows={4}
        description="Nature of injuries, causative agent, age of injury, and prognosis"
      />

      <Grid>
        <Grid.Col span={6}>
          <Select
            label="Classification of Injury"
            data={INJURY_CLASSIFICATION_OPTIONS}
            value={injuryClassification}
            onChange={setInjuryClassification}
            description="As per IPC Sec 319-326"
          />
        </Grid.Col>
        <Grid.Col span={6}>
          <TextInput
            label="Weapon/Object Used (Likely)"
            value={weaponUsedLikely}
            onChange={(e) => setWeaponUsedLikely(e.target.value)}
            description="Sharp/blunt/firearm/other"
          />
        </Grid.Col>
      </Grid>

      <TextInput
        label="Time Since Injury (Estimate)"
        value={timeSinceInjuryEstimate}
        onChange={(e) => setTimeSinceInjuryEstimate(e.target.value)}
        placeholder="e.g. approximately 6-12 hours"
      />

      <Divider label="Fitness for Discharge" labelPosition="left" />

      <Radio.Group
        value={fitnessForDischarge}
        onChange={setFitnessForDischarge}
        label="Fitness for Discharge"
      >
        <Group mt={4}>
          <Radio value="yes" label="Yes — Fit for discharge" />
          <Radio value="no" label="No — Requires admission" />
          <Radio value="conditional" label="Conditional — With restrictions" />
        </Group>
      </Radio.Group>

      {fitnessForDischarge === "conditional" && (
        <Textarea
          label="Discharge Conditions"
          value={dischargeConditions}
          onChange={(e) => setDischargeConditions(e.target.value)}
          minRows={2}
          description="Specify restrictions and follow-up requirements"
        />
      )}

      <Divider label="Certification" labelPosition="left" />

      <Grid>
        <Grid.Col span={6}>
          <TextInput
            label="Examining Doctor Name"
            required
            value={examiningDoctor}
            onChange={(e) => setExaminingDoctor(e.target.value)}
          />
        </Grid.Col>
        <Grid.Col span={6}>
          <TextInput
            label="Medical Registration No."
            required
            value={doctorRegistrationNo}
            onChange={(e) => setDoctorRegistrationNo(e.target.value)}
          />
        </Grid.Col>
      </Grid>

      <Textarea
        label="Additional Notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        minRows={2}
      />

      <Button
        tone="primary"
        onClick={handleSubmit}
        loading={loading}
        leftSection={<IconScale size={16} />}
      >
        Create Medico-Legal Opinion Template
      </Button>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 2 — Audit Trail
// ══════════════════════════════════════════════════════════
