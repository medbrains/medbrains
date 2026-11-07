import { Group, Loader, SimpleGrid, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useModuleStore } from "@medbrains/stores";
import type { ModuleConfig } from "@medbrains/types";
import { IconCheck } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Button, Card, Modal, Select } from "@/components/ui";
import { EDITIONS } from "@/lib/editions";
import { sessionService } from "@/services/session.service";
import { settingsSetupService } from "@/services/settingsSetup.service";
import { ModuleBrickCard } from "./ModuleBrickCard";
import { CORE_BRICKS, names, offDependencies, onDependents } from "./module-bricks";

/** A switch waiting on the operator: turn `mod` on together with the bricks it needs. */
interface PendingEnable {
  mod: ModuleConfig;
  needs: ModuleConfig[];
}

/** Switches each brick in order, one at a time, so what a brick needs is on before it is. */
async function switchInOrder(codes: string[], status: "enabled" | "disabled") {
  for (const code of codes) {
    await settingsSetupService.updateModule(code, { status });
  }
}

export function ModulesSettings() {
  const queryClient = useQueryClient();
  const setDisabledModules = useModuleStore((s) => s.setDisabledModules);
  const [selectedEdition, setSelectedEdition] = useState<string | null>(null);
  const [pendingEnable, setPendingEnable] = useState<PendingEnable | null>(null);

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

  /** Reloads the module list and the menu's entitlements, so the menu changes without a reload. */
  const refreshEntitlements = async () => {
    await queryClient.invalidateQueries({ queryKey: ["setup-modules"] });
    const me = await sessionService.me();
    setDisabledModules(me.disabled_modules ?? []);
  };

  const applyEditionMutation = useMutation({
    mutationFn: (hospitalType: string) => settingsSetupService.applyEdition(hospitalType),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["setup-edition"] });
      await refreshEntitlements();
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

  const toggleMutation = useMutation({
    mutationFn: ({ codes, status }: { codes: string[]; status: "enabled" | "disabled" }) =>
      switchInOrder(codes, status),
    onSuccess: async (_done, { status }) => {
      setPendingEnable(null);
      await refreshEntitlements();
      notifications.show({
        title: status === "enabled" ? "Switched on" : "Switched off",
        message: "The menu and the API now follow the new setting.",
        color: "success",
        icon: <IconCheck size={16} />,
      });
    },
    onError: async (err: Error) => {
      await queryClient.invalidateQueries({ queryKey: ["setup-modules"] });
      notifications.show({ title: "Could not switch it", message: err.message, color: "danger" });
    },
  });

  const handleToggle = (mod: ModuleConfig, on: boolean) => {
    const all = modules ?? [];
    if (!on) {
      const blockers = onDependents(mod.code, all);
      if (blockers.length > 0) {
        notifications.show({
          title: `${mod.name} cannot be switched off`,
          message: `${names(blockers)} need it. Switch those off first.`,
          color: "warning",
        });
        return;
      }
      toggleMutation.mutate({ codes: [mod.code], status: "disabled" });
      return;
    }
    const needs = offDependencies(mod.code, all);
    if (needs.length > 0) {
      setPendingEnable({ mod, needs });
      return;
    }
    toggleMutation.mutate({ codes: [mod.code], status: "enabled" });
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
      <Alert tone="danger" title="Could not load modules">
        {error instanceof Error ? error.message : "Unknown error"}. Nothing has been changed.
      </Alert>
    );
  }

  if (!modules || modules.length === 0) {
    return (
      <Stack align="center" py="xl">
        <Text c="dimmed">No modules configured for this tenant.</Text>
      </Stack>
    );
  }

  const editionValue = selectedEdition ?? edition?.hospital_type ?? null;
  // `disabled` only: the server counts a core brick with any other status as on.
  const coreOff = modules.filter((m) => CORE_BRICKS.has(m.code) && m.status === "disabled");

  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Text fw={600} size="lg">
          Modules
        </Text>
        <Text size="sm" c="dimmed">
          Switch apps on or off for your hospital. An app cannot go off while another app that needs
          it is on.
        </Text>
      </Stack>

      {coreOff.length > 0 && (
        <Alert tone="warning" title="Core apps switched off">
          {names(coreOff)}: their screens and API are switched off.
        </Alert>
      )}

      <Card padding="md">
        <Stack gap="sm">
          <Stack gap={4}>
            <Text fw={600} size="sm">
              Deployment edition
            </Text>
            <Text size="xs" c="dimmed">
              Pick the kind of facility. Applying an edition enables its modules and disables the
              rest — your existing data is kept.
            </Text>
          </Stack>
          <Group align="flex-end" gap="sm">
            <Select
              label="Edition"
              data={EDITIONS}
              value={editionValue}
              onChange={setSelectedEdition}
              placeholder="Select edition"
              miw={240}
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
        {modules.map((mod) => (
          <ModuleBrickCard
            key={mod.code}
            mod={mod}
            modules={modules}
            pending={toggleMutation.isPending}
            onToggle={handleToggle}
          />
        ))}
      </SimpleGrid>

      <Modal
        opened={pendingEnable !== null}
        onClose={() => setPendingEnable(null)}
        title={pendingEnable ? `Switch on ${pendingEnable.mod.name}` : "Switch on"}
        size="md"
        primaryAction={{
          label: "Switch them all on",
          loading: toggleMutation.isPending,
          onClick: () =>
            pendingEnable &&
            toggleMutation.mutate({
              codes: [...pendingEnable.needs.map((m) => m.code), pendingEnable.mod.code],
              status: "enabled",
            }),
        }}
        secondaryAction={{ label: "Cancel", onClick: () => setPendingEnable(null) }}
      >
        {pendingEnable && (
          <Text size="sm">
            {pendingEnable.mod.name} needs {names(pendingEnable.needs)}, which{" "}
            {pendingEnable.needs.length > 1 ? "are" : "is"} off. Switch{" "}
            {pendingEnable.needs.length > 1 ? "them" : "it"} on too?
          </Text>
        )}
      </Modal>
    </Stack>
  );
}
