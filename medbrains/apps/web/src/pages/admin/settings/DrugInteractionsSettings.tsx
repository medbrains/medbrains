import { zodResolver } from "@hookform/resolvers/zod";
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { type DrugInteractionFormInput, drugInteractionFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { DrugInteraction } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import {
  DEFAULT_DRUG_INTERACTION_FORM_VALUES,
  DRUG_INTERACTION_SEVERITY_OPTIONS,
  toCreateDrugInteractionRequest,
} from "@/forms/clinical-settings.form";
import { clinicalMastersService } from "@/services/clinicalMasters.service";

const SEVERITY_COLORS: Record<string, string> = {
  minor: "warning",
  moderate: "orange",
  major: "danger",
  contraindicated: "violet",
};

export function DrugInteractionsSettings() {
  const canManage = useHasPermission(P.ADMIN.SETTINGS.GENERAL.MANAGE);
  const queryClient = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const form = useForm<DrugInteractionFormInput>({
    resolver: zodResolver(drugInteractionFormSchema),
    defaultValues: DEFAULT_DRUG_INTERACTION_FORM_VALUES,
  });

  const { data: interactions = [] } = useQuery({
    queryKey: ["drug-interactions"],
    queryFn: () => clinicalMastersService.listDrugInteractions(),
  });

  const createMutation = useMutation({
    mutationFn: (data: DrugInteractionFormInput) =>
      clinicalMastersService.createDrugInteraction(toCreateDrugInteractionRequest(data)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["drug-interactions"] });
      notifications.show({
        title: "Created",
        message: "Drug interaction rule added",
        color: "success",
      });
      handleClose();
    },
    onError: () => {
      notifications.show({
        title: "Error",
        message: "Failed to create interaction rule",
        color: "danger",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => clinicalMastersService.deleteDrugInteraction(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["drug-interactions"] });
      notifications.show({
        title: "Deleted",
        message: "Interaction rule removed",
        color: "warning",
      });
    },
  });

  const handleClose = () => {
    close();
    form.reset(DEFAULT_DRUG_INTERACTION_FORM_VALUES);
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text fw={600}>Drug Interaction Rules ({interactions.length})</Text>
        {canManage && (
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={open}>
            Add Interaction
          </Button>
        )}
      </Group>

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Drug A</Table.Th>
            <Table.Th>Drug B</Table.Th>
            <Table.Th>Severity</Table.Th>
            <Table.Th>Description</Table.Th>
            <Table.Th>Management</Table.Th>
            {canManage && <Table.Th w={40} />}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {interactions.map((row: DrugInteraction) => (
            <Table.Tr key={row.id}>
              <Table.Td>
                <Text size="sm" fw={500}>
                  {row.drug_a_name}
                </Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm" fw={500}>
                  {row.drug_b_name}
                </Text>
              </Table.Td>
              <Table.Td>
                <Badge size="sm" color={SEVERITY_COLORS[row.severity] ?? "slate"}>
                  {row.severity}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Text size="xs" lineClamp={2}>
                  {row.description}
                </Text>
              </Table.Td>
              <Table.Td>
                <Text size="xs" c="dimmed" lineClamp={1}>
                  {row.management ?? "—"}
                </Text>
              </Table.Td>
              {canManage && (
                <Table.Td>
                  <ActionIcon
                    variant="subtle"
                    color="danger"
                    size="sm"
                    onClick={() => deleteMutation.mutate(row.id)}
                    aria-label="Delete"
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Table.Td>
              )}
            </Table.Tr>
          ))}
          {interactions.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={canManage ? 6 : 5}>
                <Text size="sm" c="dimmed" ta="center">
                  No drug interaction rules configured
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>

      <Modal opened={opened} onClose={handleClose} title="Add Drug Interaction Rule" size="md">
        <Stack
          component="form"
          gap="sm"
          onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}
        >
          <Controller
            control={form.control}
            name="drug_a_name"
            render={({ field, fieldState }) => (
              <TextInput
                label="Drug A"
                placeholder="e.g. Warfarin"
                required
                error={fieldState.error?.message}
                {...field}
              />
            )}
          />
          <Controller
            control={form.control}
            name="drug_b_name"
            render={({ field, fieldState }) => (
              <TextInput
                label="Drug B"
                placeholder="e.g. Aspirin"
                required
                error={fieldState.error?.message}
                {...field}
              />
            )}
          />
          <Controller
            control={form.control}
            name="severity"
            render={({ field, fieldState }) => (
              <Select
                label="Severity"
                data={DRUG_INTERACTION_SEVERITY_OPTIONS}
                value={field.value}
                onChange={(value) => {
                  if (value) field.onChange(value);
                }}
                required
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={form.control}
            name="description"
            render={({ field, fieldState }) => (
              <Textarea
                label="Description"
                placeholder="Describe the interaction"
                required
                autosize
                minRows={2}
                error={fieldState.error?.message}
                {...field}
              />
            )}
          />
          <Controller
            control={form.control}
            name="mechanism"
            render={({ field, fieldState }) => (
              <TextInput
                label="Mechanism"
                placeholder="Optional"
                error={fieldState.error?.message}
                {...field}
              />
            )}
          />
          <Controller
            control={form.control}
            name="management"
            render={({ field, fieldState }) => (
              <Textarea
                label="Management"
                placeholder="How to manage this interaction"
                autosize
                minRows={2}
                error={fieldState.error?.message}
                {...field}
              />
            )}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={handleClose}>
              Cancel
            </Button>
            <Button
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
