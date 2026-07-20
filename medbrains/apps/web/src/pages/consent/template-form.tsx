// Consent TemplateForm — split from consent.tsx (pure move).

import {
  Group,
  JsonInput,
  MultiSelect,
  NumberInput,
  Select,
  Stack,
  Switch,
  TextInput,
} from "@mantine/core";
import type {
  ConsentTemplate,
  CreateConsentTemplateRequest,
  UpdateConsentTemplateRequest,
} from "@medbrains/types";
import { useState } from "react";
import { Button } from "@/components/ui";
import { TEMPLATE_CATEGORIES } from "./shared";

const REQUIRED_FIELD_OPTIONS = [
  { value: "witness_name", label: "Witness Name" },
  { value: "witness_signature", label: "Witness Signature" },
  { value: "doctor_signature", label: "Doctor Signature" },
  { value: "patient_signature", label: "Patient Signature" },
  { value: "guardian_name", label: "Guardian Name" },
  { value: "guardian_signature", label: "Guardian Signature" },
  { value: "interpreter_name", label: "Interpreter Name" },
  { value: "video_recording", label: "Video Recording" },
];

export function TemplateForm({
  initial,
  onSubmit,
  loading,
}: {
  initial: ConsentTemplate | null;
  onSubmit: (v: CreateConsentTemplateRequest | UpdateConsentTemplateRequest) => void;
  loading: boolean;
}) {
  const [code, setCode] = useState(initial?.code ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState<string | null>(initial?.category ?? "general");
  const [version, setVersion] = useState<number>(initial?.version ?? 1);
  const [bodyText, setBodyText] = useState(
    initial?.body_text ? JSON.stringify(initial.body_text, null, 2) : '{"en": ""}',
  );
  const [risksSection, setRisksSection] = useState(
    initial?.risks_section ? JSON.stringify(initial.risks_section, null, 2) : "",
  );
  const [alternativesSection, setAlternativesSection] = useState(
    initial?.alternatives_section ? JSON.stringify(initial.alternatives_section, null, 2) : "",
  );
  const [benefitsSection, setBenefitsSection] = useState(
    initial?.benefits_section ? JSON.stringify(initial.benefits_section, null, 2) : "",
  );
  const [requiredFields, setRequiredFields] = useState<string[]>(initial?.required_fields ?? []);
  const [requiresWitness, setRequiresWitness] = useState(initial?.requires_witness ?? false);
  const [requiresDoctor, setRequiresDoctor] = useState(initial?.requires_doctor ?? true);
  const [validityDays, setValidityDays] = useState<number | string>(initial?.validity_days ?? "");
  const [isReadAloud, setIsReadAloud] = useState(initial?.is_read_aloud_required ?? false);
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [sortOrder, setSortOrder] = useState<number>(initial?.sort_order ?? 0);

  const handleSubmit = () => {
    const parseJson = (s: string) => {
      if (!s.trim()) return undefined;
      try {
        return JSON.parse(s) as Record<string, string>;
      } catch {
        return undefined;
      }
    };

    const data: CreateConsentTemplateRequest = {
      code,
      name,
      category: (category ?? "general") as CreateConsentTemplateRequest["category"],
      version,
      body_text: parseJson(bodyText),
      risks_section: parseJson(risksSection),
      alternatives_section: parseJson(alternativesSection),
      benefits_section: parseJson(benefitsSection),
      required_fields: requiredFields,
      requires_witness: requiresWitness,
      requires_doctor: requiresDoctor,
      validity_days: typeof validityDays === "number" ? validityDays : undefined,
      is_read_aloud_required: isReadAloud,
      is_active: isActive,
      sort_order: sortOrder,
    };
    onSubmit(data);
  };

  return (
    <Stack>
      <TextInput
        label="Code"
        required
        value={code}
        onChange={(e) => setCode(e.target.value)}
        disabled={!!initial}
      />
      <TextInput label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
      <Select label="Category" data={TEMPLATE_CATEGORIES} value={category} onChange={setCategory} />
      <NumberInput
        label="Version"
        value={version}
        onChange={(v) => setVersion(Number(v))}
        min={1}
      />
      <JsonInput
        label="Body Text (JSON by language)"
        value={bodyText}
        onChange={setBodyText}
        minRows={4}
        formatOnBlur
        autosize
      />
      <JsonInput
        label="Risks Section (optional)"
        value={risksSection}
        onChange={setRisksSection}
        minRows={2}
        formatOnBlur
        autosize
      />
      <JsonInput
        label="Alternatives Section (optional)"
        value={alternativesSection}
        onChange={setAlternativesSection}
        minRows={2}
        formatOnBlur
        autosize
      />
      <JsonInput
        label="Benefits Section (optional)"
        value={benefitsSection}
        onChange={setBenefitsSection}
        minRows={2}
        formatOnBlur
        autosize
      />
      <MultiSelect
        label="Required Fields"
        data={REQUIRED_FIELD_OPTIONS}
        value={requiredFields}
        onChange={setRequiredFields}
      />
      <Group>
        <Switch
          label="Requires Witness"
          checked={requiresWitness}
          onChange={(e) => setRequiresWitness(e.currentTarget.checked)}
        />
        <Switch
          label="Requires Doctor"
          checked={requiresDoctor}
          onChange={(e) => setRequiresDoctor(e.currentTarget.checked)}
        />
        <Switch
          label="Read-Aloud Required"
          checked={isReadAloud}
          onChange={(e) => setIsReadAloud(e.currentTarget.checked)}
        />
        <Switch
          label="Active"
          checked={isActive}
          onChange={(e) => setIsActive(e.currentTarget.checked)}
        />
      </Group>
      <NumberInput
        label="Validity (days, blank = no expiry)"
        value={validityDays}
        onChange={setValidityDays}
        min={1}
      />
      <NumberInput label="Sort Order" value={sortOrder} onChange={(v) => setSortOrder(Number(v))} />
      <Button tone="primary" onClick={handleSubmit} loading={loading}>
        {initial ? "Update" : "Create"}
      </Button>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Death Certificate Form — Indian Form 4 / 4A
// ══════════════════════════════════════════════════════════
