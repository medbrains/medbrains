// IPD VentilatorTab — split from icu.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Drawer, Group, NumberInput, Select, Stack, Text, Textarea } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { IcuVentilatorFormInput } from "@medbrains/schemas";
import { icuVentilatorFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { IcuVentilatorRecord, VentilatorMode } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { DataTable } from "@/components";
import { Alert, Button } from "@/components/ui";
import {
  DEFAULT_ICU_VENTILATOR_FORM_VALUES,
  ICU_VENTILATOR_MODE_OPTIONS,
  normalizeIcuVentilatorMode,
  toCreateIcuVentilatorRequest,
} from "@/forms/icu.form";
import { icuService } from "@/services/icu.service";

const ventilatorModeLabels: Record<VentilatorMode, string> = {
  cmv: "CMV",
  acv: "ACV",
  simv: "SIMV",
  psv: "PSV",
  cpap: "CPAP",
  bipap: "BiPAP",
  hfov: "HFOV",
  aprv: "APRV",
  niv: "NIV",
  other: "Other",
};

export function VentilatorTab({ admissionId }: { admissionId: string }) {
  const canCreate = useHasPermission(P.ICU.VENTILATOR_CREATE);
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["icu-ventilator", admissionId],
    queryFn: () => icuService.listIcuVentilatorRecords(admissionId),
    enabled: !!admissionId,
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<IcuVentilatorFormInput>({
    resolver: zodResolver(icuVentilatorFormSchema),
    defaultValues: DEFAULT_ICU_VENTILATOR_FORM_VALUES,
  });

  const createMut = useMutation({
    mutationFn: (values: IcuVentilatorFormInput) =>
      icuService.createIcuVentilatorRecord(admissionId, toCreateIcuVentilatorRequest(values)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["icu-ventilator", admissionId] });
      notifications.show({ title: "Ventilator record saved", message: "", color: "success" });
      close();
      reset(DEFAULT_ICU_VENTILATOR_FORM_VALUES);
    },
    onError: (e: Error) =>
      notifications.show({
        title: "Could not save ventilator record",
        message: e.message,
        color: "red",
      }),
  });

  // Lung-protective target: IBW-based tidal volume (ARDSNet). Height + sex are entered here for the
  // target calc; the watched tidal volume from the form is checked against the 4-8 mL/kg range.
  const [lpHeight, setLpHeight] = useState<number | "">("");
  const [lpSex, setLpSex] = useState<string | null>("male");
  const watchedTidal = useWatch({ control, name: "tidal_volume" });
  const tidalMl =
    typeof watchedTidal === "number" ? watchedTidal : Number(watchedTidal) || undefined;
  const { data: lungTarget } = useQuery({
    queryKey: ["lung-protective", lpHeight, lpSex, tidalMl],
    queryFn: () =>
      icuService.lungProtective({
        height_cm: Number(lpHeight),
        sex: lpSex ?? "male",
        tidal_volume_ml: tidalMl,
      }),
    enabled: lpHeight !== "" && Number(lpHeight) >= 100 && !!lpSex,
  });

  const columns = [
    {
      key: "recorded_at",
      label: "Time",
      render: (r: IcuVentilatorRecord) => new Date(r.recorded_at).toLocaleString(),
    },
    {
      key: "mode",
      label: "Mode",
      render: (r: IcuVentilatorRecord) => ventilatorModeLabels[r.mode] ?? r.mode,
    },
    {
      key: "fio2",
      label: "FiO2",
      render: (r: IcuVentilatorRecord) => (r.fio2 != null ? `${r.fio2}%` : "—"),
    },
    {
      key: "peep",
      label: "PEEP",
      render: (r: IcuVentilatorRecord) => (r.peep != null ? String(r.peep) : "—"),
    },
    {
      key: "tidal_volume",
      label: "Vt",
      render: (r: IcuVentilatorRecord) => (r.tidal_volume != null ? `${r.tidal_volume} mL` : "—"),
    },
    {
      key: "ph",
      label: "ABG pH",
      render: (r: IcuVentilatorRecord) => (r.ph != null ? String(r.ph) : "—"),
    },
    {
      key: "pao2",
      label: "PaO2",
      render: (r: IcuVentilatorRecord) => (r.pao2 != null ? String(r.pao2) : "—"),
    },
    {
      key: "paco2",
      label: "PaCO2",
      render: (r: IcuVentilatorRecord) => (r.paco2 != null ? String(r.paco2) : "—"),
    },
  ];

  return (
    <Stack>
      <Group justify="flex-end">
        {canCreate && admissionId && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={open}>
            Record Ventilator
          </Button>
        )}
      </Group>

      {admissionId ? (
        <DataTable
          columns={columns}
          data={records}
          loading={isLoading}
          rowKey={(r) => r.id}
          emptyTitle="No ventilator records"
        />
      ) : (
        <Text c="dimmed" ta="center" py="xl">
          Select an admission to view ventilator records
        </Text>
      )}

      <Drawer
        opened={opened}
        onClose={close}
        title="Record Ventilator Settings"
        position="right"
        size="xl"
      >
        <Stack component="form" onSubmit={handleSubmit((values) => createMut.mutate(values))}>
          <Controller
            control={control}
            name="mode"
            render={({ field }) => (
              <Select
                label="Mode"
                data={ICU_VENTILATOR_MODE_OPTIONS}
                value={field.value}
                onChange={(value) => field.onChange(normalizeIcuVentilatorMode(value))}
                error={errors.mode?.message}
              />
            )}
          />
          <Group grow>
            <Controller
              control={control}
              name="fio2"
              render={({ field }) => (
                <NumberInput
                  label="FiO2 %"
                  decimalScale={1}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.fio2?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="peep"
              render={({ field }) => (
                <NumberInput
                  label="PEEP"
                  decimalScale={1}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.peep?.message}
                />
              )}
            />
          </Group>
          <Group grow>
            <Controller
              control={control}
              name="tidal_volume"
              render={({ field }) => (
                <NumberInput
                  label="Tidal Volume mL"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.tidal_volume?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="respiratory_rate"
              render={({ field }) => (
                <NumberInput
                  label="Resp Rate"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.respiratory_rate?.message}
                />
              )}
            />
          </Group>
          <Group grow>
            <NumberInput
              label="Height (cm) — for lung-protective Vt"
              value={lpHeight}
              onChange={(v) => setLpHeight(typeof v === "number" ? v : "")}
              min={100}
              max={250}
            />
            <Select
              label="Sex (for IBW)"
              data={[
                { value: "male", label: "Male" },
                { value: "female", label: "Female" },
              ]}
              value={lpSex}
              onChange={setLpSex}
            />
          </Group>
          {lungTarget && (
            <Alert
              tone={lungTarget.within_range === false ? "danger" : "info"}
              title={`Lung-protective Vt: ${lungTarget.target_ml} mL (6 mL/kg IBW ${lungTarget.ibw_kg} kg; range ${lungTarget.low_ml}–${lungTarget.high_ml} mL)`}
            >
              {lungTarget.set_ml_per_kg != null
                ? `Set Vt is ${lungTarget.set_ml_per_kg} mL/kg IBW. ${lungTarget.response}`
                : lungTarget.response}
            </Alert>
          )}
          <Group grow>
            <Controller
              control={control}
              name="pip"
              render={({ field }) => (
                <NumberInput
                  label="PIP"
                  decimalScale={1}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.pip?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="plateau_pressure"
              render={({ field }) => (
                <NumberInput
                  label="Plateau"
                  decimalScale={1}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.plateau_pressure?.message}
                />
              )}
            />
          </Group>
          <Text fw={600} size="sm" mt="md">
            ABG Values
          </Text>
          <Group grow>
            <Controller
              control={control}
              name="ph"
              render={({ field }) => (
                <NumberInput
                  label="pH"
                  decimalScale={2}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.ph?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="pao2"
              render={({ field }) => (
                <NumberInput
                  label="PaO2"
                  decimalScale={1}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.pao2?.message}
                />
              )}
            />
          </Group>
          <Group grow>
            <Controller
              control={control}
              name="paco2"
              render={({ field }) => (
                <NumberInput
                  label="PaCO2"
                  decimalScale={1}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.paco2?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="hco3"
              render={({ field }) => (
                <NumberInput
                  label="HCO3"
                  decimalScale={1}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.hco3?.message}
                />
              )}
            />
          </Group>
          <Group grow>
            <Controller
              control={control}
              name="sao2"
              render={({ field }) => (
                <NumberInput
                  label="SaO2"
                  decimalScale={1}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.sao2?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="lactate"
              render={({ field }) => (
                <NumberInput
                  label="Lactate"
                  decimalScale={1}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.lactate?.message}
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

// ── Mortality Comparison ─────────────────────────────────────
