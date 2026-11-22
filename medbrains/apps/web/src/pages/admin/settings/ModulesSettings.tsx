import { Group, Loader, SimpleGrid, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { ApiError } from "@medbrains/api";
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
import { CORE_BRICKS, names, offDependencies } from "./module-bricks";
import { type PendingSwitch, PendingSwitchText } from "./PendingSwitchText";

/** What one confirmed switch sends. `together` lets the server switch the dependents with it. */
interface SwitchRequest {
  codes: string[];
  status: "enabled" | "disabled";
  together?: boolean;
}

/** Switches each brick in order, one at a time, so what a brick needs is on before it is. */
async function switchInOrder({ codes, status, together }: SwitchRequest) {
  for (const code of codes) {
    await settingsSetupService.updateModule(code, together ? { status, together } : { status });
  }
}

export function ModulesSettings() {
  const queryClient = useQueryClient();
  const setDisabledModules = useModuleStore((s) => s.setDisabledModules);
  const [selectedEdition, setSelectedEdition] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingSwitch | null>(null);

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
    mutationFn: switchInOrder,
    onSuccess: async (_done, { status }) => {
      setPending(null);
      await refreshEntitlements();
      notifications.show({
        title: status === "enabled" ? "Switched on" : "Switched off",
        message: "The menu and the API now follow the new setting.",
        color: "success",
        icon: <IconCheck size={16} />,
      });
    },
    onError: async (err: Error, { codes, status, together }) => {
      // The server refused because apps that are on need this one. Only it knows all of them
      // (an app that was never set up has no row here), so its words become the one question.
      const mod = modules?.find((m) => m.code === codes.at(-1));
      const blocked = err instanceof ApiError && err.status === 409;
      if (mod && blocked && status === "disabled" && !together) {
        setPending({ mod, others: [], on: false, refusal: err.message });
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["setup-modules"] });
      notifications.show({ title: "Could not switch it", message: err.message, color: "danger" });
    },
  });

  /**
   * Switches a brick at once, or asks first when the bricks it needs are off. Switching off is
   * sent straight away: the server answers 409 when other bricks need it, and that opens the question.
   */
  const handleToggle = (mod: ModuleConfig, on: boolean) => {
    const others = on ? offDependencies(mod.code, modules ?? []) : [];
    if (others.length > 0) {
      setPending({ mod, others, on });
      return;
    }
    toggleMutation.mutate({ codes: [mod.code], status: on ? "enabled" : "disabled" });
  };

  /** Sends the confirmed switch: needs first when turning on, one request when turning off. */
  const confirmPending = () => {
    if (!pending) return;
    const { mod, others, on } = pending;
    toggleMutation.mutate(
      on
        ? { codes: [...others.map((m) => m.code), mod.code], status: "enabled" }
        : { codes: [mod.code], status: "disabled", together: true },
    );
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
          Switch apps on or off for your hospital. Switching off an app that other apps need names
          every one of them, including apps nobody set up, and asks to switch those off with it.
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
        opened={pending !== null}
        onClose={() => setPending(null)}
        title={pending ? `Switch ${pending.on ? "on" : "off"} ${pending.mod.name}` : "Switch"}
        size="md"
        primaryAction={{
          label: pending?.on ? "Switch them all on" : "Switch them off together",
          loading: toggleMutation.isPending,
          onClick: confirmPending,
        }}
        secondaryAction={{ label: "Cancel", onClick: () => setPending(null) }}
      >
        {pending && <PendingSwitchText {...pending} />}
      </Modal>
    </Stack>
  );
}
