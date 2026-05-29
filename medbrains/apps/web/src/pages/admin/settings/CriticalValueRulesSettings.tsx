import { zodResolver } from "@hookform/resolvers/zod";
import {
  ActionIcon,
  Button,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { type CriticalValueRuleFormInput, criticalValueRuleFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { CriticalValueRule } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import {
  CRITICAL_VALUE_GENDER_OPTIONS,
  DEFAULT_CRITICAL_VALUE_RULE_FORM_VALUES,
  toCreateCriticalValueRuleRequest,
} from "@/forms/clinical-settings.form";
import { clinicalMastersService } from "@/services/clinicalMasters.service";

export function CriticalValueRulesSettings() {
  const canManage = useHasPermission(P.ADMIN.SETTINGS.GENERAL.MANAGE);
  const queryClient = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const form = useForm<CriticalValueRuleFormInput>({
    resolver: zodResolver(criticalValueRuleFormSchema),
    defaultValues: DEFAULT_CRITICAL_VALUE_RULE_FORM_VALUES,
  });

  const { data: rules = [] } = useQuery({
    queryKey: ["critical-value-rules"],
    queryFn: () => clinicalMastersService.listCriticalValueRules(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CriticalValueRuleFormInput) =>
      clinicalMastersService.createCriticalValueRule(toCreateCriticalValueRuleRequest(data)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["critical-value-rules"] });
      notifications.show({
        title: "Created",
        message: "Critical value rule added",
        color: "success",
      });
      handleClose();
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to create rule", color: "danger" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => clinicalMastersService.deleteCriticalValueRule(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["critical-value-rules"] });
      notifications.show({ title: "Deleted", message: "Rule removed", color: "warning" });
    },
  });

  const handleClose = () => {
    close();
    form.reset(DEFAULT_CRITICAL_VALUE_RULE_FORM_VALUES);
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text fw={600}>Critical Value Rules ({rules.length})</Text>
        {canManage && (
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={open}>
            Add Rule
          </Button>
        )}
      </Group>

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Test Code</Table.Th>
            <Table.Th>Test Name</Table.Th>
            <Table.Th>Low Critical</Table.Th>
            <Table.Th>High Critical</Table.Th>
            <Table.Th>Unit</Table.Th>
            <Table.Th>Gender</Table.Th>
            <Table.Th>Alert Message</Table.Th>
            {canManage && <Table.Th w={40} />}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rules.map((r: CriticalValueRule) => (
            <Table.Tr key={r.id}>
              <Table.Td>
                <Text size="sm" fw={500}>
                  {r.test_code}
                </Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{r.test_name}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{r.low_critical ?? "—"}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{r.high_critical ?? "—"}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{r.unit ?? "—"}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{r.gender ?? "All"}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="xs" lineClamp={1}>
                  {r.alert_message}
                </Text>
              </Table.Td>
              {canManage && (
                <Table.Td>
                  <ActionIcon
                    variant="subtle"
                    color="danger"
                    size="sm"
                    onClick={() => deleteMutation.mutate(r.id)}
                    aria-label="Delete"
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Table.Td>
              )}
            </Table.Tr>
          ))}
          {rules.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={canManage ? 8 : 7}>
                <Text size="sm" c="dimmed" ta="center">
                  No critical value rules configured
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>

      <Modal opened={opened} onClose={handleClose} title="Add Critical Value Rule" size="md">
        <Stack
          component="form"
          gap="sm"
          onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}
        >
          <Group grow>
            <Controller
              control={form.control}
              name="test_code"
              render={({ field, fieldState }) => (
                <TextInput
                  label="Test Code"
                  placeholder="e.g. K"
                  required
                  error={fieldState.error?.message}
                  {...field}
                />
              )}
            />
            <Controller
              control={form.control}
              name="test_name"
              render={({ field, fieldState }) => (
                <TextInput
                  label="Test Name"
                  placeholder="e.g. Potassium"
                  required
                  error={fieldState.error?.message}
                  {...field}
                />
              )}
            />
          </Group>
          <Group grow>
            <Controller
              control={form.control}
              name="low_critical"
              render={({ field, fieldState }) => (
                <NumberInput
                  label="Low Critical"
                  placeholder="e.g. 2.5"
                  value={field.value}
                  onChange={field.onChange}
                  decimalScale={4}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={form.control}
              name="high_critical"
              render={({ field, fieldState }) => (
                <NumberInput
                  label="High Critical"
                  placeholder="e.g. 6.5"
                  value={field.value}
                  onChange={field.onChange}
                  decimalScale={4}
                  error={fieldState.error?.message}
                />
              )}
            />
          </Group>
          <Group grow>
            <Controller
              control={form.control}
              name="unit"
              render={({ field, fieldState }) => (
                <TextInput
                  label="Unit"
                  placeholder="e.g. mEq/L"
                  error={fieldState.error?.message}
                  {...field}
                />
              )}
            />
            <Controller
              control={form.control}
              name="gender"
              render={({ field, fieldState }) => (
                <Select
                  label="Gender"
                  data={CRITICAL_VALUE_GENDER_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                  clearable
                  placeholder="All"
                  error={fieldState.error?.message}
                />
              )}
            />
          </Group>
          <Controller
            control={form.control}
            name="alert_message"
            render={({ field, fieldState }) => (
              <Textarea
                label="Alert Message"
                placeholder="Critical value alert text"
                required
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
