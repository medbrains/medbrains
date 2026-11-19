import { Text } from "@mantine/core";
import type { RecordAccess } from "@medbrains/types";
import { useTranslation } from "react-i18next";

interface ClinicalTextProps {
  /** The field's value; shown as is when present. */
  value?: string | null;
  access?: RecordAccess;
  /** Shown when the row is readable and the field is simply empty ("Not recorded"). */
  empty?: string;
}

/**
 * A clinical cell: its value, or why it is empty — never recorded, outside the caller's care, or
 * the access check could not be answered. The three must not look alike — an
 * outage drawn as "Not recorded" tells a nurse nobody wrote a complaint.
 */
export function ClinicalText({ value, access, empty }: ClinicalTextProps) {
  const { t } = useTranslation("opd");
  if (value) {
    return (
      <Text size="sm" lineClamp={2}>
        {value}
      </Text>
    );
  }
  if (access === "unknown") {
    return (
      <Text size="sm" c="dimmed" fs="italic">
        {t("access.unchecked", "Couldn't check access")}
      </Text>
    );
  }
  const label =
    access === "withheld"
      ? t("access.withheld", "Outside your care")
      : (empty ?? t("queue.noComplaint", "Not recorded"));
  return (
    <Text size="sm" c="dimmed">
      {label}
    </Text>
  );
}
