// Nurse Activities shared helpers — split from nurse-activities.tsx (pure move).

import { Card, Text, TextInput } from "@mantine/core";
import { EncounterSelect } from "@/components/EncounterSelect";
import type { BadgeTone } from "@/components/ui";

export function compactId(value: string): string {
  return value ? value.slice(0, 8) : "";
}

export function EncounterContextField({
  value,
  onChange,
  locked,
  patientId,
}: {
  value: string;
  onChange: (value: string) => void;
  locked: boolean;
  patientId?: string;
}) {
  if (locked) {
    return (
      <Card withBorder padding="sm">
        <Text size="xs" c="dimmed">
          Linked encounter
        </Text>
        <Text size="sm" fw={700}>
          {compactId(value)}
        </Text>
      </Card>
    );
  }

  if (patientId) {
    return (
      <EncounterSelect
        label="Encounter"
        value={value}
        patientId={patientId}
        onChange={(encounterId) => onChange(encounterId)}
      />
    );
  }

  return (
    <TextInput
      label="Encounter ID"
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
      w={400}
      placeholder="Open from IPD to auto-link"
    />
  );
}

export type ClinicalStatusTone = "good" | "low" | "high" | "critical" | "neutral";

export interface ClinicalStatus {
  label: string;
  color: string;
  tone: ClinicalStatusTone;
  detail?: string;
}

export const NEUTRAL_STATUS: ClinicalStatus = {
  label: "Not entered",
  color: "gray",
  tone: "neutral",
};

export function toNumber(value: string | number, fallback = 0): number {
  if (typeof value === "number") {
    return value;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function encounterLocked(initialEncounterId: string): boolean {
  return initialEncounterId.length > 0;
}

export function statusBadgeTone(color: string): BadgeTone {
  const m: Record<string, BadgeTone> = {
    success: "success",
    danger: "danger",
    warning: "warning",
    primary: "primary",
    info: "info",
    slate: "neutral",
    gray: "neutral",
    teal: "success",
    green: "success",
    red: "danger",
    yellow: "warning",
    orange: "warning",
    blue: "info",
    violet: "accent",
    cinnabar: "accent",
  };
  return (color ? m[color] : undefined) ?? "neutral";
}

export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}
