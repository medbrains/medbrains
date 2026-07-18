// IPD AdmissionsTab — split from ipd.tsx (pure move).

import { DataTable, StatusDot } from "@/components";
import type { Column } from "@/components";
import { Button, IconButton } from "@/components/ui";
import { statusColor } from "@/lib/status-colors";
import { ipdService } from "@/services/ipd.service";
import { Group, Select, Stack, Text, Tooltip } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P, PATIENT_BASIC_IDENTITY_FIELD_ACCESS_KEYS } from "@medbrains/types";
import type { AdmissionRow } from "@medbrains/types";
import { IconEye, IconPlus } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";

export function AdmissionsTab() {
  const canCreate = useHasPermission(P.IPD.ADMISSIONS_CREATE);
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  const params: Record<string, string> = { page: String(page), per_page: "20" };
  if (filterStatus) params.status = filterStatus;

  const { data, isLoading } = useQuery({
    queryKey: ["admissions", params],
    queryFn: () => ipdService.listAdmissions(params),
  });

  const columns = [
    {
      key: "patient_name",
      label: "Patient",
      fieldAccessKeys: PATIENT_BASIC_IDENTITY_FIELD_ACCESS_KEYS,
      accessor: (row: AdmissionRow) => row.patient_name,
      fieldKind: "name",
      hiddenLabel: "Patient restricted",
      render: (row: AdmissionRow) => (
        <Stack gap={0}>
          <Text size="sm" fw={500}>
            {row.patient_name}
          </Text>
          <Text size="xs" c="dimmed">
            {row.uhid}
          </Text>
        </Stack>
      ),
    },
    {
      key: "ward_name",
      label: "Ward",
      render: (row: AdmissionRow) => <Text size="sm">{row.ward_name ?? "—"}</Text>,
    },
    {
      key: "status",
      label: "Status",
      render: (row: AdmissionRow) => (
        <StatusDot color={statusColor(row.status) ?? "slate"} label={row.status} />
      ),
    },
    {
      key: "admitted_at",
      label: "Admitted",
      render: (row: AdmissionRow) => (
        <Text size="sm">{new Date(row.admitted_at).toLocaleDateString()}</Text>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      requiredPermissions: [P.IPD.ADMISSIONS_VIEW],
      render: (row: AdmissionRow) => (
        <Tooltip label="View details">
          <IconButton
            onClick={() => navigate(`/ipd/admissions/${row.id}`)}
            aria-label={`Open admission ${row.id}`}
          >
            <IconEye size={16} />
          </IconButton>
        </Tooltip>
      ),
    },
  ] satisfies Column<AdmissionRow>[];

  return (
    <>
      <Group mb="md" justify="space-between">
        <Select
          placeholder="Status"
          data={[
            { value: "admitted", label: "Admitted" },
            { value: "transferred", label: "Transferred" },
            { value: "discharged", label: "Discharged" },
            { value: "absconded", label: "Absconded" },
            { value: "deceased", label: "Deceased" },
          ]}
          value={filterStatus}
          onChange={setFilterStatus}
          clearable
          w={180}
        />
        {canCreate && (
          <Button
            tone="primary"
            leftSection={<IconPlus size={16} />}
            onClick={() => navigate("/ipd/new")}
          >
            New Admission
          </Button>
        )}
      </Group>

      <DataTable
        columns={columns}
        data={data?.admissions ?? []}
        loading={isLoading}
        page={page}
        totalPages={data ? Math.ceil(data.total / data.per_page) : 1}
        onPageChange={setPage}
        rowKey={(row) => row.id}
        virtualized="auto"
        virtualizeAt={40}
        virtualRowHeight={58}
        tableMaxHeight="calc(100vh - 360px)"
      />
    </>
  );
}
