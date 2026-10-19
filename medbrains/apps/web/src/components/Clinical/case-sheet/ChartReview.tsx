import { Anchor, Group, Loader, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { type ChartVisit, type Note, P } from "@medbrains/types";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Fragment, useMemo, useState } from "react";
import { Link } from "react-router";
import { Alert, Button } from "@/components/ui";
import { clinicalNotesService } from "@/services/clinicalNotes.service";
import { ChartFilters, type ChartFilterValue, chartQuery } from "./ChartFilters";
import { type NoteActions, NoteCard } from "./NoteCard";
import { sheetHref } from "./UnsignedNotesCard";

const noop = () => undefined;
/** Chart review reads; notes are written and signed on their visit's sheet. */
const READ_ONLY: NoteActions = {
  canSign: false,
  canWrite: false,
  canMarkInError: false,
  canCosign: false,
  saveDraft: async () => undefined,
  sign: async () => undefined,
  revise: noop,
  discard: noop,
  addendum: noop,
  markInError: noop,
  countersign: noop,
  returnToAuthor: noop,
};

const KIND_LABEL: Record<ChartVisit["encounter_type"], string> = {
  opd: "OPD visit",
  ipd: "Admission",
  emergency: "Emergency visit",
  home_health: "Home visit",
};

/** Every note on the patient's record, newest care first, across visits. */
export function ChartReview({ patientId }: { patientId: string }) {
  const canView = useHasPermission(P.CLINICAL_NOTES.VIEW);
  const [filters, setFilters] = useState<ChartFilterValue>({});
  const pages = useInfiniteQuery({
    queryKey: ["chart-review", patientId, filters],
    queryFn: ({ pageParam }) =>
      clinicalNotesService.listPatientNotes(patientId, { ...chartQuery(filters), ...pageParam }),
    initialPageParam: {} as { before_at?: string; before_id?: string },
    getNextPageParam: (last) => {
      const tops = last.notes.filter((n) => !n.amends_note_id);
      const end = tops[tops.length - 1];
      return last.has_more && end ? { before_at: end.service_at, before_id: end.id } : undefined;
    },
    enabled: canView,
  });

  const { top, addendaOf, visitOf, facets } = useMemo(() => {
    const all = pages.data?.pages ?? [];
    const notes = all.flatMap((p) => p.notes);
    const byParent = new Map<string, Note[]>();
    for (const n of notes) {
      if (n.amends_note_id)
        byParent.set(n.amends_note_id, [...(byParent.get(n.amends_note_id) ?? []), n]);
    }
    return {
      top: notes.filter((n) => !n.amends_note_id),
      addendaOf: byParent,
      visitOf: new Map(all.flatMap((p) => p.visits).map((v) => [v.encounter_id, v])),
      // The first page's facets cover the whole record, whatever is loaded.
      facets: all[0]?.facets ?? [],
    };
  }, [pages.data]);

  if (!canView) return null;
  const filtered = Object.values(filters).some(Boolean);
  return (
    <Stack gap="sm">
      <Text fw={700}>Clinical notes</Text>
      <ChartFilters facets={facets} value={filters} onChange={setFilters} />
      {pages.isLoading && <Loader size="sm" />}
      {/* An unanswered record is not an empty one. */}
      {pages.isError && (
        <Alert tone="danger" title="The patient's notes could not be loaded">
          <Text size="sm">Reload the page; if it keeps failing, tell IT.</Text>
        </Alert>
      )}
      {pages.isSuccess && top.length === 0 && (
        <Text size="sm" c="dimmed">
          {filtered ? "No notes match these filters." : "No notes on this patient's record yet."}
        </Text>
      )}
      {top.map((note, i) => {
        const visit = visitOf.get(note.encounter_id);
        const newVisit = i === 0 || top[i - 1]?.encounter_id !== note.encounter_id;
        return (
          <Fragment key={note.id}>
            {newVisit && visit && <VisitHeading visit={visit} />}
            <NoteCard note={note} addenda={addendaOf.get(note.id) ?? []} actions={READ_ONLY} />
          </Fragment>
        );
      })}
      {pages.hasNextPage && (
        <Group justify="center">
          <Button
            tone="tertiary"
            loading={pages.isFetchingNextPage}
            onClick={() => void pages.fetchNextPage()}
          >
            Load older notes
          </Button>
        </Group>
      )}
    </Stack>
  );
}

function VisitHeading({ visit }: { visit: ChartVisit }) {
  const date = visit.encounter_date
    ? new Date(`${visit.encounter_date}T00:00:00`).toLocaleDateString([], { dateStyle: "medium" })
    : "";
  return (
    <Group justify="space-between" mt="xs">
      <Text size="sm" fw={600} c="dimmed">
        {KIND_LABEL[visit.encounter_type]} {date && `· ${date}`}
      </Text>
      <Anchor component={Link} to={sheetHref(visit)} size="sm">
        Open case sheet
      </Anchor>
    </Group>
  );
}
