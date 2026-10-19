import { Anchor, Card, Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { Alert, Badge } from "@/components/ui";
import { clinicalNotesService } from "@/services/clinicalNotes.service";
import { sheetHref, when } from "./UnsignedNotesCard";

/**
 * Notes the caller's residents have signed and that wait on the caller's
 * countersignature; each opens on its case sheet to countersign or return.
 */
export function CountersignCard() {
  const canCosign = useHasPermission(P.CLINICAL_NOTES.COSIGN);
  const notes = useQuery({
    queryKey: ["notes-to-countersign"],
    queryFn: () => clinicalNotesService.listPendingCountersign(),
    enabled: canCosign,
  });
  if (!canCosign) return null;
  return (
    <Card padding="md" mb="md" withBorder aria-label="Notes to countersign">
      <Group justify="space-between" mb="xs">
        <Text fw={600} size="sm">
          Notes to countersign
        </Text>
        {notes.data && notes.data.length > 0 && <Badge tone="warning">{notes.data.length}</Badge>}
      </Group>
      {notes.isError && (
        <Alert tone="danger" title="Notes to countersign could not be loaded">
          <Text size="sm">Reload the page; if it keeps failing, tell IT.</Text>
        </Alert>
      )}
      {notes.data?.length === 0 && (
        <Text size="sm" c="dimmed">
          No notes are waiting on your countersignature.
        </Text>
      )}
      <Stack gap={6}>
        {notes.data?.map((n) => (
          <Group key={n.id} justify="space-between" wrap="nowrap">
            <Anchor component={Link} to={sheetHref(n)} size="sm">
              {n.note_type_name} by {n.author_name} · {n.patient_name} · {n.uhid}
            </Anchor>
            {n.signed_at && (
              <Text size="xs" c="dimmed">
                signed {when(n.signed_at)}
              </Text>
            )}
          </Group>
        ))}
      </Stack>
    </Card>
  );
}
