import { zodResolver } from "@hookform/resolvers/zod";
import { Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P, type PsychNominatedRepresentative } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Badge, Button, Checkbox, Input, Modal, Panel, Select } from "@/components/ui";
import { psychiatryService } from "@/services/psychiatry.service";
import { blankToUndefined, formatDate, labelOf, REP_BASES } from "./labels";

const schema = z.object({
  full_name: z.string().trim().min(1, "Enter the representative's name"),
  relationship: z.string(),
  phone: z.string(),
  address: z.string(),
  basis: z.enum([
    "appointed_by_patient",
    "advance_directive",
    "relative",
    "care_giver",
    "board_appointed",
    "temporary_ngo",
    "legal_guardian",
  ]),
  written_consent_received: z.literal(true, {
    error: "The representative must consent in writing (s.14(4))",
  }),
  appointment_document_ref: z.string(),
});
type Form = z.infer<typeof schema>;

function RepCard({ rep }: { rep: PsychNominatedRepresentative }) {
  return (
    <Stack gap={2}>
      <Group gap="xs">
        <Text fw={600}>{rep.full_name}</Text>
        {rep.relationship && <Text size="sm">({rep.relationship})</Text>}
        {rep.revoked_at && <Badge tone="neutral">Revoked {formatDate(rep.revoked_at)}</Badge>}
      </Group>
      <Text size="sm" c="dimmed">
        {rep.basis === "recorded_before_structure"
          ? "Recorded before appointments were structured — confirm the basis and written consent"
          : labelOf(REP_BASES, rep.basis)}
        {rep.phone ? ` · ${rep.phone}` : ""}
      </Text>
    </Stack>
  );
}

/** MHCA s.14 — who speaks for the patient. One active appointment at a time. */
export function RepresentativeSection({ psychPatientId }: { psychPatientId: string }) {
  const qc = useQueryClient();
  const canManage = useHasPermission(P.SPECIALTY.PSYCHIATRY.LEGAL_MANAGE);
  const query = useQuery({
    queryKey: ["psych-reps", psychPatientId],
    queryFn: () => psychiatryService.listRepresentatives(psychPatientId),
  });
  const [open, setOpen] = useState(false);
  const { control, handleSubmit, reset } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: "",
      relationship: "",
      phone: "",
      address: "",
      basis: "appointed_by_patient",
      appointment_document_ref: "",
    },
  });
  const invalidate = () => void qc.invalidateQueries({ queryKey: ["psych-reps", psychPatientId] });
  const create = useMutation({
    mutationFn: (v: Form) =>
      psychiatryService.createRepresentative(psychPatientId, {
        ...v,
        relationship: blankToUndefined(v.relationship),
        phone: blankToUndefined(v.phone),
        address: blankToUndefined(v.address),
        appointment_document_ref: blankToUndefined(v.appointment_document_ref),
      }),
    onSuccess: () => {
      invalidate();
      reset();
      setOpen(false);
    },
  });
  const revoke = useMutation({
    mutationFn: (id: string) => psychiatryService.revokeRepresentative(id, {}),
    onSuccess: invalidate,
  });
  const rows = query.data ?? [];
  const active = rows.find((r) => !r.revoked_at);
  const text = (
    name: "full_name" | "relationship" | "phone" | "address" | "appointment_document_ref",
    label: string,
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Input label={label} error={fieldState.error?.message} {...field} />
      )}
    />
  );

  return (
    <Panel
      title="Nominated representative (s.14)"
      actions={
        canManage && !active ? (
          <Button tone="primary" size="xs" onClick={() => setOpen(true)}>
            Appoint
          </Button>
        ) : undefined
      }
    >
      <Stack gap="sm">
        {query.isError && (
          <Alert tone="danger">The representative could not be loaded. {query.error.message}</Alert>
        )}
        {active ? (
          <Group justify="space-between">
            <RepCard rep={active} />
            {canManage && (
              <Button
                tone="danger-ghost"
                size="xs"
                loading={revoke.isPending}
                onClick={() => revoke.mutate(active.id)}
              >
                Revoke appointment
              </Button>
            )}
          </Group>
        ) : (
          !query.isLoading &&
          !query.isError && (
            <Text size="sm" c="dimmed">
              No representative appointed.
            </Text>
          )
        )}
        {rows
          .filter((r) => r.revoked_at)
          .map((r) => (
            <RepCard key={r.id} rep={r} />
          ))}
        {revoke.isError && <Alert tone="danger">{revoke.error.message}</Alert>}
      </Stack>
      <Modal
        opened={open}
        onClose={() => setOpen(false)}
        title="Appoint a nominated representative"
        primaryAction={{
          label: "Appoint",
          onClick: () => void handleSubmit((v) => create.mutate(v))(),
          loading: create.isPending,
        }}
        secondaryAction={{ label: "Cancel", onClick: () => setOpen(false) }}
      >
        <Stack gap="sm">
          <SimpleGrid cols={2}>
            {text("full_name", "Name")}
            {text("relationship", "Relationship")}
            {text("phone", "Phone")}
            {text("appointment_document_ref", "Appointment document reference")}
          </SimpleGrid>
          {text("address", "Address")}
          <Controller
            control={control}
            name="basis"
            render={({ field }) => (
              <Select
                label="Basis"
                data={REP_BASES}
                value={field.value}
                onChange={(v) => v && field.onChange(v)}
                allowDeselect={false}
              />
            )}
          />
          <Controller
            control={control}
            name="written_consent_received"
            render={({ field, fieldState }) => (
              <Checkbox
                label="The representative has consented in writing to act"
                checked={field.value === true}
                onChange={(e) => field.onChange(e.currentTarget.checked)}
                error={fieldState.error?.message}
              />
            )}
          />
          {create.isError && <Alert tone="danger">{create.error.message}</Alert>}
        </Stack>
      </Modal>
    </Panel>
  );
}
