import { Text } from "@mantine/core";
import type { LastOpdVisit } from "@medbrains/types";
import { formatDate } from "@/lib/date-utils";

interface LastVisitHintProps {
  visit: LastOpdVisit | null | undefined;
  isError: boolean;
}

/** Who saw a returning patient last, under the patient picker. */
export function LastVisitHint({ visit, isError }: LastVisitHintProps) {
  if (isError) {
    return (
      <Text size="sm" c="dimmed">
        The last visit could not be loaded; choose the doctor yourself.
      </Text>
    );
  }
  if (visit === undefined) return null;
  if (visit === null) {
    return (
      <Text size="sm" c="dimmed">
        First OPD visit.
      </Text>
    );
  }
  const who = [visit.doctor_name, visit.department_name].filter(Boolean).join(" · ");
  const gone = visit.doctor_name && !visit.doctor_id ? " — no longer taking patients" : "";
  return (
    <Text size="sm" data-testid="last-visit-hint">
      Last visit {formatDate(visit.encounter_date)}
      {who ? ` · ${who}` : ""}
      {gone}
    </Text>
  );
}
