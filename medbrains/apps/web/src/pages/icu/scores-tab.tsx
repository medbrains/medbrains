// IPD ScoresTab — split from icu.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  Drawer,
  Group,
  NumberInput,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  ThemeIcon,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { IcuScoreFormInput } from "@medbrains/schemas";
import { icuScoreFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { IcuScore, IcuScoreType } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable } from "@/components";
import { Button } from "@/components/ui";
import {
  DEFAULT_ICU_SCORE_FORM_VALUES,
  ICU_SCORE_TYPE_OPTIONS,
  normalizeIcuScoreType,
  toCreateIcuScoreRequest,
} from "@/forms/icu.form";
import { icuService } from "@/services/icu.service";

const scoreTypeLabels: Record<IcuScoreType, string> = {
  apache_ii: "APACHE II",
  apache_iv: "APACHE IV",
  sofa: "SOFA",
  gcs: "GCS",
  prism: "PRISM",
  snappe: "SNAPPE",
  rass: "RASS",
  cam_icu: "CAM-ICU",
};

function MortalityComparison({ scores }: { scores: IcuScore[] }) {
  const mortalityScores = useMemo(
    () =>
      scores
        .filter((s) => s.predicted_mortality != null)
        .sort((a, b) => new Date(b.scored_at).getTime() - new Date(a.scored_at).getTime()),
    [scores],
  );

  const latest = mortalityScores[0];
  if (!latest) return null;

  const latestMortality = latest.predicted_mortality ?? 0;

  // Determine severity color based on predicted mortality
  const severityColor =
    latestMortality >= 75
      ? "danger"
      : latestMortality >= 50
        ? "orange"
        : latestMortality >= 25
          ? "warning"
          : "success";

  // Average predicted mortality across all scored entries
  const avgMortality =
    mortalityScores.reduce((sum, s) => sum + (s.predicted_mortality ?? 0), 0) /
    mortalityScores.length;

  return (
    <Card withBorder padding="md" mt="md">
      <Text fw={600} size="sm" mb="sm">
        Predicted Mortality Analysis
      </Text>
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <Card withBorder padding="sm" radius="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Latest Prediction ({scoreTypeLabels[latest.score_type] ?? latest.score_type})
          </Text>
          <Text size="xl" fw={700} c={severityColor} mt={4}>
            {latestMortality.toFixed(1)}%
          </Text>
          <Text size="xs" c="dimmed">
            Score: {latest.score_value} | {new Date(latest.scored_at).toLocaleDateString()}
          </Text>
          <Progress value={latestMortality} color={severityColor} mt="xs" size="sm" />
        </Card>

        <Card withBorder padding="sm" radius="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Average Predicted Mortality
          </Text>
          <Text size="xl" fw={700} c={avgMortality >= 50 ? "orange" : "primary"} mt={4}>
            {avgMortality.toFixed(1)}%
          </Text>
          <Text size="xs" c="dimmed">
            Across {mortalityScores.length} scored assessment{mortalityScores.length > 1 ? "s" : ""}
          </Text>
          <Progress
            value={avgMortality}
            color={avgMortality >= 50 ? "orange" : "primary"}
            mt="xs"
            size="sm"
          />
        </Card>

        <Card withBorder padding="sm" radius="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Trend
          </Text>
          {mortalityScores.length >= 2 ? (
            (() => {
              const oldest = mortalityScores[mortalityScores.length - 1];
              if (!oldest) return null;
              const diff = latestMortality - (oldest.predicted_mortality ?? 0);
              const improving = diff < 0;
              return (
                <>
                  <Text size="xl" fw={700} c={improving ? "success" : "danger"} mt={4}>
                    {improving ? "" : "+"}
                    {diff.toFixed(1)}%
                  </Text>
                  <Text size="xs" c="dimmed">
                    {improving ? "Improving" : "Worsening"} from first assessment
                  </Text>
                  <ThemeIcon
                    size="sm"
                    variant="light"
                    color={improving ? "success" : "danger"}
                    mt="xs"
                  >
                    <Text size="xs">{improving ? "v" : "^"}</Text>
                  </ThemeIcon>
                </>
              );
            })()
          ) : (
            <Text size="sm" c="dimmed" mt={4}>
              Need 2+ assessments
            </Text>
          )}
        </Card>
      </SimpleGrid>
    </Card>
  );
}

export function ScoresTab({ admissionId }: { admissionId: string }) {
  const canCreate = useHasPermission(P.ICU.SCORES_CREATE);
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);

  const { data: scores = [], isLoading } = useQuery({
    queryKey: ["icu-scores", admissionId],
    queryFn: () => icuService.listIcuScores(admissionId),
    enabled: !!admissionId,
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<IcuScoreFormInput>({
    resolver: zodResolver(icuScoreFormSchema),
    defaultValues: DEFAULT_ICU_SCORE_FORM_VALUES,
  });

  const createMut = useMutation({
    mutationFn: (values: IcuScoreFormInput) =>
      icuService.createIcuScore(admissionId, toCreateIcuScoreRequest(values)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["icu-scores", admissionId] });
      notifications.show({ title: "Score recorded", message: "", color: "success" });
      close();
      reset(DEFAULT_ICU_SCORE_FORM_VALUES);
    },
    onError: (e: Error) =>
      notifications.show({ title: "Could not record score", message: e.message, color: "red" }),
  });

  const columns = [
    {
      key: "scored_at",
      label: "Time",
      render: (r: IcuScore) => new Date(r.scored_at).toLocaleString(),
    },
    {
      key: "score_type",
      label: "Type",
      render: (r: IcuScore) => scoreTypeLabels[r.score_type] ?? r.score_type,
    },
    { key: "score_value", label: "Score", render: (r: IcuScore) => String(r.score_value) },
    {
      key: "predicted_mortality",
      label: "Mortality %",
      render: (r: IcuScore) => (r.predicted_mortality != null ? `${r.predicted_mortality}%` : "—"),
    },
    { key: "notes", label: "Notes", render: (r: IcuScore) => r.notes ?? "" },
  ];

  return (
    <Stack>
      <Group justify="flex-end">
        {canCreate && admissionId && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={open}>
            Record Score
          </Button>
        )}
      </Group>

      {admissionId ? (
        <DataTable
          columns={columns}
          data={scores}
          loading={isLoading}
          rowKey={(r) => r.id}
          emptyTitle="No scores recorded"
        />
      ) : (
        <Text c="dimmed" ta="center" py="xl">
          Select an admission to view ICU scores
        </Text>
      )}

      {/* Predicted vs Actual Mortality */}
      {admissionId && scores.length > 0 && <MortalityComparison scores={scores} />}

      <Drawer opened={opened} onClose={close} title="Record ICU Score" position="right" size="sm">
        <Stack component="form" onSubmit={handleSubmit((values) => createMut.mutate(values))}>
          <Controller
            control={control}
            name="score_type"
            render={({ field }) => (
              <Select
                label="Score Type"
                data={ICU_SCORE_TYPE_OPTIONS}
                value={field.value}
                onChange={(value) => field.onChange(normalizeIcuScoreType(value))}
                error={errors.score_type?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="score_value"
            render={({ field }) => (
              <NumberInput
                label="Score Value"
                value={field.value}
                onChange={field.onChange}
                error={errors.score_value?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="predicted_mortality"
            render={({ field }) => (
              <NumberInput
                label="Predicted Mortality %"
                decimalScale={1}
                value={field.value}
                onChange={field.onChange}
                error={errors.predicted_mortality?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="notes"
            render={({ field }) => <Textarea label="Notes" {...field} />}
          />
          <Button tone="primary" loading={createMut.isPending} type="submit">
            Save
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ── Devices Tab ─────────────────────────────────────────────
