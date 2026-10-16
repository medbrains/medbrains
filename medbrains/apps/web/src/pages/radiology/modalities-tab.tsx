// Radiology ModalitiesTab — the maker for the modality master every
// radiology order picks from. Without rows here no order can be placed.

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type { RadiologyModality } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { PageHeader } from "@/components";
import { Alert, Badge, Button, IconButton, Panel, Switch, Table } from "@/components/ui";
import { confirmDestructive } from "@/lib/confirm";
import { searchErrorText } from "@/lib/search-error";
import { radiologyService } from "@/services/radiology.service";

const QUERY_KEY = ["radiology-modalities"];

const modalityFormSchema = z.object({
  code: z.string().trim().min(1, "Enter a code, e.g. CT").max(20, "20 characters at most"),
  name: z.string().trim().min(1, "Enter a name, e.g. Computed tomography").max(200),
  description: z.string().trim(),
  is_ultrasound: z.boolean(),
});
type ModalityFormValues = z.infer<typeof modalityFormSchema>;
const EMPTY_FORM: ModalityFormValues = {
  code: "",
  name: "",
  description: "",
  is_ultrasound: false,
};

function showError(title: string) {
  return (error: Error) => notifications.show({ title, message: error.message, color: "danger" });
}

export function ModalitiesTab() {
  const canManage = useHasPermission(P.RADIOLOGY.MODALITIES_MANAGE);
  const qc = useQueryClient();
  // null = form closed, "" = adding, an id = editing that modality.
  const [editingId, setEditingId] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ModalityFormValues>({
    resolver: zodResolver(modalityFormSchema),
    defaultValues: EMPTY_FORM,
  });

  const {
    data: modalities = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => radiologyService.listRadiologyModalities(),
  });

  const closeForm = () => {
    setEditingId(null);
    reset(EMPTY_FORM);
  };
  const refresh = () => void qc.invalidateQueries({ queryKey: QUERY_KEY });

  const saveMutation = useMutation({
    mutationFn: (values: ModalityFormValues) =>
      editingId
        ? radiologyService.updateRadiologyModality(editingId, {
            name: values.name,
            description: values.description,
            is_ultrasound: values.is_ultrasound,
          })
        : radiologyService.createRadiologyModality({
            code: values.code.toUpperCase(),
            name: values.name,
            description: values.description || undefined,
            is_ultrasound: values.is_ultrasound,
          }),
    onSuccess: () => {
      refresh();
      notifications.show({ title: "Modality saved", message: "", color: "success" });
      closeForm();
    },
    onError: showError("Could not save modality"),
  });

  const activeMutation = useMutation({
    mutationFn: (m: RadiologyModality) =>
      radiologyService.updateRadiologyModality(m.id, { is_active: !m.is_active }),
    onSuccess: refresh,
    onError: showError("Could not change modality status"),
  });

  const retireMutation = useMutation({
    mutationFn: (id: string) => radiologyService.deleteRadiologyModality(id),
    onSuccess: () => {
      refresh();
      notifications.show({ title: "Modality retired", message: "", color: "success" });
    },
    onError: showError("Could not retire modality"),
  });

  const openEdit = (m: RadiologyModality) => {
    setEditingId(m.id);
    reset({
      code: m.code,
      name: m.name,
      description: m.description ?? "",
      is_ultrasound: m.is_ultrasound,
    });
  };

  return (
    <>
      <PageHeader
        title="Imaging modalities"
        subtitle="Every radiology order picks one of these. Only active modalities can be ordered."
        actions={
          canManage && editingId === null ? (
            <Button
              tone="primary"
              leftSection={<IconPlus size={16} />}
              size="xs"
              onClick={() => setEditingId("")}
            >
              Add modality
            </Button>
          ) : undefined
        }
      />

      {editingId !== null && (
        <Panel title={editingId ? "Edit modality" : "Add modality"}>
          <Stack component="form" onSubmit={handleSubmit((v) => saveMutation.mutate(v))}>
            <Group grow>
              <TextInput
                label="Code"
                required
                placeholder="CT"
                description="DICOM modality code where one exists (CR, DX, CT, MR, US, MG, RF, NM)"
                disabled={Boolean(editingId)}
                error={errors.code?.message}
                {...register("code")}
              />
              <TextInput
                label="Name"
                required
                placeholder="Computed tomography"
                error={errors.name?.message}
                {...register("name")}
              />
            </Group>
            <TextInput label="Description" {...register("description")} />
            <Controller
              control={control}
              name="is_ultrasound"
              render={({ field }) => (
                <Switch
                  label="Ultrasound"
                  description="A scan of a pregnant woman on it needs a PC-PNDT Form F"
                  checked={field.value}
                  onChange={(e) => field.onChange(e.currentTarget.checked)}
                />
              )}
            />
            <Group>
              <Button tone="primary" type="submit" loading={saveMutation.isPending}>
                Save
              </Button>
              <Button tone="ghost" onClick={closeForm}>
                Cancel
              </Button>
            </Group>
          </Stack>
        </Panel>
      )}

      {error && <Alert tone="danger">{searchErrorText(error, "imaging modalities")}</Alert>}
      {!isLoading && !error && modalities.length === 0 && (
        <Alert tone="warning">
          No modality is set up, so no radiology order can be placed.
          {canManage ? " Add the modalities this hospital runs." : " Ask the radiology manager."}
        </Alert>
      )}

      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Code</Table.Th>
            <Table.Th>Name</Table.Th>
            <Table.Th>Description</Table.Th>
            <Table.Th>Status</Table.Th>
            {canManage && <Table.Th>Actions</Table.Th>}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {isLoading ? (
            <Table.Tr>
              <Table.Td colSpan={5}>
                <Text c="dimmed">Loading…</Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            modalities.map((m) => (
              <Table.Tr key={m.id}>
                <Table.Td fw={600}>{m.code}</Table.Td>
                <Table.Td>{m.name}</Table.Td>
                <Table.Td>{m.description ?? "—"}</Table.Td>
                <Table.Td>
                  {canManage ? (
                    <Switch
                      checked={m.is_active}
                      label={m.is_active ? "Active" : "Inactive"}
                      disabled={activeMutation.isPending}
                      onChange={() => activeMutation.mutate(m)}
                    />
                  ) : (
                    <Badge tone={m.is_active ? "success" : "neutral"} size="xs">
                      {m.is_active ? "Active" : "Inactive"}
                    </Badge>
                  )}
                </Table.Td>
                {canManage && (
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <IconButton aria-label={`Edit ${m.name}`} onClick={() => openEdit(m)}>
                        <IconPencil size={16} />
                      </IconButton>
                      <IconButton
                        tone="danger"
                        aria-label={`Retire ${m.name}`}
                        onClick={() =>
                          confirmDestructive({
                            title: `Retire ${m.name}?`,
                            message:
                              "It disappears from ordering. Past orders keep it. To pause it for a while, switch it to inactive instead.",
                            confirmLabel: "Retire",
                            onConfirm: () => retireMutation.mutate(m.id),
                          })
                        }
                      >
                        <IconTrash size={16} />
                      </IconButton>
                    </Group>
                  </Table.Td>
                )}
              </Table.Tr>
            ))
          )}
        </Table.Tbody>
      </Table>
    </>
  );
}
