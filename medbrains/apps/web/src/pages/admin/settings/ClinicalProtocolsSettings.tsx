import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Modal, Select, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { type ClinicalProtocolFormInput, clinicalProtocolFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { ClinicalProtocol } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { Badge, Button, IconButton, Table } from "@/components/ui";
import {
  CLINICAL_PROTOCOL_CATEGORY_OPTIONS,
  DEFAULT_CLINICAL_PROTOCOL_FORM_VALUES,
  toCreateClinicalProtocolRequest,
} from "@/forms/clinical-settings.form";
import { clinicalMastersService } from "@/services/clinicalMasters.service";

export function ClinicalProtocolsSettings() {
  const canManage = useHasPermission(P.ADMIN.SETTINGS.GENERAL.MANAGE);
  const queryClient = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const form = useForm<ClinicalProtocolFormInput>({
    resolver: zodResolver(clinicalProtocolFormSchema),
    defaultValues: DEFAULT_CLINICAL_PROTOCOL_FORM_VALUES,
  });

  const { data: protocols = [] } = useQuery({
    queryKey: ["clinical-protocols"],
    queryFn: () => clinicalMastersService.listClinicalProtocols(),
  });

  const createMutation = useMutation({
    mutationFn: (data: ClinicalProtocolFormInput) =>
      clinicalMastersService.createClinicalProtocol(toCreateClinicalProtocolRequest(data)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["clinical-protocols"] });
      notifications.show({
        title: "Created",
        message: "Clinical protocol added",
        color: "success",
      });
      handleClose();
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to create protocol", color: "danger" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => clinicalMastersService.deleteClinicalProtocol(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["clinical-protocols"] });
      notifications.show({ title: "Deleted", message: "Protocol removed", color: "warning" });
    },
  });

  const handleClose = () => {
    close();
    form.reset(DEFAULT_CLINICAL_PROTOCOL_FORM_VALUES);
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text fw={600}>Clinical Protocols ({protocols.length})</Text>
        {canManage && (
          <Button tone="primary" size="xs" leftSection={<IconPlus size={14} />} onClick={open}>
            Add Protocol
          </Button>
        )}
      </Group>

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Name</Table.Th>
            <Table.Th>Code</Table.Th>
            <Table.Th>Category</Table.Th>
            <Table.Th>Description</Table.Th>
            {canManage && <Table.Th w={40} />}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {protocols.map((p: ClinicalProtocol) => (
            <Table.Tr key={p.id}>
              <Table.Td>
                <Text size="sm" fw={500}>
                  {p.name}
                </Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm" c="dimmed">
                  {p.code ?? "—"}
                </Text>
              </Table.Td>
              <Table.Td>
                <Badge tone="neutral" size="sm">
                  {p.category}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Text size="xs" lineClamp={2}>
                  {p.description ?? "—"}
                </Text>
              </Table.Td>
              {canManage && (
                <Table.Td>
                  <IconButton
                    tone="danger"
                    size="sm"
                    onClick={() => deleteMutation.mutate(p.id)}
                    aria-label="Delete"
                  >
                    <IconTrash size={14} />
                  </IconButton>
                </Table.Td>
              )}
            </Table.Tr>
          ))}
          {protocols.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={canManage ? 5 : 4}>
                <Text size="sm" c="dimmed" ta="center">
                  No clinical protocols configured
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>

      <Modal opened={opened} onClose={handleClose} title="Add Clinical Protocol" size="md">
        <Stack
          component="form"
          gap="sm"
          onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}
        >
          <Controller
            control={form.control}
            name="name"
            render={({ field, fieldState }) => (
              <TextInput
                label="Protocol Name"
                placeholder="e.g. Sepsis Bundle 1-Hour"
                required
                error={fieldState.error?.message}
                {...field}
              />
            )}
          />
          <Group grow>
            <Controller
              control={form.control}
              name="code"
              render={({ field, fieldState }) => (
                <TextInput
                  label="Code"
                  placeholder="Optional identifier"
                  error={fieldState.error?.message}
                  {...field}
                />
              )}
            />
            <Controller
              control={form.control}
              name="category"
              render={({ field, fieldState }) => (
                <Select
                  label="Category"
                  data={CLINICAL_PROTOCOL_CATEGORY_OPTIONS}
                  value={field.value}
                  onChange={(value) => {
                    if (value) field.onChange(value);
                  }}
                  required
                  error={fieldState.error?.message}
                />
              )}
            />
          </Group>
          <Controller
            control={form.control}
            name="description"
            render={({ field, fieldState }) => (
              <Textarea
                label="Description"
                placeholder="Protocol description"
                autosize
                minRows={3}
                error={fieldState.error?.message}
                {...field}
              />
            )}
          />
          <Group justify="flex-end">
            <Button tone="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              tone="primary"
              type="submit"
              loading={createMutation.isPending}
              disabled={createMutation.isPending}
            >
              Create
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
