import { Group, Stack } from "@mantine/core";
import { api } from "@medbrains/api";
import { type ModuleToken, P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, Button, Input, Select } from "@/components/ui";
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

const STATUS_TONE: Record<string, "neutral" | "warning" | "info"> = {
  waiting: "neutral",
  called: "warning",
  serving: "info",
};

/** Staff console — call the next token and walk each one through its workflow. */
export function TokenConsolePage() {
  useRequirePermission(P.FRONT_OFFICE.QUEUE_MANAGE);
  const { t } = useTranslation("frontOffice");
  const queryClient = useQueryClient();
  const [module, setModule] = useState<string>("opd");
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [counter, setCounter] = useState("");

  const { data: departments } = useQuery({
    queryKey: ["setup-departments"],
    queryFn: () => api.listDepartments(),
    staleTime: 600_000,
  });

  const scope = departmentId ? "department" : undefined;
  const scopeId = departmentId ?? undefined;
  const queryKey = ["token-board", module, scope, scopeId];
  const { data: tokens } = useQuery({
    queryKey,
    queryFn: () => api.listTokenBoard({ module, scope, scope_id: scopeId }),
    refetchInterval: 5000,
  });
  const invalidate = () => void queryClient.invalidateQueries({ queryKey });

  const advance = useMutation({
    mutationFn: (input: { id: string; status: string }) =>
      api.advanceToken(input.id, input.status, counter || undefined),
    onSuccess: invalidate,
  });
  const callNext = useMutation({
    mutationFn: () =>
      api.callNextToken({ module, scope, scope_id: scopeId, counter_label: counter || undefined }),
    onSuccess: invalidate,
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
      render: (row) =>
        row.priority === "normal" ? "—" : <Badge tone="warning">{row.priority}</Badge>,
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
      <DataTable<ModuleToken>
        columns={columns}
        data={tokens ?? []}
        rowKey={(row) => row.id}
        emptyTitle={t("tokenConsole.empty")}
      />
    </Stack>
  );
}
