import { Anchor, Card, Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P, type UnsignedNote } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { Alert, Badge } from "@/components/ui";
import { clinicalNotesService } from "@/services/clinicalNotes.service";

/** Where a draft's case sheet lives. */
function sheetHref(note: UnsignedNote): string {
  if (note.encounter_type === "ipd" && note.admission_id) {
    return `/ipd/admissions/${note.admission_id}#notes`;
  }
  if (note.encounter_type === "emergency" && note.er_visit_id) {
    return `/emergency/visits/${note.er_visit_id}#er-case-sheet`;
  }
  return `/opd/encounters/${note.encounter_id}#consultation`;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

/**
 * The caller's notes still waiting for their signature, wherever they were
 * started — an unsigned note is not yet part of the record.
 */
export function UnsignedNotesCard() {
  const canWrite = useHasPermission(P.CLINICAL_NOTES.WRITE);
  const notes = useQuery({
    queryKey: ["my-unsigned-notes"],
    queryFn: () => clinicalNotesService.listMyUnsignedNotes(),
    enabled: canWrite,
  });
  if (!canWrite) return null;
  return (
    <Card padding="md" mb="md" withBorder aria-label="My unsigned notes">
      <Group justify="space-between" mb="xs">
        <Text fw={600} size="sm">
          My unsigned notes
        </Text>
        {notes.data && notes.data.length > 0 && <Badge tone="warning">{notes.data.length}</Badge>}
      </Group>
      {notes.isError && (
        <Alert tone="danger" title="Unsigned notes could not be loaded">
          <Text size="sm">Reload the page; if it keeps failing, tell IT.</Text>
        </Alert>
      )}
      {notes.data?.length === 0 && (
        <Text size="sm" c="dimmed">
          Every note you started is signed.
        </Text>
      )}
      <Stack gap={6}>
        {notes.data?.map((n) => (
          <Group key={n.id} justify="space-between" wrap="nowrap">
            <Anchor component={Link} to={sheetHref(n)} size="sm">
              {n.note_type_name}
              {n.is_revision ? " (revision)" : ""} · {n.patient_name} · {n.uhid}
            </Anchor>
            <Text size="xs" c="dimmed">
              care {when(n.service_at)}
            </Text>
          </Group>
        ))}
      </Stack>
    </Card>
  );
}
