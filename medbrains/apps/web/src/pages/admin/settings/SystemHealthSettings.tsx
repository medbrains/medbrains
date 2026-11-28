import { Card, FileInput, Group, SimpleGrid, Stack, Text, ThemeIcon } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type { CompletenessCheck } from "@medbrains/types";
import { P } from "@medbrains/types";
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
import { Alert, Badge, Button } from "@/components/ui";
import { settingsSetupService } from "@/services/settingsSetup.service";
import { BackupStatusCard } from "./BackupStatusCard";

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

const HEALTH_COUNTS = [
  { key: "users", label: "Users", icon: IconUsers },
  { key: "departments", label: "Departments", icon: IconDatabase },
  { key: "modules", label: "Modules", icon: IconDatabase },
  { key: "migrations_applied", label: "Migrations", icon: IconDatabase },
] as const;

/**
 * The server's release beside the web build this browser runs, so an admin
 * (and support on the phone) can see when the two differ, for example a tab
 * still on an old bundle or a web-only patch on an older server.
 */
function VersionRow({ serverVersion }: { serverVersion?: string }) {
  const isSame = serverVersion === __APP_VERSION__;
  return (
    <Group gap="sm">
      <Text size="sm" ff="monospace">
        Server {serverVersion ? `v${serverVersion}` : "version unknown"} · Web v{__APP_VERSION__}
      </Text>
      <Badge tone={isSame ? "success" : "warning"} size="sm">
        {isSame ? "Same release" : "Different releases"}
      </Badge>
    </Group>
  );
}

/**
 * Admin → Settings → System health. A holder of only the backup permission
 * (the IT security officer) sees the backup card alone, and the setup queries
 * are not issued for them.
 */
export function SystemHealthSettings() {
  const canManage = useHasPermission(P.ADMIN.SETTINGS.GENERAL.MANAGE);
  const [importFile, setImportFile] = useState<File | null>(null);

  // ── Completeness Check ──
  const {
    data: completeness,
    isLoading: completenessLoading,
    refetch: refetchCompleteness,
  } = useQuery({
    queryKey: ["setup-completeness"],
    queryFn: () => settingsSetupService.completenessCheck(),
    enabled: canManage,
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
    enabled: canManage,
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
      void refetchCompleteness();
      void refetchHealth();
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Import Failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  if (!canManage) return <BackupStatusCard />;

  return (
    <Stack gap="lg">
      {/* System Health Stats */}
      <div>
        <Group justify="space-between" mb="sm">
          <Text fw={600} size="lg">
            System Health
          </Text>
          <Button
            tone="secondary"
            size="xs"
            onClick={() => refetchHealth()}
            loading={healthLoading}
          >
            Refresh
          </Button>
        </Group>
        {health ? (
          <Stack gap="sm">
            <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
              {HEALTH_COUNTS.map(({ key, label, icon: Icon }) => (
                <Card key={key} withBorder p="md">
                  <Group gap="sm">
                    <ThemeIcon variant="light" color="primary" size="lg">
                      <Icon size={18} />
                    </ThemeIcon>
                    <Stack gap={0}>
                      <Text size="xs" c="dimmed">
                        {label}
                      </Text>
                      <Text fw={700} size="xl">
                        {health[key]}
                      </Text>
                    </Stack>
                  </Group>
                </Card>
              ))}
            </SimpleGrid>
            <VersionRow serverVersion={health.server_version} />
          </Stack>
        ) : healthLoading ? (
          <Text c="dimmed" size="sm">
            Loading system health...
          </Text>
        ) : null}
      </div>

      <BackupStatusCard />

      {/* Completeness Check */}
      <div>
        <Group justify="space-between" mb="sm">
          <Text fw={600} size="lg">
            Setup Completeness
          </Text>
          <Button
            tone="secondary"
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
                    <Badge tone={ok ? "success" : "danger"} size="sm">
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
        <Alert icon={<IconInfoCircle size={16} />} tone="info" mb="md">
          <Text size="xs">
            Export your system configuration (departments, roles, services, settings) as JSON.
            Import a previously exported config to restore or replicate a setup.
          </Text>
        </Alert>
        <Group gap="md">
          <Button
            tone="primary"
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
              tone="secondary"
              leftSection={<IconUpload size={16} />}
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
