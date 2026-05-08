import { SimpleGrid, Stack, Text, Textarea } from "@mantine/core";
import type { PhysicalExamination } from "@medbrains/types";

interface PhysicalExamPanelProps {
  data: PhysicalExamination;
  generalAppearance: string;
  canUpdate: boolean;
  onUpdate: (exam: PhysicalExamination, generalAppearance?: string) => void;
}

const EXAM_SYSTEMS: { key: keyof PhysicalExamination; label: string; placeholder: string }[] = [
  { key: "heent", label: "HEENT", placeholder: "Head, eyes, ears, nose, throat findings..." },
  { key: "neck", label: "Neck", placeholder: "Thyroid, lymph nodes, JVP..." },
  {
    key: "cardiovascular",
    label: "Cardiovascular",
    placeholder: "Heart sounds, murmurs, peripheral pulses...",
  },
  {
    key: "respiratory",
    label: "Respiratory",
    placeholder: "Breath sounds, percussion, chest expansion...",
  },
  { key: "abdomen", label: "Abdomen", placeholder: "Tenderness, organomegaly, bowel sounds..." },
  {
    key: "musculoskeletal",
    label: "Musculoskeletal",
    placeholder: "ROM, deformity, swelling, tenderness...",
  },
  {
    key: "neurological",
    label: "Neurological",
    placeholder: "Cranial nerves, reflexes, motor, sensory...",
  },
  { key: "skin", label: "Skin", placeholder: "Lesions, rash, color, turgor..." },
  { key: "extremities", label: "Extremities", placeholder: "Edema, cyanosis, clubbing..." },
  { key: "genitourinary", label: "Genitourinary", placeholder: "If examined..." },
  { key: "psychiatric", label: "Psychiatric", placeholder: "Mood, affect, thought process..." },
];

export function PhysicalExamPanel({
  data,
  generalAppearance,
  canUpdate,
  onUpdate,
}: PhysicalExamPanelProps) {
  return (
    <Stack gap="sm">
      <Text size="sm" fw={600}>
        Physical Examination
      </Text>

      {/* General Appearance — standalone */}
      <Textarea
        label="General Appearance"
        value={generalAppearance}
        onChange={(e) => onUpdate(data, e.currentTarget.value)}
        placeholder="Alert, oriented, no acute distress..."
        autosize
        minRows={2}
        maxRows={4}
        disabled={!canUpdate}
        size="sm"
      />

      {/* System-by-system */}
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
        {EXAM_SYSTEMS.map((sys) => (
          <Textarea
            key={sys.key}
            label={sys.label}
            value={data[sys.key] ?? ""}
            onChange={(e) =>
              onUpdate({ ...data, [sys.key]: e.currentTarget.value }, generalAppearance)
            }
            placeholder={sys.placeholder}
            autosize
            minRows={2}
            maxRows={4}
            disabled={!canUpdate}
            size="sm"
          />
        ))}
      </SimpleGrid>
    </Stack>
  );
}
