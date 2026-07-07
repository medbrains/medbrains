import { Card, Group, Loader, SimpleGrid, Stack, Switch, Text, Tooltip } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useModuleStore } from "@medbrains/stores";
import type { ModuleConfig } from "@medbrains/types";
import { IconCheck } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, Select } from "@/components/ui";
import { sessionService } from "@/services/session.service";
import { settingsSetupService } from "@/services/settingsSetup.service";

// Core modules that cannot be disabled by the user.
// These are fundamental to the system and must always remain enabled.
const CORE_MODULE_CODES = new Set(["registration", "billing"]);

// Deployment editions (hospital_type) — each seeds a preset module bundle.
const EDITIONS = [
  { value: "standalone_clinic", label: "Small Clinic" },
  { value: "eye_hospital", label: "Eye Hospital" },
  { value: "dental_college", label: "Dental" },
  { value: "multi_specialty", label: "Multi-Specialty" },
  { value: "district_hospital", label: "District / Government (free)" },
  { value: "community_health", label: "Community Health" },
  { value: "primary_health", label: "Primary Health" },
  { value: "medical_college", label: "Medical College" },
];

function isCoreModule(mod: ModuleConfig): boolean {
  return CORE_MODULE_CODES.has(mod.code);
}

export function ModulesSettings() {
  const queryClient = useQueryClient();
  const setDisabledModules = useModuleStore((s) => s.setDisabledModules);
  const [selectedEdition, setSelectedEdition] = useState<string | null>(null);

  const {
    data: modules,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["setup-modules"],
    queryFn: () => settingsSetupService.listModules(),
  });

  const { data: edition } = useQuery({
    queryKey: ["setup-edition"],
    queryFn: () => settingsSetupService.getEdition(),
  });

  const applyEditionMutation = useMutation({
    mutationFn: (hospitalType: string) => settingsSetupService.applyEdition(hospitalType),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["setup-modules"] }),
        queryClient.invalidateQueries({ queryKey: ["setup-edition"] }),
      ]);
      // Refresh the module entitlements so the nav updates immediately (no reload).
      const me = await sessionService.me();
      setDisabledModules(me.disabled_modules ?? []);
      notifications.show({
        title: "Edition applied",
        message: "Modules updated for this edition. Your existing data is untouched.",
        color: "success",
        icon: <IconCheck size={16} />,
      });
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Could not apply edition",
        message: err.message,
        color: "danger",
      });
    },
  });

  const currentEdition = edition?.hospital_type ?? null;
  const editionValue = selectedEdition ?? currentEdition;

  const toggleMutation = useMutation({
    mutationFn: ({ code, status }: { code: string; status: string }) =>
      settingsSetupService.updateModule(code, { status }),
    onSuccess: (updated: ModuleConfig) => {
      void queryClient.invalidateQueries({ queryKey: ["setup-modules"] });
      const label = updated.status === "enabled" ? "enabled" : "disabled";
      notifications.show({
        title: `Module ${label}`,
        message: `${updated.name} has been ${label} successfully.`,
        color: "success",
        icon: <IconCheck size={16} />,
      });
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Toggle failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  const handleToggle = (mod: ModuleConfig, checked: boolean) => {
    toggleMutation.mutate({
      code: mod.code,
      status: checked ? "enabled" : "disabled",
    });
  };

  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="lg" />
        <Text c="dimmed">Loading modules...</Text>
      </Stack>
    );
  }

  if (isError) {
    return (
      <Stack align="center" py="xl">
        <Text c="danger">
          Failed to load modules: {error instanceof Error ? error.message : "Unknown error"}
        </Text>
      </Stack>
    );
  }

  if (!modules || modules.length === 0) {
    return (
      <Stack align="center" py="xl">
        <Text c="dimmed">No modules configured for this tenant.</Text>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <div>
        <Text fw={600} size="lg">
          Modules
        </Text>
        <Text size="sm" c="dimmed">
          Enable or disable modules based on your hospital's needs. Core modules cannot be disabled.
        </Text>
      </div>

      <Card withBorder padding="md" radius="md">
        <Stack gap="sm">
          <div>
            <Text fw={600} size="sm">
              Deployment edition
            </Text>
            <Text size="xs" c="dimmed">
              Pick the kind of facility. Applying an edition enables its modules and disables the
              rest — your existing data is kept.
            </Text>
          </div>
          <Group align="flex-end" gap="sm">
            <Select
              label="Edition"
              data={EDITIONS}
              value={editionValue}
              onChange={setSelectedEdition}
              placeholder="Select edition"
              style={{ minWidth: 240 }}
            />
            <Button
              onClick={() => editionValue && applyEditionMutation.mutate(editionValue)}
              loading={applyEditionMutation.isPending}
              disabled={!editionValue}
            >
              Apply edition
            </Button>
          </Group>
        </Stack>
      </Card>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
        {modules.map((mod) => {
          const isEnabled = mod.status === "enabled";
          const isCore = isCoreModule(mod);
          const isPending = toggleMutation.isPending && toggleMutation.variables?.code === mod.code;

          return (
            <Card key={mod.code} withBorder padding="md" radius="md">
              <Stack gap="sm">
                <Group justify="space-between" wrap="nowrap">
                  <Text fw={600} size="sm" lineClamp={1}>
                    {mod.name}
                  </Text>
                  <Badge tone={isEnabled ? "success" : "neutral"} size="sm">
                    {isEnabled ? "Enabled" : "Disabled"}
                  </Badge>
                </Group>

                {mod.description && (
                  <Text size="xs" c="dimmed" lineClamp={2}>
                    {mod.description}
                  </Text>
                )}

                <Group justify="space-between" mt="auto">
                  {isCore ? (
                    <Tooltip label="Core module — cannot be disabled" withArrow>
                      <div>
                        <Switch checked={isEnabled} disabled label="Core" size="sm" />
                      </div>
                    </Tooltip>
                  ) : (
                    <Switch
                      checked={isEnabled}
                      onChange={(e) => handleToggle(mod, e.currentTarget.checked)}
                      disabled={isPending}
                      label={isEnabled ? "On" : "Off"}
                      size="sm"
                    />
                  )}
                </Group>
              </Stack>
            </Card>
          );
        })}
      </SimpleGrid>
    </Stack>
  );
}
