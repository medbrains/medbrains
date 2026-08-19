import { Card, Group, Stack } from "@mantine/core";
import { api } from "@medbrains/api";
import { useHasAnyPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components";
import { TokenBoardLive } from "@/components/TokenBoardLive";
import { Select } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { DEPARTMENT_LIST_CODES } from "@/lib/api-permission-sets";

const MODULE_VALUES = [
  "registration",
  "opd",
  "pharmacy",
  "billing",
  "lab",
  "radiology",
  "dispatch",
] as const;

/** Live token board — pick a module + (optionally) a department scope. */
export function TokenBoardPage() {
  useRequirePermission(P.FRONT_OFFICE.QUEUE_LIST);
  // The department filter is the shared setup endpoint, which takes a long
  // require_any_permission list. Gating on one plausible member would hide
  // the filter from people the server would allow, so mirror the handler.
  const canListDepartments = useHasAnyPermission(DEPARTMENT_LIST_CODES);
  const { t } = useTranslation("frontOffice");
  const [module, setModule] = useState<string>("opd");
  const [departmentId, setDepartmentId] = useState<string | null>(null);

  const { data: departments } = useQuery({
    queryKey: ["setup-departments"],
    queryFn: () => api.listDepartments(),
    staleTime: 600_000,
    enabled: canListDepartments,
  });

  const moduleOptions = MODULE_VALUES.map((value) => ({
    value,
    label: t(`tokenBoard.modules.${value}`),
  }));
  const departmentOptions = (departments ?? []).map((dept) => ({
    value: dept.id,
    label: dept.name,
  }));
  const moduleLabel = t(`tokenBoard.modules.${module}`);
  const departmentName = departments?.find((dept) => dept.id === departmentId)?.name;
  const boardTitle = departmentName ? `${moduleLabel} · ${departmentName}` : moduleLabel;

  return (
    <Stack>
      <PageHeader title={t("tokenBoard.title")} subtitle={t("tokenBoard.subtitle")} />
      <Group align="flex-end">
        <Select
          label={t("tokenBoard.module")}
          data={moduleOptions}
          value={module}
          onChange={(value) => setModule(value ?? "opd")}
          style={{ width: 200 }}
        />
        <Select
          label={t("tokenBoard.department")}
          placeholder={t("tokenBoard.allDepartments")}
          data={departmentOptions}
          value={departmentId}
          onChange={setDepartmentId}
          searchable
          clearable
          style={{ width: 240 }}
        />
      </Group>
      <Card withBorder>
        <TokenBoardLive
          title={boardTitle}
          module={module}
          scope={departmentId ? "department" : undefined}
          scopeId={departmentId ?? undefined}
        />
      </Card>
    </Stack>
  );
}
