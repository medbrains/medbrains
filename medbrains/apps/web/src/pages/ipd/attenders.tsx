// IPD AttendersTab — split from ipd.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Checkbox, Group, Select, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { IpdAttenderFormInput } from "@medbrains/schemas";
import { ipdAttenderFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { AdmissionAttender } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { Badge, Button, IconButton, Table } from "@/components/ui";
import {
  DEFAULT_IPD_ATTENDER_VALUES,
  IPD_ID_PROOF_TYPE_OPTIONS,
  toCreateAttenderRequest,
} from "@/forms/ipd.form";
import { confirmDestructive } from "@/lib/confirm-destructive";
import { ipdService } from "@/services/ipd.service";

export function AttendersTab({ admissionId }: { admissionId: string }) {
  // Adding or removing an attender is its own permission — holding
  // `ipd.admissions.create` does not carry it, so ask for the code the
  // server will actually check rather than inheriting the admitting gate.
  const canManage = useHasPermission(P.IPD.ATTENDERS_MANAGE);
  const queryClient = useQueryClient();
  const [formOpened, formHandlers] = useDisclosure(false);
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<IpdAttenderFormInput>({
    resolver: zodResolver(ipdAttenderFormSchema),
    defaultValues: DEFAULT_IPD_ATTENDER_VALUES,
  });

  const { data: attenders = [] } = useQuery<AdmissionAttender[]>({
    queryKey: ["ipd-attenders", admissionId],
    queryFn: () => ipdService.listAttenders(admissionId),
  });

  const createMutation = useMutation({
    mutationFn: (values: IpdAttenderFormInput) =>
      ipdService.createAttender(admissionId, toCreateAttenderRequest(values)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-attenders", admissionId] });
      formHandlers.close();
      reset(DEFAULT_IPD_ATTENDER_VALUES);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (attenderId: string) => ipdService.deleteAttender(admissionId, attenderId),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["ipd-attenders", admissionId] }),
  });

  return (
    <Stack>
      {canManage && (
        <Button
          tone="primary"
          size="xs"
          leftSection={<IconPlus size={14} />}
          onClick={() => formHandlers.toggle()}
        >
          Add Attender
        </Button>
      )}
      {formOpened && (
        <Stack
          component="form"
          gap="xs"
          onSubmit={handleSubmit((values) => createMutation.mutate(values))}
        >
          <Controller
            control={control}
            name="name"
            render={({ field }) => (
              <TextInput label="Name" required error={errors.name?.message} {...field} />
            )}
          />
          <Controller
            control={control}
            name="relationship"
            render={({ field }) => (
              <TextInput
                label="Relationship"
                required
                error={errors.relationship?.message}
                {...field}
              />
            )}
          />
          <Group grow>
            <Controller
              control={control}
              name="phone"
              render={({ field }) => <TextInput label="Phone" {...field} />}
            />
            <Controller
              control={control}
              name="alt_phone"
              render={({ field }) => <TextInput label="Alt Phone" {...field} />}
            />
          </Group>
          <Controller
            control={control}
            name="address"
            render={({ field }) => <Textarea label="Address" {...field} />}
          />
          <Group grow>
            <Controller
              control={control}
              name="id_proof_type"
              render={({ field }) => (
                <Select
                  label="ID Proof Type"
                  data={IPD_ID_PROOF_TYPE_OPTIONS}
                  value={field.value || null}
                  onChange={(value) => field.onChange(value ?? "")}
                  clearable
                  searchable
                />
              )}
            />
            <Controller
              control={control}
              name="id_proof_number"
              render={({ field }) => <TextInput label="ID Proof Number" {...field} />}
            />
          </Group>
          <Controller
            control={control}
            name="is_primary"
            render={({ field }) => (
              <Checkbox
                label="Primary attender"
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
              />
            )}
          />
          <Button tone="primary" size="xs" type="submit" loading={createMutation.isPending}>
            Save
          </Button>
        </Stack>
      )}
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Name</Table.Th>
            <Table.Th>Relationship</Table.Th>
            <Table.Th>Phone</Table.Th>
            <Table.Th>Primary</Table.Th>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {attenders.map((a) => (
            <Table.Tr key={a.id}>
              <Table.Td>
                <Text size="sm">{a.name}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{a.relationship}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{a.phone ?? "—"}</Text>
              </Table.Td>
              <Table.Td>
                {a.is_primary && (
                  <Badge size="xs" tone="primary">
                    Primary
                  </Badge>
                )}
              </Table.Td>
              <Table.Td>
                {canManage && (
                  <IconButton
                    tone="danger"
                    aria-label="Delete attender"
                    onClick={() =>
                      confirmDestructive({
                        title: "Delete attender",
                        message: `Remove attender "${a.name}" from this admission?`,
                        confirmLabel: "Delete attender",
                        onConfirm: () => deleteMutation.mutate(a.id),
                      })
                    }
                  >
                    <IconTrash size={14} />
                  </IconButton>
                )}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {attenders.length === 0 && (
        <Text c="dimmed" size="sm">
          No attenders recorded yet.
        </Text>
      )}
    </Stack>
  );
}

// ── Discharge Summary ─────────────────────────────────
