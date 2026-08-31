import { Group, Stack } from "@mantine/core";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import { type ModuleToken, P, TOKEN_PRIORITY_LABEL, TOKEN_PRIORITY_REASON } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import { Alert, Badge, Button, Input, Select, Tooltip, toast } from "@/components/ui";
import { resolveTokenActions, tokenStatusLabel } from "@/config/token-workflows";
import { useRequirePermission } from "@/hooks/useRequirePermission";

const MODULE_VALUES = [
  "registration",
  "opd",
  "pharmacy",
  "billing",
  "lab",
  "radiology",
  "dispatch",
] as const;

const STATUS_TONE: Record<string, "neutral" | "warning" | "info" | "danger"> = {
  waiting: "neutral",
  called: "warning",
  serving: "info",
  // Closed by the day rollover, never served. Only visible with
  // include_finished, and it must not look like an ordinary finish.
  expired: "danger",
};

/** Staff console — call the next token and walk each one through its workflow. */
export function TokenConsolePage() {
  useRequirePermission(P.FRONT_OFFICE.QUEUE_MANAGE);
  // Reaching the console takes queue.manage; reading the board takes
  // queue.list and the department filter takes its own code. Holding one
  // without the other polled a 403 every five seconds and rendered the
  // console's own "no tokens" empty state — a queue outage shown as a
  // waiting room with nobody in it.
  const canViewBoard = useHasPermission(P.FRONT_OFFICE.QUEUE_LIST);
  const canListDepartments = useHasPermission(P.ADMIN.SETTINGS_DEPARTMENTS_LIST);
  const { t } = useTranslation("frontOffice");
  const queryClient = useQueryClient();
  const [module, setModule] = useState<string>("opd");
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [counter, setCounter] = useState("");

  const { data: departments } = useQuery({
    queryKey: ["setup-departments"],
    queryFn: () => api.listDepartments(),
    staleTime: 600_000,
    enabled: canListDepartments,
  });

  const scope = departmentId ? "department" : undefined;
  const scopeId = departmentId ?? undefined;
  const queryKey = ["token-board", module, scope, scopeId];
  const {
    data: tokens,
    isError: boardFailed,
    isLoading: boardLoading,
  } = useQuery({
    queryKey,
    queryFn: () => api.listTokenBoard({ module, scope, scope_id: scopeId }),
    refetchInterval: 5000,
    enabled: canViewBoard,
  });
  const invalidate = () => void queryClient.invalidateQueries({ queryKey });

  // Both mutations report failure. Without this a 403 from a stale
  // permission, or a 409 from the colleague who advanced the same token a
  // second earlier, left the button looking pressed and nothing happening —
  // and the operator pressed it again.
  const onActionError = (error: Error) =>
    toast.error(error.message, { title: t("tokenConsole.actionFailed") });

  const advance = useMutation({
    mutationFn: (input: { id: string; status: string }) =>
      api.advanceToken(input.id, input.status, counter || undefined),
    onSuccess: invalidate,
    onError: onActionError,
  });
  const callNext = useMutation({
    mutationFn: () =>
      api.callNextToken({ module, scope, scope_id: scopeId, counter_label: counter || undefined }),
    // `call-next` answers null for an empty queue rather than failing, so
    // success alone does not mean somebody was called. Silence here read as
    // a call that had been made, and the counter waited for a patient who
    // was never summoned.
    onSuccess: (token) => {
      invalidate();
      if (!token) toast.info(t("tokenConsole.queueEmpty"));
    },
    onError: onActionError,
  });

  const columns: Column<ModuleToken>[] = [
    { key: "number", label: "Token", render: (row) => <strong>{row.number}</strong> },
    {
      key: "status",
      label: "Status",
      render: (row) => (
        <Badge tone={STATUS_TONE[row.status] ?? "neutral"}>
          {tokenStatusLabel(row.module, row.status)}
        </Badge>
      ),
    },
    { key: "patient", label: "Patient", render: (row) => row.patient_name ?? "—" },
    {
      key: "priority",
      label: "Priority",
      // A patient ahead of the queue for a reason nobody at the desk witnessed
      // looks like a queue-jump, and the desk is who has to explain it. So the
      // badge says why on hover, and never shows a raw database value.
      render: (row) =>
        row.priority === "normal" ? (
          "—"
        ) : (
          <Tooltip label={TOKEN_PRIORITY_REASON[row.priority] ?? row.priority}>
            <Badge tone={row.priority === "carried_over" ? "accent" : "warning"}>
              {TOKEN_PRIORITY_LABEL[row.priority] ?? row.priority}
            </Badge>
          </Tooltip>
        ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <Group gap={6} wrap="nowrap">
          {resolveTokenActions(row.module, row.status).map((action) => (
            <Button
              key={action.id}
              tone={action.tone ?? "secondary"}
              size="xs"
              onClick={() => advance.mutate({ id: row.id, status: action.to })}
            >
              {action.label}
            </Button>
          ))}
        </Group>
      ),
    },
  ];

  return (
    <Stack>
      <PageHeader title={t("tokenConsole.title")} subtitle={t("tokenConsole.subtitle")} />
      <Group align="flex-end">
        <Select
          label={t("tokenBoard.module")}
          data={MODULE_VALUES.map((value) => ({ value, label: t(`tokenBoard.modules.${value}`) }))}
          value={module}
          onChange={(value) => setModule(value ?? "opd")}
          style={{ width: 180 }}
        />
        <Select
          label={t("tokenBoard.department")}
          placeholder={t("tokenBoard.allDepartments")}
          data={(departments ?? []).map((dept) => ({ value: dept.id, label: dept.name }))}
          value={departmentId}
          onChange={setDepartmentId}
          disabled={!canListDepartments}
          searchable
          clearable
          style={{ width: 220 }}
        />
        <Input
          label={t("tokenConsole.counter")}
          value={counter}
          placeholder={t("tokenConsole.counterPlaceholder")}
          onChange={(event) => setCounter(event.currentTarget.value)}
          style={{ width: 180 }}
        />
        <Button tone="primary" onClick={() => callNext.mutate()} loading={callNext.isPending}>
          {t("tokenConsole.callNext")}
        </Button>
      </Group>
      {!canViewBoard && <Alert tone="warning">{t("tokenConsole.boardNotPermitted")}</Alert>}
      {/* An outage must not be drawn as an empty waiting room. "No tokens in
          the queue" is a statement about the queue, and a desk that believes
          it starts telling people to go home. */}
      {boardFailed ? (
        <Alert tone="danger">{t("tokenConsole.boardUnavailable")}</Alert>
      ) : (
        <DataTable<ModuleToken>
          columns={columns}
          data={tokens ?? []}
          loading={boardLoading}
          rowKey={(row) => row.id}
          emptyTitle={t("tokenConsole.empty")}
        />
      )}
    </Stack>
  );
}
