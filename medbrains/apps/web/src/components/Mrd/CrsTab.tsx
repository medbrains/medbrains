// MRD CrsTab — every birth and death in the hospital, with the date by which
// it must be reported on the CRS portal, the registrar's report laid out from
// what the hospital recorded, and the registration number once registered.

import { Group, Stack, Text } from "@mantine/core";
import type { CrsEvent } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { Alert, Button } from "@/components/ui";
import { mrdService } from "@/services/mrd.service";
import { CrsFormModal } from "./CrsFormModal";
import { RecordCrsModal } from "./RecordCrsModal";

const FILTERS = [
  { value: "pending", label: "Due" },
  { value: "overdue", label: "Overdue" },
  { value: "registered", label: "Registered" },
  { value: "", label: "All" },
] as const;

const DAY_MS = 86_400_000;

/** Whole days from today to the due date; negative once overdue. */
export function daysLeft(dueOn: string, today = new Date()): number {
  const due = new Date(`${dueOn}T00:00:00`);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((due.getTime() - start.getTime()) / DAY_MS);
}

/** Where the hospital recorded the event, as the MRD officer knows the books. */
export function recordedIn(e: CrsEvent): string {
  const books = [
    e.from_maternity && "Labour room",
    e.in_birth_register && "Birth register",
    e.mccd_form && (e.mccd_form === "form_4a" ? "MCCD Form 4A" : "MCCD Form 4"),
    e.in_death_register && "Death register",
  ].filter(Boolean);
  return books.join(" · ");
}

function DueCell({ e }: { e: CrsEvent }) {
  if (e.status === "registered") {
    return <Text size="sm">Registered {e.registered_on ?? ""}</Text>;
  }
  const left = daysLeft(e.due_on);
  return (
    <Stack gap={0}>
      <Text size="sm">{e.due_on}</Text>
      {left < 0 ? (
        <Text size="xs" fw={700} c="var(--mantine-color-error)">
          {-left} days overdue
        </Text>
      ) : (
        <Text size="xs" c="dimmed">
          {left} days left
        </Text>
      )}
    </Stack>
  );
}

export function CrsTab({ canManage }: { canManage: boolean }) {
  const [status, setStatus] = useState<string>("pending");
  const [viewing, setViewing] = useState<CrsEvent | null>(null);
  const [recording, setRecording] = useState<CrsEvent | null>(null);
  const events = useQuery({
    queryKey: ["mrd-crs", status],
    queryFn: () => mrdService.listCrsEvents(status || undefined),
  });

  return (
    <Stack>
      <Alert tone="warning" title="The hospital reports every birth and death">
        Under the Registration of Births and Deaths (Amendment) Act 2023 the hospital in-charge is
        the informant for each birth and death here, and must report it on the CRS portal
        (crsorgi.gov.in) within 21 days. Families are not to be sent to do it.
      </Alert>
      <Group gap="xs">
        {FILTERS.map((f) => (
          <Button
            key={f.value || "all"}
            size="xs"
            tone={status === f.value ? "primary" : "ghost"}
            onClick={() => setStatus(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </Group>
      {events.isError && (
        <Alert tone="danger" title="Births and deaths could not be read">
          {events.error.message}
        </Alert>
      )}
      <DataTable
        columns={[
          {
            key: "event_type",
            label: "Event",
            render: (e: CrsEvent) => (
              <Stack gap={0}>
                <Text size="sm" fw={600}>
                  {e.event_type === "birth"
                    ? `Birth${e.baby_sex ? ` (${e.baby_sex})` : ""}`
                    : "Death"}
                </Text>
                <Text size="xs" c="dimmed">
                  {e.event_date}
                </Text>
              </Stack>
            ),
          },
          {
            key: "patient_name",
            label: "Mother / deceased",
            render: (e: CrsEvent) => (
              <Stack gap={0}>
                <Text size="sm">{e.patient_name ?? "—"}</Text>
                <Text size="xs" c="dimmed" ff="var(--mb-font-mono)">
                  {e.uhid ?? ""}
                </Text>
              </Stack>
            ),
          },
          {
            key: "recorded_in",
            label: "Recorded in",
            render: (e: CrsEvent) => <Text size="sm">{recordedIn(e)}</Text>,
          },
          { key: "due_on", label: "Report by", render: (e: CrsEvent) => <DueCell e={e} /> },
          {
            key: "crs_registration_number",
            label: "CRS registration no.",
            render: (e: CrsEvent) => (
              <Text size="sm" ff="var(--mb-font-mono)">
                {e.crs_registration_number ?? "—"}
              </Text>
            ),
          },
          {
            key: "actions",
            label: "",
            render: (e: CrsEvent) => (
              <Group gap={4} wrap="nowrap">
                <Button size="xs" tone="ghost" onClick={() => setViewing(e)}>
                  CRS report
                </Button>
                {canManage && e.status === "pending" && (
                  <Button size="xs" tone="primary" onClick={() => setRecording(e)}>
                    Record registration
                  </Button>
                )}
              </Group>
            ),
          },
        ]}
        data={events.data ?? []}
        loading={events.isLoading}
        rowKey={(e: CrsEvent) => e.id}
      />
      {viewing && <CrsFormModal event={viewing} onClose={() => setViewing(null)} />}
      {recording && <RecordCrsModal event={recording} onClose={() => setRecording(null)} />}
    </Stack>
  );
}
