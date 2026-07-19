// Shared patient-detail helpers — date/money/time formatters, HTML escaping, age derivation
// and the InfoRow label/value pair, extracted from patient-detail.tsx so the tab components
// can split into their own files without a cycle.

import { Group, Text } from "@mantine/core";

export function formatDate(d: string | null): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatMoney(value: number | string | null | undefined): string {
  const amount = typeof value === "number" ? value : Number.parseFloat(value ?? "0");
  return `₹${(Number.isFinite(amount) ? amount : 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
  })}`;
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
