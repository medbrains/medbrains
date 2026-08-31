// CAMP CampsTab — split from camp.tsx (pure move).

import { Group, Select, Text, Tooltip } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type { Camp } from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconCheck,
  IconPencil,
  IconPlayerPlay,
  IconPlus,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";
import { DataTable, useClinicalEmit } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, Button, IconButton } from "@/components/ui";
import { campTypeOptions } from "@/forms/camp.form";
import { campService } from "@/services/camp.service";
import { CAMP_STATUS_COLORS } from "./shared";

export function CampsTab({ onWorkCamp }: { onWorkCamp: (campId: string) => void }) {
  const navigate = useNavigate();
  const emit = useClinicalEmit();
  const canCreate = useHasPermission(P.CAMP.CREATE);
  const canUpdate = useHasPermission(P.CAMP.UPDATE);
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const { data: camps = [], isLoading } = useQuery({
    queryKey: ["camps", statusFilter],
    queryFn: () => campService.listCamps(statusFilter ? { status: statusFilter } : undefined),
  });
  const approveMut = useMutation({
    mutationFn: (id: string) => campService.approveCamp(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["camps"] });
      notifications.show({ title: "Approved", message: "Camp approved", color: "success" });
    },
  });

  const activateMut = useMutation({
    mutationFn: (id: string) => campService.activateCamp(id),
    onSuccess: (camp) => {
      emit("camp.started", {
        camp_code: camp.camp_code,
        camp_id: camp.id,
        camp_type: camp.camp_type,
        scheduled_date: camp.scheduled_date,
        source_record_id: camp.id,
        status: camp.status,
      });
      void qc.invalidateQueries({ queryKey: ["camps"] });
      notifications.show({ title: "Activated", message: "Camp is now active", color: "success" });
    },
  });

  const completeMut = useMutation({
    mutationFn: (id: string) => campService.completeCamp(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["camps"] });
      notifications.show({
        title: "Completed",
        message: "Camp marked as completed",
        color: "teal",
      });
    },
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => campService.cancelCamp(id, {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["camps"] });
      notifications.show({ title: "Cancelled", message: "Camp cancelled", color: "danger" });
    },
  });

  const columns: Column<Camp>[] = [
    {
      key: "camp_code",
      label: "Code",
      render: (r) => (
        <Text size="sm" fw={500}>
          {r.camp_code}
        </Text>
      ),
    },
    { key: "name", label: "Name", render: (r) => r.name },
    {
      key: "camp_type",
      label: "Type",
      render: (r) => (
        <Badge tone="neutral" variant="light" size="sm">
          {campTypeOptions.find((t) => t.value === r.camp_type)?.label ?? r.camp_type}
        </Badge>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Badge tone={CAMP_STATUS_COLORS[r.status] ?? "neutral"} variant="filled" size="sm">
          {r.status}
        </Badge>
      ),
    },
    { key: "scheduled_date", label: "Date", render: (r) => r.scheduled_date },
    { key: "venue_city", label: "City", render: (r) => r.venue_city ?? "—" },
    {
      key: "expected_participants",
      label: "Expected",
      render: (r) => r.expected_participants?.toString() ?? "—",
    },
    {
      key: "actions",
      label: "",
      render: (r) => (
        <Group gap={4}>
          <Tooltip label="View Details">
            <IconButton
              size="sm"
              onClick={() => navigate(`/camp/${r.id}`)}
              aria-label="View Details"
            >
              <IconPencil size={14} />
            </IconButton>
          </Tooltip>
          {r.status === "active" && (
            <Tooltip label="Work in this camp" closeDelay={0} withinPortal={false}>
              <IconButton
                tone="success"
                size="sm"
                onClick={(event) => {
                  event.currentTarget.blur();
                  onWorkCamp(r.id);
                }}
                aria-label="Work in this camp"
              >
                <IconUsers size={14} />
              </IconButton>
            </Tooltip>
          )}
          {canUpdate && r.status === "planned" && (
            <Tooltip label="Approve">
              <IconButton
                tone="primary"
                size="sm"
                onClick={() => approveMut.mutate(r.id)}
                aria-label="Approve"
              >
                <IconCheck size={14} />
              </IconButton>
            </Tooltip>
          )}
          {canUpdate && (r.status === "approved" || r.status === "setup") && (
            <Tooltip label="Activate">
              <IconButton
                tone="success"
                size="sm"
                onClick={() => activateMut.mutate(r.id)}
                aria-label="Activate"
              >
                <IconPlayerPlay size={14} />
              </IconButton>
            </Tooltip>
          )}
          {canUpdate && r.status === "active" && (
            <Tooltip label="Complete">
              <IconButton
                tone="success"
                size="sm"
                onClick={() => completeMut.mutate(r.id)}
                aria-label="Complete"
              >
                <IconCheck size={14} />
              </IconButton>
            </Tooltip>
          )}
          {canUpdate && !["completed", "cancelled"].includes(r.status) && (
            <Tooltip label="Cancel">
              <IconButton
                tone="danger"
                size="sm"
                onClick={() => cancelMut.mutate(r.id)}
                aria-label="Cancel"
              >
                <IconX size={14} />
              </IconButton>
            </Tooltip>
          )}
        </Group>
      ),
    },
  ];

  return (
    <>
      <Group justify="space-between" mb="md">
        <Select
          placeholder="Filter by status"
          clearable
          data={Object.keys(CAMP_STATUS_COLORS).map((s) => ({
            value: s,
            label: s.charAt(0).toUpperCase() + s.slice(1),
          }))}
          value={statusFilter}
          onChange={setStatusFilter}
          w={200}
        />
        {canCreate && (
          <Button
            tone="primary"
            leftSection={<IconPlus size={16} />}
            onClick={() => navigate("/camp/new")}
          >
            Plan Camp
          </Button>
        )}
      </Group>

      <DataTable columns={columns} data={camps} loading={isLoading} rowKey={(r) => r.id} />

      {/* Create Drawer */}
    </>
  );
}

// ── Camp Detail (team management + stats) ────────────
