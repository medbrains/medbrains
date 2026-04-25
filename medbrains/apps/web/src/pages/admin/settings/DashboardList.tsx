import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import type { DashboardSummary } from "@medbrains/types";
import { useNavigate } from "react-router";
import {
  IconCopy,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { DataTable } from "../../../components";
import { useState } from "react";
import { notifications } from "@mantine/notifications";

export function DashboardList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createOpened, { open: openCreate, close: closeCreate }] =
    useDisclosure(false);

  const { data: dashboards = [], isLoading } = useQuery({
    queryKey: ["dashboards-admin"],
    queryFn: () => api.listDashboards(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.adminDeleteDashboard(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dashboards-admin"] });
      notifications.show({
        title: "Deleted",
        message: "Dashboard deleted",
        color: "success",
      });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => api.adminDuplicateDashboard(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dashboards-admin"] });
      notifications.show({
        title: "Duplicated",
        message: "Dashboard duplicated",
        color: "success",
      });
    },
  });

  if (isLoading) {
    return (
      <Group justify="center" py="xl">
        <Loader />
      </Group>
    );
  }

  const columns = [
    {
      key: "name",
      label: "Name",
      render: (row: DashboardSummary) => (
        <Text size="sm" fw={500}>
          {row.name}
        </Text>
      ),
    },
    {
      key: "code",
      label: "Code",
      render: (row: DashboardSummary) => (
        <Text size="xs" c="dimmed" ff="monospace">
          {row.code}
        </Text>
      ),
    },
    {
      key: "role_codes",
      label: "Roles",
      render: (row: DashboardSummary) => {
        const roles = Array.isArray(row.role_codes) ? row.role_codes : [];
        return roles.length > 0 ? (
          <Group gap={4}>
            {roles.map((r: string) => (
              <Badge key={r} size="xs" variant="light">
                {r}
              </Badge>
            ))}
          </Group>
        ) : (
          <Text size="xs" c="dimmed">
            All roles
          </Text>
        );
      },
    },
    {
      key: "widget_count",
      label: "Widgets",
      render: (row: DashboardSummary) => (
        <Text size="xs">{row.widget_count}</Text>
      ),
    },
    {
      key: "is_default",
      label: "Default",
      render: (row: DashboardSummary) =>
        row.is_default ? (
          <Badge color="primary" size="xs" variant="light">
            Default
          </Badge>
        ) : null,
    },
    {
      key: "is_active",
      label: "Active",
      render: (row: DashboardSummary) => (
        <Badge
          color={row.is_active ? "success" : "slate"}
          size="xs"
          variant="light"
        >
          {row.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row: DashboardSummary) => (
        <Group gap={4}>
          <Tooltip label="Edit">
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={() =>
                navigate(`/admin/dashboard-builder/${row.id}`)
              }
              aria-label="Edit"
            >
              <IconPencil size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Duplicate">
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={() => duplicateMutation.mutate(row.id)}
              aria-label="Copy"
            >
              <IconCopy size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Delete">
            <ActionIcon
              variant="subtle"
              color="danger"
              size="sm"
              onClick={() => deleteMutation.mutate(row.id)}
              aria-label="Delete"
            >
              <IconTrash size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      ),
    },
  ];

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text size="sm" fw={600}>
          Dashboard Configurations
        </Text>
        <Group gap="sm">
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={openCreate}>
            Create Dashboard
          </Button>
        </Group>
      </Group>

      <DataTable
        columns={columns}
        data={dashboards}
        rowKey={(row: DashboardSummary) => row.id}
      />

      <CreateDashboardModal opened={createOpened} onClose={closeCreate} />
    </Stack>
  );
}

function CreateDashboardModal({
  opened,
  onClose,
}: {
  opened: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const createMutation = useMutation({
    mutationFn: () =>
      api.adminCreateDashboard({
        name,
        code: code || name.toLowerCase().replace(/\s+/g, "_"),
      }),
    onSuccess: (data) => {
      onClose();
      setName("");
      setCode("");
      navigate(`/admin/dashboard-builder/${data.id}`);
    },
    onError: () => {
      notifications.show({
        title: "Error",
        message: "Failed to create dashboard",
        color: "danger",
      });
    },
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Create Dashboard" size="sm">
      <Stack gap="sm">
        <TextInput
          label="Name"
          placeholder="e.g., Doctor Dashboard"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
        />
        <TextInput
          label="Code"
          placeholder="Auto-generated from name"
          value={code}
          onChange={(e) => setCode(e.currentTarget.value)}
        />
        <Group justify="flex-end" mt="sm">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            loading={createMutation.isPending}
            disabled={!name.trim()}
          >
            Create
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
