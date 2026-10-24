import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P, type PsychAdmission } from "@medbrains/types";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { Column } from "@/components/DataTable";
import { Alert, Badge, Button, Input, Modal } from "@/components/ui";
import { psychiatryService } from "@/services/psychiatry.service";
import { AdmissionForm } from "./AdmissionForm";
import { admissionCategoryLabel, formatDateTime } from "./labels";
import { RecordListFrame, usePsychList } from "./RecordListFrame";

type BoardAction = { kind: "report" | "permit" | "discharge_order"; row: PsychAdmission };

function overdue(due: string | null, done: string | null): boolean {
  return !done && !!due && new Date(due).getTime() < Date.now();
}

function BoardCell({ r }: { r: PsychAdmission }) {
  if (!r.board_report_due_at) return <Text size="sm">Not required</Text>;
  if (r.board_reported_at)
    return <Text size="sm">Reported {formatDateTime(r.board_reported_at)}</Text>;
  const late = overdue(r.board_report_due_at, r.board_reported_at);
  return (
    <Group gap={4} wrap="nowrap">
      {late && <IconAlertTriangle size={16} aria-hidden />}
      <Text size="sm">
        Due {formatDateTime(r.board_report_due_at)}
        {late ? " — overdue" : ""}
      </Text>
    </Group>
  );
}

export function AdmissionsTab({ psychPatientId }: { psychPatientId: string }) {
  const qc = useQueryClient();
  const canList = useHasPermission(P.SPECIALTY.PSYCHIATRY.ADMISSIONS_LIST);
  const canAdmit = useHasPermission(P.SPECIALTY.PSYCHIATRY.ADMISSIONS_CREATE);
  const canDischarge = useHasPermission(P.SPECIALTY.PSYCHIATRY.ADMISSIONS_UPDATE);
  const canBoard = useHasPermission(P.SPECIALTY.PSYCHIATRY.MHRB_MANAGE);
  const query = usePsychList(
    "psych-admissions",
    psychPatientId,
    psychiatryService.listAdmissions,
    canList,
  );
  const [admitting, setAdmitting] = useState(false);
  const [action, setAction] = useState<BoardAction | null>(null);
  const [reference, setReference] = useState("");
  const invalidate = () =>
    void qc.invalidateQueries({ queryKey: ["psych-admissions", psychPatientId] });
  const discharge = useMutation({
    mutationFn: (id: string) => psychiatryService.dischargeAdmission(id, {}),
    onSuccess: invalidate,
  });
  const board = useMutation({
    mutationFn: (a: BoardAction) =>
      a.kind === "report"
        ? psychiatryService.reportAdmissionToBoard(a.row.id, {
            reference_number: reference || undefined,
          })
        : psychiatryService.recordBoardDecision(a.row.id, {
            decision: a.kind === "permit" ? "permitted" : "discharge_ordered",
            reference_number: reference || undefined,
          }),
    onSuccess: () => {
      invalidate();
      setAction(null);
      setReference("");
    },
  });

  const columns = useMemo<Column<PsychAdmission>[]>(
    () => [
      {
        key: "section",
        label: "Section",
        render: (r) => <Badge tone="neutral">{admissionCategoryLabel(r.category)}</Badge>,
      },
      {
        key: "admitted",
        label: "Admitted",
        render: (r) => <Text size="sm">{formatDateTime(r.admitted_at)}</Text>,
      },
      {
        key: "ends",
        label: "Lawful until",
        render: (r) => (
          <Text size="sm">
            {r.period_ends_at ? formatDateTime(r.period_ends_at) : "No fixed limit"}
          </Text>
        ),
      },
      { key: "board", label: "Board report", render: (r) => <BoardCell r={r} /> },
      {
        key: "decision",
        label: "Board decision",
        render: (r) =>
          r.category !== "supported_extended" ? (
            <Text size="sm">—</Text>
          ) : r.board_decision ? (
            <Text size="sm">
              {r.board_decision === "permitted" ? "Permitted" : "Discharge ordered"}
            </Text>
          ) : (
            <Text size="sm">Due {formatDateTime(r.board_decision_due_at)}</Text>
          ),
      },
      {
        key: "status",
        label: "Status",
        render: (r) =>
          r.discharged_at ? (
            <Badge tone="neutral">Discharged {formatDateTime(r.discharged_at)}</Badge>
          ) : (
            <Badge tone="info">Open</Badge>
          ),
      },
      {
        key: "actions",
        label: "",
        render: (r) => (
          <Group gap="xs" wrap="nowrap">
            {canBoard && r.board_report_due_at && !r.board_reported_at && (
              <Button
                tone="tertiary"
                size="xs"
                onClick={() => setAction({ kind: "report", row: r })}
              >
                Reported to Board
              </Button>
            )}
            {canBoard && r.category === "supported_extended" && !r.board_decision && (
              <>
                <Button
                  tone="tertiary"
                  size="xs"
                  onClick={() => setAction({ kind: "permit", row: r })}
                >
                  Board permitted
                </Button>
                <Button
                  tone="danger-tertiary"
                  size="xs"
                  onClick={() => setAction({ kind: "discharge_order", row: r })}
                >
                  Board ordered discharge
                </Button>
              </>
            )}
            {canDischarge && !r.discharged_at && (
              <Button tone="ghost" size="xs" onClick={() => discharge.mutate(r.id)}>
                Discharge
              </Button>
            )}
          </Group>
        ),
      },
    ],
    [canBoard, canDischarge, discharge.mutate],
  );

  return (
    <Stack gap="sm">
      {(discharge.isError || board.isError) && (
        <Alert tone="danger">{(discharge.error ?? board.error)?.message}</Alert>
      )}
      <RecordListFrame
        description="Each admission under its section, with the time limits and Board reporting the Act requires."
        addLabel="Admit"
        canAdd={canAdmit}
        onAdd={() => setAdmitting(true)}
        columns={columns}
        query={query}
        emptyTitle="No admissions recorded"
      >
        <AdmissionForm
          psychPatientId={psychPatientId}
          opened={admitting}
          onClose={() => setAdmitting(false)}
        />
        <Modal
          opened={action !== null}
          onClose={() => setAction(null)}
          title="Mental Health Review Board"
          primaryAction={{
            label: "Record",
            onClick: () => action && board.mutate(action),
            loading: board.isPending,
          }}
          secondaryAction={{ label: "Cancel", onClick: () => setAction(null) }}
        >
          <Input
            label="Board reference"
            value={reference}
            onChange={(e) => setReference(e.currentTarget.value)}
          />
        </Modal>
      </RecordListFrame>
    </Stack>
  );
}
