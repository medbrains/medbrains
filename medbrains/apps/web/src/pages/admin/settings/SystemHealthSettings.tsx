import {
  Alert,
  Badge,
  Button,
  Card,
  FileInput,
  Group,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { CompletenessCheck } from "@medbrains/types";
import {
  IconCheck,
  IconCircleCheck,
  IconCircleX,
  IconDatabase,
  IconDownload,
  IconInfoCircle,
  IconUpload,
  IconUsers,
} from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { settingsSetupService } from "@/services/settingsSetup.service";

// ── Completeness thresholds ──────────────────────────────

const COMPLETENESS_ITEMS: { key: keyof CompletenessCheck; label: string; min: number }[] = [
  { key: "departments", label: "Departments", min: 1 },
  { key: "users", label: "Users", min: 2 },
  { key: "roles", label: "Roles", min: 1 },
  { key: "services", label: "Services", min: 1 },
  { key: "locations", label: "Locations", min: 1 },
  { key: "drugs", label: "Drug Catalog", min: 0 },
  { key: "lab_tests", label: "Lab Tests", min: 0 },
];

export function SystemHealthSettings() {
  const [importFile, setImportFile] = useState<File | null>(null);

  // ── Completeness Check ──
  const {
    data: completeness,
    isLoading: completenessLoading,
    refetch: refetchCompleteness,
  } = useQuery({
    queryKey: ["setup-completeness"],
    queryFn: () => settingsSetupService.completenessCheck(),
    staleTime: 30_000,
  });

  // ── System Health ──
  const {
    data: health,
    isLoading: healthLoading,
    refetch: refetchHealth,
  } = useQuery({
    queryKey: ["setup-health"],
    queryFn: () => settingsSetupService.systemHealth(),
    staleTime: 30_000,
  });

  // ── Config Export ──
  const exportMut = useMutation({
    mutationFn: () => settingsSetupService.exportConfig(),
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `medbrains-config-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      notifications.show({
        title: "Config Exported",
        message: "Configuration JSON downloaded successfully",
        color: "success",
        icon: <IconCheck size={16} />,
      });
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Export Failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  // ── Config Import ──
  const importMut = useMutation({
    mutationFn: async () => {
      if (!importFile) throw new Error("No file selected");
      const text = await importFile.text();
      const data = JSON.parse(text);
      return settingsSetupService.importConfig(data);
    },
    onSuccess: () => {
      notifications.show({
        title: "Config Imported",
        message: "Configuration imported successfully",
        color: "success",
        icon: <IconCheck size={16} />,
      });
      setImportFile(null);
      refetchCompleteness();
      refetchHealth();
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Import Failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  return (
    <Stack gap="lg">
      {/* System Health Stats */}
      <div>
        <Group justify="space-between" mb="sm">
          <Text fw={600} size="lg">
            System Health
          </Text>
          <Button variant="light" size="xs" onClick={() => refetchHealth()} loading={healthLoading}>
            Refresh
          </Button>
        </Group>
        {health ? (
          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
            <Card withBorder p="md">
              <Group gap="sm">
                <ThemeIcon variant="light" color="primary" size="lg">
                  <IconUsers size={18} />
                </ThemeIcon>
                <div>
                  <Text size="xs" c="dimmed">
                    Users
                  </Text>
                  <Text fw={700} size="xl">
                    {health.user_count}
                  </Text>
                </div>
              </Group>
            </Card>
            <Card withBorder p="md">
              <Group gap="sm">
                <ThemeIcon variant="light" color="teal" size="lg">
                  <IconDatabase size={18} />
                </ThemeIcon>
                <div>
                  <Text size="xs" c="dimmed">
                    Departments
                  </Text>
                  <Text fw={700} size="xl">
                    {health.department_count}
                  </Text>
                </div>
              </Group>
            </Card>
            <Card withBorder p="md">
              <Group gap="sm">
                <ThemeIcon variant="light" color="violet" size="lg">
                  <IconDatabase size={18} />
                </ThemeIcon>
                <div>
                  <Text size="xs" c="dimmed">
                    Modules
                  </Text>
                  <Text fw={700} size="xl">
                    {health.module_count}
                  </Text>
                </div>
              </Group>
            </Card>
            <Card withBorder p="md">
              <Group gap="sm">
                <ThemeIcon variant="light" color="orange" size="lg">
                  <IconDatabase size={18} />
                </ThemeIcon>
                <div>
                  <Text size="xs" c="dimmed">
                    Migrations
                  </Text>
                  <Text fw={700} size="xl">
                    {health.migration_count}
                  </Text>
                </div>
              </Group>
            </Card>
          </SimpleGrid>
        ) : healthLoading ? (
          <Text c="dimmed" size="sm">
            Loading system health...
          </Text>
        ) : null}

        {health && Object.keys(health.table_sizes).length > 0 && (
          <Card withBorder p="md" mt="sm">
            <Text fw={500} size="sm" mb="xs">
              Table Row Counts
            </Text>
            <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }}>
              {Object.entries(health.table_sizes)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(([table, count]) => (
                  <Group key={table} gap="xs">
                    <Text size="xs" c="dimmed" style={{ minWidth: 120 }}>
                      {table}
                    </Text>
                    <Badge variant="light" size="sm">
                      {String(count)}
                    </Badge>
                  </Group>
                ))}
            </SimpleGrid>
          </Card>
        )}
      </div>

      {/* Completeness Check */}
      <div>
        <Group justify="space-between" mb="sm">
          <Text fw={600} size="lg">
            Setup Completeness
          </Text>
          <Button
            variant="light"
            size="xs"
            onClick={() => refetchCompleteness()}
            loading={completenessLoading}
          >
            Refresh
          </Button>
        </Group>
        {completeness ? (
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
            {COMPLETENESS_ITEMS.map((item) => {
              const count = completeness[item.key];
              const ok = count >= item.min;
              return (
                <Card key={item.key} withBorder p="sm">
                  <Group justify="space-between">
                    <Group gap="xs">
                      {ok ? (
                        <IconCircleCheck size={20} color="var(--mantine-color-green-6)" />
                      ) : (
                        <IconCircleX size={20} color="var(--mantine-color-red-6)" />
                      )}
                      <Text size="sm" fw={500}>
                        {item.label}
                      </Text>
                    </Group>
                    <Badge color={ok ? "success" : "danger"} variant="light" size="sm">
                      {count} {item.min > 0 ? `(min: ${item.min})` : ""}
                    </Badge>
                  </Group>
                </Card>
              );
            })}
          </SimpleGrid>
        ) : completenessLoading ? (
          <Text c="dimmed" size="sm">
            Loading completeness check...
          </Text>
        ) : null}
      </div>

      {/* Config Export / Import */}
      <div>
        <Text fw={600} size="lg" mb="sm">
          Configuration Backup
        </Text>
        <Alert icon={<IconInfoCircle size={16} />} variant="light" color="primary" mb="md">
          <Text size="xs">
            Export your system configuration (departments, roles, services, settings) as JSON.
            Import a previously exported config to restore or replicate a setup.
          </Text>
        </Alert>
        <Group gap="md">
          <Button
            leftSection={<IconDownload size={16} />}
            onClick={() => exportMut.mutate()}
            loading={exportMut.isPending}
          >
            Export Config
          </Button>
          <Group gap="xs">
            <FileInput
              placeholder="Select JSON file"
              accept=".json"
              value={importFile}
              onChange={setImportFile}
              style={{ width: 260 }}
            />
            <Button
              leftSection={<IconUpload size={16} />}
              variant="light"
              onClick={() => importMut.mutate()}
              loading={importMut.isPending}
              disabled={!importFile}
            >
              Import Config
            </Button>
          </Group>
        </Group>
      </div>
    </Stack>
  );
}
