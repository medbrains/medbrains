/**
 * Periodontal chart for a dental exam: pick a tooth on the FDI chart, record
 * its six sites, save the full-mouth chart, and read it against the
 * patient's earlier charts (sites that changed by 2 mm or more).
 */
import { Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { type DentalExam, P, type PerioChart, type PerioTooth } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, Badge, Button, Card, Table, TextArea, toast } from "@/components/ui";
import { specialtyService } from "@/services/specialty.service";
import { Odontogram } from "./Odontogram";
import { PerioToothForm } from "./PerioToothForm";
import type { Dentition } from "./tooth-layout";

const fmt = (n: number | null, unit = "") => (n === null ? "—" : `${n}${unit}`);

function Summary({ chart, title }: { chart: PerioChart; title: string }) {
  const s = chart.summary;
  return (
    <Card padding="sm" withBorder>
      <Text size="sm" fw={600}>
        {title} · {new Date(chart.created_at).toLocaleDateString()}
        {chart.recorded_by_name ? ` · ${chart.recorded_by_name}` : ""}
      </Text>
      <SimpleGrid cols={{ base: 2, sm: 5 }} mt="xs">
        <Text size="sm">Teeth present: {s.teeth_present}</Text>
        <Text size="sm">Bleeding: {fmt(s.bleeding_percent, "%")}</Text>
        <Text size="sm">Sites ≥4 mm: {s.sites_4mm_or_more}</Text>
        <Text size="sm">Sites ≥6 mm: {s.sites_6mm_or_more}</Text>
        <Text size="sm">Mean CAL: {fmt(s.mean_attachment_level_mm, " mm")}</Text>
      </SimpleGrid>
    </Card>
  );
}

function Changes({ chart }: { chart: PerioChart }) {
  if (chart.changes_since_previous.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No site changed by 2 mm or more since the previous chart.
      </Text>
    );
  }
  return (
    <Table aria-label="Sites changed by 2 mm or more since the previous chart">
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Tooth</Table.Th>
          <Table.Th>Site</Table.Th>
          <Table.Th>Before</Table.Th>
          <Table.Th>Now</Table.Th>
          <Table.Th>Change</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {chart.changes_since_previous.map((c) => {
          const deeper = c.after_mm > c.before_mm;
          return (
            <Table.Tr key={`${c.tooth}-${c.site}`}>
              <Table.Td>{c.tooth}</Table.Td>
              <Table.Td>{c.site}</Table.Td>
              <Table.Td>{c.before_mm} mm</Table.Td>
              <Table.Td>{c.after_mm} mm</Table.Td>
              <Table.Td>
                <Badge tone={deeper ? "danger" : "success"}>
                  {deeper ? "Deeper" : "Shallower"} by {Math.abs(c.after_mm - c.before_mm)} mm
                </Badge>
              </Table.Td>
            </Table.Tr>
          );
        })}
      </Table.Tbody>
    </Table>
  );
}

export function PerioTab({ exam }: { exam: DentalExam }) {
  const canRecord = useHasPermission(P.SPECIALTY.DENTAL.PERIO_RECORD);
  const queryClient = useQueryClient();
  const key = ["dental-perio", exam.patient_id];
  const history = useQuery({
    queryKey: key,
    queryFn: () => specialtyService.listPatientPerioCharts(exam.patient_id),
  });
  const [dentition, setDentition] = useState<Dentition>("permanent");
  const [tooth, setTooth] = useState<string | null>(null);
  const [draft, setDraft] = useState<Map<string, PerioTooth>>(new Map());
  const [notes, setNotes] = useState("");
  const charted = useMemo(
    () => new Map([...draft.keys()].map((t) => [t, draft.get(t)?.missing ? "missing" : "charted"])),
    [draft],
  );
  const save = useMutation({
    mutationFn: () =>
      specialtyService.recordPerioChart(exam.id, {
        teeth: [...draft.values()],
        notes: notes || null,
      }),
    onSuccess: () => {
      toast.success("Periodontal chart saved");
      setDraft(new Map());
      setNotes("");
      setTooth(null);
      void queryClient.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not save the chart" }),
  });
  const [latest, previous] = history.data ?? [];

  return (
    <Stack gap="md">
      {history.error ? (
        <Alert tone="danger" role="alert">
          Periodontal charts could not be loaded: {history.error.message}
        </Alert>
      ) : history.isLoading ? (
        <Text size="sm" c="dimmed">
          Loading periodontal charts…
        </Text>
      ) : latest ? (
        <Stack gap="xs">
          <Summary chart={latest} title="Latest chart" />
          {previous && <Summary chart={previous} title="Previous chart" />}
          {previous && <Changes chart={latest} />}
        </Stack>
      ) : (
        <Text size="sm" c="dimmed">
          No periodontal chart has been recorded for this patient yet.
        </Text>
      )}

      {canRecord && (
        <Card padding="md" withBorder>
          <Stack gap="sm">
            <Text fw={600}>New chart · {draft.size} teeth charted</Text>
            <Odontogram
              dentition={dentition}
              onDentition={setDentition}
              findings={charted}
              selected={tooth}
              onSelect={setTooth}
            />
            {tooth && (
              <PerioToothForm
                key={tooth}
                tooth={tooth}
                initial={draft.get(tooth)}
                onSave={(entry) => {
                  setDraft((d) => new Map(d).set(entry.tooth, entry));
                  setTooth(null);
                }}
                onRemove={() =>
                  setDraft((d) => {
                    const next = new Map(d);
                    next.delete(tooth);
                    return next;
                  })
                }
              />
            )}
            <TextArea
              label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.currentTarget.value)}
              autosize
              minRows={2}
            />
            <Group justify="flex-end">
              <Button
                tone="primary"
                disabled={draft.size === 0}
                loading={save.isPending}
                onClick={() => save.mutate()}
              >
                Save chart
              </Button>
            </Group>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
