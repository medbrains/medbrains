import { zodResolver } from "@hookform/resolvers/zod";
import { Card, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { api } from "@medbrains/api";
import { P } from "@medbrains/types";
import { IconKey, IconServerCog } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { PageHeader } from "@/components";
import { StartupChecksCard } from "@/components/admin/StartupChecksCard";
import { AiLabel, Badge, Button, Input, Select } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";

const SECRETS_LABEL: Record<string, string> = {
  env: "Environment variables",
  file: "File (sops / mounted)",
  "aws-secrets-manager": "AWS Secrets Manager",
};

const aiFormSchema = z.object({
  provider: z.string().min(1),
  model: z.string(),
});
type AiFormInput = z.infer<typeof aiFormSchema>;

export function InfrastructurePage() {
  useRequirePermission(P.ADMIN.SETTINGS.GENERAL.MANAGE);
  const queryClient = useQueryClient();

  const { data: status } = useQuery({
    queryKey: ["infra-status"],
    queryFn: () => api.getInfraStatus(),
  });
  const { data: ai } = useQuery({
    queryKey: ["ai-settings"],
    queryFn: () => api.getAiSettings(),
  });

  const { control, register, handleSubmit } = useForm<AiFormInput>({
    resolver: zodResolver(aiFormSchema),
    values: {
      provider: ai?.provider ?? "anthropic",
      model: ai?.model ?? "",
    },
  });

  const saveMutation = useMutation({
    mutationFn: (data: AiFormInput) =>
      api.updateAiSettings({
        provider: data.provider,
        model: data.model.trim(),
      }),
    onSuccess: () => {
      notifications.show({ title: "AI settings saved", message: "Updated.", color: "success" });
      void queryClient.invalidateQueries({ queryKey: ["ai-settings"] });
    },
    onError: (err: Error) =>
      notifications.show({ title: "Save failed", message: err.message, color: "danger" }),
  });

  const onSave = handleSubmit((data) => saveMutation.mutate(data));

  return (
    <Stack>
      <PageHeader
        title="Infrastructure & Security"
        subtitle="Node-level secrets backend and per-tenant AI provider. IT-owned — these govern where keys live and which model powers AI features."
      />

      <Card withBorder padding="lg">
        <Group gap="xs" mb="sm">
          <IconServerCog size={18} />
          <Text fw={600}>Node status</Text>
          <Text size="xs" c="dimmed">
            (read-only — set at deploy time)
          </Text>
        </Group>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <Stack gap={2}>
            <Text size="xs" tt="uppercase" fw={600} c="dimmed">
              Secrets backend
            </Text>
            <Group gap="xs">
              <IconKey size={15} />
              <Badge tone="primary" size="sm">
                {status ? (SECRETS_LABEL[status.secrets_backend] ?? status.secrets_backend) : "…"}
              </Badge>
            </Group>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" tt="uppercase" fw={600} c="dimmed">
              Deploy mode
            </Text>
            <Badge tone="neutral" size="sm">
              {status?.deploy_mode ?? "…"}
            </Badge>
          </Stack>
        </SimpleGrid>
      </Card>

      <StartupChecksCard checks={status?.startup_checks} />

      <Card withBorder padding="lg">
        <Group gap="xs" mb="xs">
          <Text fw={600}>AI provider</Text>
          <AiLabel
            size="sm"
            explainer={{
              title: "AI-assisted features",
              description:
                "Powers AI code generation and AI course authoring. The model below applies to this hospital only. There is no API key: the server signs in to Anthropic with its own AWS identity.",
              model: ai?.model || "claude-sonnet-4-6 (default)",
            }}
          />
        </Group>
        <Text size="sm" c="dimmed" mb="md">
          Anthropic is reached with the server&apos;s AWS identity (workload identity federation),
          so there is no API key to enter. Whether federation is set up on this server is shown
          under Startup checks above (ai.anthropic_federation).
        </Text>

        <Stack gap="sm" maw={520}>
          <Controller
            control={control}
            name="provider"
            render={({ field }) => (
              <Select
                label="Provider"
                data={[{ value: "anthropic", label: "Anthropic (Claude)" }]}
                value={field.value}
                onChange={(v) => field.onChange(v ?? "anthropic")}
                allowDeselect={false}
              />
            )}
          />
          <Input
            label="Model"
            placeholder="claude-sonnet-4-6"
            description="Leave blank to use the platform default."
            {...register("model")}
          />
          <Group justify="flex-end">
            <Button tone="primary" onClick={() => void onSave()} loading={saveMutation.isPending}>
              Save AI settings
            </Button>
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}
