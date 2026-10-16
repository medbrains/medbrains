// The regulatory notices for one incident: CERT-In, Board intimation, Board
// detailed report, and the notice to affected people. Each is recorded once;
// a recorded notice shows when it went and its reference. Recording needs
// `security.breach.manage`; the server refuses a notice whose clock does not apply.

import { Group, Stack, Text } from "@mantine/core";
import type { IncidentNoticeKind, SecurityIncident } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, Input, NumberField, toast } from "@/components/ui";
import { securityService } from "@/services/security.service";

interface NoticeRow {
  kind: IncidentNoticeKind;
  label: string;
  sentAt: string | null;
  reference: string | null;
  applies: boolean;
}

function noticeRows(i: SecurityIncident): NoticeRow[] {
  return [
    {
      kind: "cert_in",
      label: "CERT-In report",
      sentAt: i.cert_in_report_date,
      reference: i.cert_in_reference,
      applies: i.is_cert_in_reportable,
    },
    {
      kind: "board_initial",
      label: "Board intimation",
      sentAt: i.board_intimated_at,
      reference: i.board_reference,
      applies: i.is_personal_data_breach,
    },
    {
      kind: "board_report",
      label: "Board detailed report",
      sentAt: i.board_report_sent_at,
      reference: i.board_reference,
      applies: i.is_personal_data_breach,
    },
    {
      kind: "principals",
      label: "Notice to affected people",
      sentAt: i.principals_notified_at,
      reference: i.principals_notified_count ? `${i.principals_notified_count} people` : null,
      applies: i.is_personal_data_breach,
    },
  ];
}

function NoticeRecorder({ incidentId, row }: { incidentId: string; row: NoticeRow }) {
  const qc = useQueryClient();
  const [reference, setReference] = useState("");
  const [count, setCount] = useState<number | "">("");
  const isPrincipals = row.kind === "principals";
  const send = useMutation({
    mutationFn: () =>
      securityService.recordIncidentNotice(incidentId, {
        kind: row.kind,
        reference: reference.trim() || undefined,
        count: typeof count === "number" ? count : undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["sec-incidents"] });
      void qc.invalidateQueries({ queryKey: ["sec-incident-updates", incidentId] });
      toast.success(`${row.label} recorded`, { title: "Notice recorded" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Notice not recorded" }),
  });
  return (
    <Group align="flex-end" gap="xs">
      {isPrincipals ? (
        <NumberField
          label="People notified"
          min={1}
          value={count}
          onChange={(v) => setCount(typeof v === "number" ? v : "")}
        />
      ) : (
        <Input
          label="Acknowledgement / reference"
          value={reference}
          onChange={(e) => setReference(e.currentTarget.value)}
        />
      )}
      <Button
        tone="primary"
        loading={send.isPending}
        disabled={isPrincipals && count === ""}
        onClick={() => send.mutate()}
      >
        Record sent now
      </Button>
    </Group>
  );
}

export function BreachNotices({
  incident,
  canManage,
}: {
  incident: SecurityIncident;
  canManage: boolean;
}) {
  const rows = noticeRows(incident).filter((r) => r.applies);
  if (rows.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No regulatory notice applies until the incident is assessed as CERT-In reportable or as a
        personal-data breach.
      </Text>
    );
  }
  return (
    <Stack gap="sm">
      <Text fw={600}>Notices</Text>
      {rows.map((row) => (
        <Stack key={row.kind} gap={4}>
          <Group gap="xs">
            <Text size="sm" fw={500}>
              {row.label}
            </Text>
            {row.sentAt ? (
              <Badge tone="success">sent {new Date(row.sentAt).toLocaleString()}</Badge>
            ) : (
              <Badge tone="warning">not sent</Badge>
            )}
            {row.reference && (
              <Text size="xs" ff="monospace">
                {row.reference}
              </Text>
            )}
          </Group>
          {!row.sentAt && canManage && <NoticeRecorder incidentId={incident.id} row={row} />}
        </Stack>
      ))}
    </Stack>
  );
}
