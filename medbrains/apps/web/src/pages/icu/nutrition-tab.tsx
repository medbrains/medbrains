// IPD NutritionTab — split from icu.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Drawer,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { IcuNutritionFormInput } from "@medbrains/schemas";
import { icuNutritionFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { IcuNutrition, NutritionRoute } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { DataTable } from "@/components";
import { Button } from "@/components/ui";
import {
  DEFAULT_ICU_NUTRITION_FORM_VALUES,
  ICU_NUTRITION_ROUTE_OPTIONS,
  normalizeIcuNutritionRoute,
  toCreateIcuNutritionRequest,
} from "@/forms/icu.form";
import { icuService } from "@/services/icu.service";

const nutritionRouteLabels: Record<NutritionRoute, string> = {
  enteral: "Enteral",
  parenteral: "Parenteral",
  oral: "Oral",
  npo: "NPO",
};

export function NutritionTab({ admissionId }: { admissionId: string }) {
  const canCreate = useHasPermission(P.ICU.NUTRITION_CREATE);
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["icu-nutrition", admissionId],
    queryFn: () => icuService.listIcuNutrition(admissionId),
    enabled: !!admissionId,
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<IcuNutritionFormInput>({
    resolver: zodResolver(icuNutritionFormSchema),
    defaultValues: DEFAULT_ICU_NUTRITION_FORM_VALUES,
  });

  const createMut = useMutation({
    mutationFn: (values: IcuNutritionFormInput) =>
      icuService.createIcuNutrition(admissionId, toCreateIcuNutritionRequest(values)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["icu-nutrition", admissionId] });
      notifications.show({ title: "Nutrition recorded", message: "", color: "success" });
      close();
      reset(DEFAULT_ICU_NUTRITION_FORM_VALUES);
    },
    onError: (e: Error) =>
      notifications.show({ title: "Could not record nutrition", message: e.message, color: "red" }),
  });

  const columns = [
    {
      key: "recorded_at",
      label: "Time",
      render: (r: IcuNutrition) => new Date(r.recorded_at).toLocaleString(),
    },
    {
      key: "route",
      label: "Route",
      render: (r: IcuNutrition) => nutritionRouteLabels[r.route] ?? r.route,
    },
    {
      key: "formula_name",
      label: "Formula",
      render: (r: IcuNutrition) => r.formula_name ?? "—",
    },
    {
      key: "rate_ml_hr",
      label: "Rate mL/hr",
      render: (r: IcuNutrition) => (r.rate_ml_hr != null ? String(r.rate_ml_hr) : "—"),
    },
    {
      key: "calories_kcal",
      label: "kcal",
      render: (r: IcuNutrition) => (r.calories_kcal != null ? String(r.calories_kcal) : "—"),
    },
    {
      key: "protein_gm",
      label: "Protein g",
      render: (r: IcuNutrition) => (r.protein_gm != null ? String(r.protein_gm) : "—"),
    },
    { key: "notes", label: "Notes", render: (r: IcuNutrition) => r.notes ?? "" },
  ];

  return (
    <Stack>
      <Group justify="flex-end">
        {canCreate && admissionId && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={open}>
            Record Nutrition
          </Button>
        )}
      </Group>

      {admissionId ? (
        <DataTable
          columns={columns}
          data={records}
          loading={isLoading}
          rowKey={(r) => r.id}
          emptyTitle="No nutrition records"
        />
      ) : (
        <Text c="dimmed" ta="center" py="xl">
          Select an admission to view nutrition
        </Text>
      )}

      <Drawer opened={opened} onClose={close} title="Record Nutrition" position="right" size="sm">
        <Stack component="form" onSubmit={handleSubmit((values) => createMut.mutate(values))}>
          <Controller
            control={control}
            name="route"
            render={({ field }) => (
              <Select
                label="Route"
                data={ICU_NUTRITION_ROUTE_OPTIONS}
                value={field.value}
                onChange={(value) => field.onChange(normalizeIcuNutritionRoute(value))}
                error={errors.route?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="formula_name"
            render={({ field }) => (
              <TextInput label="Formula Name" {...field} error={errors.formula_name?.message} />
            )}
          />
          <Group grow>
            <Controller
              control={control}
              name="rate_ml_hr"
              render={({ field }) => (
                <NumberInput
                  label="Rate mL/hr"
                  decimalScale={1}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.rate_ml_hr?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="volume_ml"
              render={({ field }) => (
                <NumberInput
                  label="Volume mL"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.volume_ml?.message}
                />
              )}
            />
          </Group>
          <Group grow>
            <Controller
              control={control}
              name="calories_kcal"
              render={({ field }) => (
                <NumberInput
                  label="Calories kcal"
                  decimalScale={1}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.calories_kcal?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="protein_gm"
              render={({ field }) => (
                <NumberInput
                  label="Protein g"
                  decimalScale={1}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.protein_gm?.message}
                />
              )}
            />
          </Group>
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

// ── Bilirubin & Phototherapy Panel ───────────────────────────
