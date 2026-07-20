// IPD DietTemplatesTab — split from diet-kitchen.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  Drawer,
  Group,
  NumberInput,
  Progress,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { DietTemplateFormInput } from "@medbrains/schemas";
import { dietTemplateFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { CreateDietTemplateRequest, DietTemplate } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { DataTable } from "@/components";
import { Badge, Button } from "@/components/ui";
import { dietOptionalNumber, dietOptionalText, dietTypeOptions } from "@/forms/diet-kitchen.form";
import { dietKitchenService } from "@/services/diet-kitchen.service";
import { notifyMutationError, rowsOrEmpty } from "./shared";

export function DietTemplatesTab() {
  const qc = useQueryClient();
  const canViewTemplates = useHasPermission(P.DIET.TEMPLATES_LIST);
  const canManage = useHasPermission(P.DIET.TEMPLATES_MANAGE);
  const [opened, { open, close }] = useDisclosure(false);

  const { data: templatesData, isLoading } = useQuery({
    queryKey: ["diet-templates"],
    queryFn: dietKitchenService.listDietTemplates,
    enabled: canViewTemplates,
  });
  const templates = canViewTemplates ? rowsOrEmpty(templatesData) : [];

  const templateForm = useForm<DietTemplateFormInput>({
    resolver: zodResolver(dietTemplateFormSchema),
    defaultValues: {
      name: "",
      diet_type: "custom",
      description: "",
      calories_target: "",
      protein_g: "",
      carbs_g: "",
      fat_g: "",
    },
  });
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = templateForm;

  const createMut = useMutation({
    mutationFn: (data: CreateDietTemplateRequest) => dietKitchenService.createDietTemplate(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["diet-templates"] });
      notifications.show({ title: "Success", message: "Template created", color: "success" });
      close();
      reset();
    },
    onError: notifyMutationError("Could not create template"),
  });

  const submitTemplate = (values: DietTemplateFormInput) => {
    createMut.mutate({
      name: values.name.trim(),
      diet_type: values.diet_type,
      description: dietOptionalText(values.description),
      calories_target: dietOptionalNumber(values.calories_target),
      protein_g: dietOptionalNumber(values.protein_g),
      carbs_g: dietOptionalNumber(values.carbs_g),
      fat_g: dietOptionalNumber(values.fat_g),
    });
  };

  const columns = [
    { key: "name", label: "Name", render: (r: DietTemplate) => <Text fw={500}>{r.name}</Text> },
    {
      key: "diet_type",
      label: "Type",
      render: (r: DietTemplate) => <Badge>{r.diet_type}</Badge>,
    },
    {
      key: "nutrition",
      label: "Nutritional Profile",
      render: (r: DietTemplate) => {
        const hasNutrition = r.calories_target || r.protein_g || r.carbs_g || r.fat_g;
        if (!hasNutrition)
          return (
            <Text size="sm" c="dimmed">
              Not specified
            </Text>
          );

        const totalMacros = (r.protein_g ?? 0) + (r.carbs_g ?? 0) + (r.fat_g ?? 0);
        const proteinPct = totalMacros > 0 ? ((r.protein_g ?? 0) / totalMacros) * 100 : 0;
        const carbsPct = totalMacros > 0 ? ((r.carbs_g ?? 0) / totalMacros) * 100 : 0;
        const fatPct = totalMacros > 0 ? ((r.fat_g ?? 0) / totalMacros) * 100 : 0;

        return (
          <Stack gap={4}>
            {r.calories_target && (
              <Text size="xs" fw={500}>
                {r.calories_target} kcal target
              </Text>
            )}
            {totalMacros > 0 && (
              <>
                <Progress.Root size="sm">
                  <Progress.Section value={proteinPct} color="primary">
                    <Progress.Label>P</Progress.Label>
                  </Progress.Section>
                  <Progress.Section value={carbsPct} color="success">
                    <Progress.Label>C</Progress.Label>
                  </Progress.Section>
                  <Progress.Section value={fatPct} color="warning">
                    <Progress.Label>F</Progress.Label>
                  </Progress.Section>
                </Progress.Root>
                <Text size="xs" c="dimmed">
                  P: {r.protein_g ?? 0}g • C: {r.carbs_g ?? 0}g • F: {r.fat_g ?? 0}g
                </Text>
              </>
            )}
          </Stack>
        );
      },
    },
    {
      key: "is_active",
      label: "Active",
      render: (r: DietTemplate) => (
        <Badge tone={r.is_active ? "success" : "neutral"}>{r.is_active ? "Yes" : "No"}</Badge>
      ),
    },
  ];

  return (
    <>
      <Group justify="flex-end" mb="md">
        {canManage && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={open}>
            New Template
          </Button>
        )}
      </Group>
      {canViewTemplates ? (
        <DataTable
          columns={columns}
          data={templates}
          loading={isLoading}
          rowKey={(r) => r.id}
          emptyTitle="No diet templates"
        />
      ) : (
        <Card withBorder p="md">
          <Text size="sm" c="dimmed">
            Template list is not available for your role. You can still create a new template when
            template management is allowed.
          </Text>
        </Card>
      )}
      <Drawer opened={opened} onClose={close} title="New Diet Template" position="right" size="xl">
        <Stack component="form" onSubmit={handleSubmit(submitTemplate)}>
          <Controller
            name="name"
            control={control}
            render={({ field }) => (
              <TextInput label="Name" required {...field} error={errors.name?.message} />
            )}
          />
          <Controller
            name="diet_type"
            control={control}
            render={({ field }) => (
              <Select
                label="Diet Type"
                data={dietTypeOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "custom")}
                error={errors.diet_type?.message}
              />
            )}
          />
          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <Textarea label="Description" {...field} error={errors.description?.message} />
            )}
          />
          <Controller
            name="calories_target"
            control={control}
            render={({ field }) => (
              <NumberInput
                label="Calories Target"
                value={field.value}
                onChange={field.onChange}
                error={errors.calories_target?.message}
              />
            )}
          />
          <Group grow>
            <Controller
              name="protein_g"
              control={control}
              render={({ field }) => (
                <NumberInput
                  label="Protein (g)"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.protein_g?.message}
                />
              )}
            />
            <Controller
              name="carbs_g"
              control={control}
              render={({ field }) => (
                <NumberInput
                  label="Carbs (g)"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.carbs_g?.message}
                />
              )}
            />
            <Controller
              name="fat_g"
              control={control}
              render={({ field }) => (
                <NumberInput
                  label="Fat (g)"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.fat_g?.message}
                />
              )}
            />
          </Group>
          <Button tone="primary" loading={createMut.isPending} type="submit">
            Create Template
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Kitchen & Meal Prep Tab
// ══════════════════════════════════════════════════════════
