// Consent DeathCertificateForm — split from consent.tsx (pure move).

import {
  Divider,
  Grid,
  Group,
  NumberInput,
  Radio,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import type { CreateConsentTemplateRequest } from "@medbrains/types";
import { IconCertificate } from "@tabler/icons-react";
import { useState } from "react";
import { Badge, Button } from "@/components/ui";

const MANNER_OF_DEATH_OPTIONS = [
  { value: "natural", label: "Natural" },
  { value: "accident", label: "Accident" },
  { value: "suicide", label: "Suicide" },
  { value: "homicide", label: "Homicide" },
  { value: "undetermined", label: "Undetermined" },
  { value: "pending_investigation", label: "Pending Investigation" },
];

export function DeathCertificateForm({
  onSubmit,
  loading,
}: {
  onSubmit: (v: CreateConsentTemplateRequest) => void;
  loading: boolean;
}) {
  const [formType, setFormType] = useState<string>("form_4");
  const [deceasedName, setDeceasedName] = useState("");
  const [age, setAge] = useState<number | string>("");
  const [sex, setSex] = useState<string | null>(null);
  const [dateOfDeath, setDateOfDeath] = useState("");
  const [timeOfDeath, setTimeOfDeath] = useState("");
  const [placeOfDeath, setPlaceOfDeath] = useState("");
  const [causeImmediate, setCauseImmediate] = useState("");
  const [causeAntecedent, setCauseAntecedent] = useState("");
  const [causeUnderlying, setCauseUnderlying] = useState("");
  const [causeOtherSignificant, setCauseOtherSignificant] = useState("");
  const [mannerOfDeath, setMannerOfDeath] = useState<string | null>("natural");
  const [durationOfIllness, setDurationOfIllness] = useState("");
  const [autopsyRequested, setAutopsyRequested] = useState(false);
  const [isMedicoLegal, setIsMedicoLegal] = useState(false);
  const [certifyingDoctor, setCertifyingDoctor] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [witnessName, setWitnessName] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = () => {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, "");
    const code = `DEATH-CERT-${timestamp}`;

    const content: Record<string, string> = {
      form_type: formType,
      deceased_name: deceasedName,
      age: String(age),
      sex: sex ?? "",
      date_of_death: dateOfDeath,
      time_of_death: timeOfDeath,
      place_of_death: placeOfDeath,
      cause_immediate: causeImmediate,
      cause_antecedent: causeAntecedent,
      cause_underlying: causeUnderlying,
      cause_other_significant: causeOtherSignificant,
      manner_of_death: mannerOfDeath ?? "natural",
      duration_of_illness: durationOfIllness,
      autopsy_requested: String(autopsyRequested),
      is_medico_legal: String(isMedicoLegal),
      certifying_doctor: certifyingDoctor,
      registration_number: registrationNumber,
      witness_name: witnessName,
      notes,
    };

    onSubmit({
      code,
      name: `Death Certificate — ${deceasedName || "Unnamed"} — ${dateOfDeath || "No Date"}`,
      category: "custom" as CreateConsentTemplateRequest["category"],
      version: 1,
      body_text: content,
      requires_witness: true,
      requires_doctor: true,
      is_active: true,
      sort_order: 0,
    });
  };

  return (
    <Stack>
      <Title order={5}>Indian Registration of Births and Deaths Act</Title>
      <Radio.Group value={formType} onChange={setFormType} label="Form Type" withAsterisk>
        <Group mt={4}>
          <Radio value="form_4" label="Form 4 — Certificate of Cause of Death" />
          <Radio value="form_4a" label="Form 4A — Certificate (Institutional)" />
        </Group>
      </Radio.Group>

      <Divider label="Deceased Details" labelPosition="left" />

      <Grid>
        <Grid.Col span={6}>
          <TextInput
            label="Name of Deceased"
            required
            value={deceasedName}
            onChange={(e) => setDeceasedName(e.target.value)}
          />
        </Grid.Col>
        <Grid.Col span={3}>
          <NumberInput label="Age (years)" value={age} onChange={setAge} min={0} max={150} />
        </Grid.Col>
        <Grid.Col span={3}>
          <Select
            label="Sex"
            data={[
              { value: "male", label: "Male" },
              { value: "female", label: "Female" },
              { value: "other", label: "Other" },
            ]}
            value={sex}
            onChange={setSex}
          />
        </Grid.Col>
      </Grid>

      <Grid>
        <Grid.Col span={4}>
          <TextInput
            label="Date of Death"
            type="date"
            required
            value={dateOfDeath}
            onChange={(e) => setDateOfDeath(e.target.value)}
          />
        </Grid.Col>
        <Grid.Col span={4}>
          <TextInput
            label="Time of Death"
            type="time"
            required
            value={timeOfDeath}
            onChange={(e) => setTimeOfDeath(e.target.value)}
          />
        </Grid.Col>
        <Grid.Col span={4}>
          <TextInput
            label="Place of Death"
            value={placeOfDeath}
            onChange={(e) => setPlaceOfDeath(e.target.value)}
          />
        </Grid.Col>
      </Grid>

      <Divider label="Cause of Death (WHO ICD format)" labelPosition="left" />

      <Text size="xs" c="dimmed">
        Part I: Disease or condition directly leading to death and its chain of causation.
      </Text>
      <TextInput
        label="(a) Immediate Cause"
        required
        value={causeImmediate}
        onChange={(e) => setCauseImmediate(e.target.value)}
        description="Disease or condition directly leading to death"
      />
      <TextInput
        label="(b) Antecedent Cause"
        value={causeAntecedent}
        onChange={(e) => setCauseAntecedent(e.target.value)}
        description="Due to (or as a consequence of)"
      />
      <TextInput
        label="(c) Underlying Cause"
        value={causeUnderlying}
        onChange={(e) => setCauseUnderlying(e.target.value)}
        description="Due to (or as a consequence of)"
      />

      <Text size="xs" c="dimmed" mt="xs">
        Part II: Other significant conditions contributing to the death but not related to the
        cause.
      </Text>
      <Textarea
        label="Other Significant Conditions"
        value={causeOtherSignificant}
        onChange={(e) => setCauseOtherSignificant(e.target.value)}
        minRows={2}
      />

      <Divider label="Manner and Circumstances" labelPosition="left" />

      <Grid>
        <Grid.Col span={6}>
          <Select
            label="Manner of Death"
            data={MANNER_OF_DEATH_OPTIONS}
            value={mannerOfDeath}
            onChange={setMannerOfDeath}
          />
        </Grid.Col>
        <Grid.Col span={6}>
          <TextInput
            label="Duration of Illness"
            value={durationOfIllness}
            onChange={(e) => setDurationOfIllness(e.target.value)}
            placeholder="e.g. 3 months, 2 years"
          />
        </Grid.Col>
      </Grid>

      <Group>
        <Switch
          label="Autopsy Requested"
          checked={autopsyRequested}
          onChange={(e) => setAutopsyRequested(e.currentTarget.checked)}
        />
        <Switch
          label="Medico-Legal Case"
          checked={isMedicoLegal}
          onChange={(e) => setIsMedicoLegal(e.currentTarget.checked)}
          color="danger"
        />
      </Group>

      {isMedicoLegal && (
        <Badge tone="danger" size="lg">
          MLC — Police intimation and inquest required under CrPC
        </Badge>
      )}

      <Divider label="Certification" labelPosition="left" />

      <Grid>
        <Grid.Col span={6}>
          <TextInput
            label="Certifying Doctor Name"
            required
            value={certifyingDoctor}
            onChange={(e) => setCertifyingDoctor(e.target.value)}
          />
        </Grid.Col>
        <Grid.Col span={6}>
          <TextInput
            label="Medical Registration No."
            required
            value={registrationNumber}
            onChange={(e) => setRegistrationNumber(e.target.value)}
          />
        </Grid.Col>
      </Grid>
      <TextInput
        label="Witness Name"
        value={witnessName}
        onChange={(e) => setWitnessName(e.target.value)}
      />
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
        leftSection={<IconCertificate size={16} />}
      >
        Create Death Certificate Template
      </Button>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Medico-Legal Opinion Form
// ══════════════════════════════════════════════════════════
