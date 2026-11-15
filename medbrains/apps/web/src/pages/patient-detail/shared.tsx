// Shared patient-detail helpers — date/money/time formatters, HTML escaping, age derivation
// and the InfoRow label/value pair, extracted from patient-detail.tsx so the tab components
// can split into their own files without a cycle.

import { Group, Text } from "@mantine/core";
import { useLocaleStore } from "@medbrains/stores";
import {
  formatCalendarDate,
  formatDate as formatInstant,
  formatMoney as formatProfileMoney,
} from "@medbrains/utils";

/** A `date` column (birth date, visit day): a calendar day no zone may shift. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The hospital's profile as it is now.
 * ponytail: a snapshot, not a subscription; the tabs render after sign-in
 * loads it and re-render on navigation. Subscribe if a profile change must
 * repaint an open tab.
 */
function profile() {
  return useLocaleStore.getState().profile?.values ?? {};
}

/** A date or instant in the hospital's format; "-" when there is none. */
export function formatDate(d: string | null): string {
  if (!d) return "-";
  return DATE_ONLY.test(d) ? formatCalendarDate(d, profile()) : formatInstant(d, profile());
}

/** An amount in the hospital's currency, exact (the API sends decimal strings). */
export function formatMoney(value: number | string | null | undefined): string {
  return formatProfileMoney(value ?? 0, profile());
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
}

export function age(dob: string | null): string {
  if (!dob) return "-";
  const years = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  return `${years}y`;
}

export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <Group justify="space-between" gap="xl">
      <Text size="sm" c="dimmed" w={130}>
        {label}
      </Text>
      <Text size="sm" fw={500} style={{ flex: 1, textAlign: "right" }}>
        {value}
      </Text>
    </Group>
  );
}
