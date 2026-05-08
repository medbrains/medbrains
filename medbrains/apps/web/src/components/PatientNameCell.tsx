import { Skeleton, Stack, Text, Tooltip } from "@mantine/core";
import { usePatientName } from "../hooks/usePatientName";

interface PatientNameCellProps {
  patientId: string | null | undefined;
  /** When true, renders UHID below the name (default true). */
  showUhid?: boolean;
  /** Override the rendered text size (default `"sm"`). */
  size?: "xs" | "sm" | "md";
}

/**
 * Resolve a `patient_id` to "Full Name" for table cells / detail rows.
 *
 * Replaces the old pattern `{row.patient_id.slice(0, 8)}...` which leaked
 * raw UUIDs to clinical users. Falls back to the short UUID only if the
 * lookup fails — never on success — so a network error still gives an
 * identifiable handle.
 */
export function PatientNameCell({ patientId, showUhid = true, size = "sm" }: PatientNameCellProps) {
  const { data, isLoading, isError } = usePatientName(patientId);

  if (!patientId) {
    return (
      <Text size={size} c="dimmed">
        —
      </Text>
    );
  }

  if (isLoading) {
    return <Skeleton height={14} width={120} radius="sm" />;
  }

  if (isError || !data) {
    return (
      <Tooltip label={`Could not resolve patient ${patientId}`} withArrow>
        <Text size={size} c="dimmed">
          {patientId.slice(0, 8)}…
        </Text>
      </Tooltip>
    );
  }

  if (!showUhid) {
    return <Text size={size}>{data.full_name}</Text>;
  }

  return (
    <Stack gap={0}>
      <Text size={size} fw={500}>
        {data.full_name}
      </Text>
      <Text size="xs" c="dimmed" ff="monospace">
        {data.uhid}
      </Text>
    </Stack>
  );
}
