// Emergency TriageLogTab — split from emergency.tsx (pure move).

import { Select, Stack, Text } from "@mantine/core";
import type { ErVisit } from "@medbrains/types";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { TriagePanel } from "@/components/crdt/TriagePanel";
import { Alert } from "@/components/ui";
import { emergencyService } from "@/services/emergency.service";

export function TriageLogTab({
  canAppend,
  canViewVisits,
}: {
  canAppend: boolean;
  canViewVisits: boolean;
}) {
  const [visitId, setVisitId] = useState<string | null>(null);
  const { data: visits = [] } = useQuery({
    queryKey: ["er-visits"],
    queryFn: () => emergencyService.listErVisits(),
    enabled: canViewVisits,
  });

  const options = (visits as ErVisit[]).map((v) => ({
    value: v.id,
    label: `${v.visit_number} — ${v.chief_complaint ?? "No complaint"}`,
  }));

  return (
    <Stack>
      {canViewVisits ? (
        <Select
          placeholder="Select an ER visit…"
          data={options}
          value={visitId}
          onChange={setVisitId}
          searchable
          clearable
          maxDropdownHeight={300}
        />
      ) : (
        <Alert tone="warning" icon={<IconAlertTriangle size={16} />}>
          Triage review needs ER visit selector access so entries can be linked to a live visit.
        </Alert>
      )}
      {visitId ? (
        <TriagePanel visitId={visitId} canAppend={canAppend} />
      ) : (
        <Text size="sm" c="dimmed">
          Pick a visit to record or review triage entries.
        </Text>
      )}
    </Stack>
  );
}

// ── Resuscitation Tab ──────────────────────────────────
