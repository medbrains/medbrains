// The patient list's blood group cell.

import { Text } from "@mantine/core";
import { bloodGroupLabel } from "@medbrains/types";
import { IconDroplet } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { StatusDot } from "@/components";

interface BloodGroupCellProps {
  /** As the server sent it: null when not recorded or withheld from this role. */
  value: string | null | undefined;
}

/**
 * The blood group as recorded, or "—" when there is none to show. "unknown"
 * is a recorded answer of "not known", so it reads as "—" too, never a guess.
 */
export function BloodGroupCell({ value }: BloodGroupCellProps) {
  const { t } = useTranslation("patients");
  if (!value || value === "unknown") {
    return (
      <Text size="sm" c="dimmed">
        —
      </Text>
    );
  }
  return (
    <StatusDot
      color="danger"
      icon={IconDroplet}
      label={t(`options.bloodGroup.${value}`, { defaultValue: bloodGroupLabel(value) })}
      size="sm"
    />
  );
}
