import {
  Badge,
  Card,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCheck } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import type { ModuleConfig } from "@medbrains/types";

// Core modules that cannot be disabled by the user.
// These are fundamental to the system and must always remain enabled.
const CORE_MODULE_CODES = new Set(["registration", "billing"]);

function isCoreModule(mod: ModuleConfig): boolean {
  return CORE_MODULE_CODES.has(mod.code);
}

export function ModulesSettings() {
  const queryClient = useQueryClient();

  const {
    data: modules,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["setup-modules"],
    queryFn: () => api.listModules(),
  });

  const toggleMutation = useMutation({
    mutationFn: ({
      code,
      status,
    }: {
      code: string;
      status: string;
    }) => api.updateModule(code, { status }),
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
          Failed to load modules:{" "}
          {error instanceof Error ? error.message : "Unknown error"}
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
          Enable or disable modules based on your hospital's needs. Core modules
          cannot be disabled.
        </Text>
      </div>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
        {modules.map((mod) => {
          const isEnabled = mod.status === "enabled";
          const isCore = isCoreModule(mod);
          const isPending =
            toggleMutation.isPending &&
            toggleMutation.variables?.code === mod.code;

          return (
            <Card key={mod.code} withBorder padding="md" radius="md">
              <Stack gap="sm">
                <Group justify="space-between" wrap="nowrap">
                  <Text fw={600} size="sm" lineClamp={1}>
                    {mod.name}
                  </Text>
                  <Badge
                    color={isEnabled ? "success" : "slate"}
                    variant="light"
                    size="sm"
                  >
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
                        <Switch
                          checked={isEnabled}
                          disabled
                          label="Core"
                          size="sm"
                        />
                      </div>
                    </Tooltip>
                  ) : (
                    <Switch
                      checked={isEnabled}
                      onChange={(e) =>
                        handleToggle(mod, e.currentTarget.checked)
                      }
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
