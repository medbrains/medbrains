// PATIENT ImmunizationsTab — the chart's vaccine doses; each is shared with
// the patient's ABHA as an ImmunizationRecord.

import { zodResolver } from "@hookform/resolvers/zod";
import { Stack, Text } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import { P, type Patient, type PatientImmunization } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable } from "@/components/DataTable";
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Input,
  Modal,
  NumberField,
  Select,
  TextArea,
  toast,
} from "@/components/ui";
import { type DoseForm, doseSchema } from "@/forms/immunization.form";
import { patientDetailService } from "@/services/patientDetail.service";

const ROUTES = [
  { value: "intramuscular", label: "Intramuscular" },
  { value: "subcutaneous", label: "Subcutaneous" },
  { value: "intradermal", label: "Intradermal" },
  { value: "oral", label: "Oral" },
  { value: "intranasal", label: "Intranasal" },
] as const;

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function ImmunizationsTab({ patient }: { patient: Patient }) {
  const canRecord = useHasPermission(P.PATIENTS.IMMUNIZATIONS.RECORD);
  const [opened, { open, close }] = useDisclosure(false);
  const [striking, setStriking] = useState<PatientImmunization | null>(null);
  const key = ["patient-immunizations", patient.id];
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: key,
    queryFn: () => patientDetailService.listImmunizations(patient.id),
  });
  const form = useForm<DoseForm>({
    resolver: zodResolver(doseSchema),
    defaultValues: { vaccine_name: "", given_elsewhere: false, administered_on: new Date() },
  });
  const record = useMutation({
    mutationFn: (v: DoseForm) =>
      patientDetailService.recordImmunization(patient.id, {
        ...v,
        administered_on: ymd(v.administered_on),
        lot_number: v.lot_number || undefined,
        site: v.site || undefined,
        notes: v.notes || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: key });
      toast.success("The dose is on the chart.", { title: "Recorded" });
      form.reset();
      close();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Not recorded" }),
  });

  return (
    <Stack gap="sm">
      {canRecord && (
        <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={open}>
          Record a dose
        </Button>
      )}
      <DataTable
        columns={[
          {
            key: "vaccine",
            label: "Vaccine",
            render: (i: PatientImmunization) => (
              <Text size="sm" td={i.deleted_at ? "line-through" : undefined}>
                {i.vaccine_name}
                {i.dose_number ? ` — dose ${i.dose_number}` : ""}
              </Text>
            ),
          },
          {
            key: "given",
            label: "Given",
            render: (i: PatientImmunization) => (
              <Text size="sm">
                {i.administered_on}
                {i.given_elsewhere ? " (elsewhere, from the card)" : ""}
              </Text>
            ),
          },
          {
            key: "lot",
            label: "Lot",
            render: (i: PatientImmunization) => <Text size="sm">{i.lot_number ?? "—"}</Text>,
          },
          {
            key: "status",
            label: "",
            render: (i: PatientImmunization) =>
              i.deleted_at ? (
                <Badge tone="neutral" size="sm">
                  Struck off: {i.delete_reason}
                </Badge>
              ) : canRecord ? (
                <Button
                  tone="ghost"
                  size="xs"
                  onClick={() => setStriking(i)}
                  aria-label={`Strike off ${i.vaccine_name} as wrong`}
                >
                  Strike off
                </Button>
              ) : null,
          },
        ]}
        data={data ?? []}
        loading={isLoading}
        error={isError ? "The immunisations could not be loaded." : undefined}
        onRetry={() => void refetch()}
        emptyTitle="No immunisations recorded"
        rowKey={(i) => i.id}
      />
      <Modal opened={opened} onClose={close} title="Record a dose">
        <Stack component="form" gap="sm" onSubmit={form.handleSubmit((v) => record.mutate(v))}>
          <Controller
            name="vaccine_name"
            control={form.control}
            render={({ field, fieldState }) => (
              <Input label="Vaccine" required {...field} error={fieldState.error?.message} />
            )}
          />
          <Controller
            name="dose_number"
            control={form.control}
            render={({ field, fieldState }) => (
              <NumberField
                label="Dose number"
                min={1}
                max={20}
                value={field.value ?? ""}
                onChange={(v) => field.onChange(typeof v === "number" ? v : undefined)}
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            name="administered_on"
            control={form.control}
            render={({ field, fieldState }) => (
              <DateInput
                label="Given on"
                required
                maxDate={new Date()}
                value={field.value}
                onChange={(v) => field.onChange(v ? new Date(v) : undefined)}
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            name="given_elsewhere"
            control={form.control}
            render={({ field }) => (
              <Checkbox
                label="Given elsewhere — read off the patient's vaccination card"
                checked={field.value}
                onChange={(e) => field.onChange(e.currentTarget.checked)}
              />
            )}
          />
          <Controller
            name="lot_number"
            control={form.control}
            render={({ field, fieldState }) => (
              <Input
                label="Lot number"
                {...field}
                value={field.value ?? ""}
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            name="route"
            control={form.control}
            render={({ field }) => (
              <Select
                label="Route"
                data={[...ROUTES]}
                clearable
                value={field.value ?? null}
                onChange={(v) => field.onChange(v ?? undefined)}
              />
            )}
          />
          <Controller
            name="site"
            control={form.control}
            render={({ field }) => (
              <Input
                label="Site"
                placeholder="e.g. left deltoid"
                {...field}
                value={field.value ?? ""}
              />
            )}
          />
          <Button tone="primary" type="submit" loading={record.isPending}>
            Record the dose
          </Button>
        </Stack>
      </Modal>
      <StrikeModal
        dose={striking}
        onClose={() => setStriking(null)}
        onDone={() => void queryClient.invalidateQueries({ queryKey: key })}
      />
    </Stack>
  );
}

interface StrikeModalProps {
  dose: PatientImmunization | null;
  onClose: () => void;
  onDone: () => void;
}

/** A wrong dose stays on the chart, struck off with the reason, and is no longer shared. */
function StrikeModal({ dose, onClose, onDone }: StrikeModalProps) {
  const [reason, setReason] = useState("");
  const strike = useMutation({
    mutationFn: () => patientDetailService.strikeImmunization(dose?.id ?? "", reason),
    onSuccess: () => {
      setReason("");
      onDone();
      onClose();
    },
  });
  return (
    <Modal opened={Boolean(dose)} onClose={onClose} title="Strike off a dose">
      <Stack gap="sm">
        {strike.isError && (
          <Alert tone="danger" title="Not struck off">
            {strike.error.message}
          </Alert>
        )}
        <Text size="sm">
          {dose?.vaccine_name} stays on the chart, struck through with your reason, and is no longer
          shared with the patient's ABHA.
        </Text>
        <TextArea
          label="Why is it wrong?"
          required
          value={reason}
          onChange={(e) => setReason(e.currentTarget.value)}
        />
        <Button
          tone="danger"
          disabled={!reason.trim()}
          loading={strike.isPending}
          onClick={() => strike.mutate()}
        >
          Strike off
        </Button>
      </Stack>
    </Modal>
  );
}
