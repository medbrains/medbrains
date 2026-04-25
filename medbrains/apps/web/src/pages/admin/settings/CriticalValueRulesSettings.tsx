import { useState } from "react";
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
  TextInput,
  Textarea,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import type { CriticalValueRule, CreateCriticalValueRuleRequest } from "@medbrains/types";

export function CriticalValueRulesSettings() {
  const canManage = useHasPermission(P.ADMIN.SETTINGS.GENERAL.MANAGE);
  const queryClient = useQueryClient();
  const [opened, setOpened] = useState(false);
  const [testCode, setTestCode] = useState("");
  const [testName, setTestName] = useState("");
  const [lowCritical, setLowCritical] = useState<number | string>("");
  const [highCritical, setHighCritical] = useState<number | string>("");
  const [unit, setUnit] = useState("");
  const [gender, setGender] = useState<string | null>(null);
  const [alertMessage, setAlertMessage] = useState("");

  const { data: rules = [] } = useQuery({
    queryKey: ["critical-value-rules"],
    queryFn: () => api.listCriticalValueRules(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateCriticalValueRuleRequest) => api.createCriticalValueRule(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["critical-value-rules"] });
      notifications.show({ title: "Created", message: "Critical value rule added", color: "success" });
      handleClose();
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to create rule", color: "danger" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteCriticalValueRule(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["critical-value-rules"] });
      notifications.show({ title: "Deleted", message: "Rule removed", color: "warning" });
    },
  });

  const handleClose = () => {
    setOpened(false);
    setTestCode("");
    setTestName("");
    setLowCritical("");
    setHighCritical("");
    setUnit("");
    setGender(null);
    setAlertMessage("");
  };

  const handleCreate = () => {
    if (!testCode.trim() || !testName.trim() || !alertMessage.trim()) return;
    createMutation.mutate({
      test_code: testCode.trim(),
      test_name: testName.trim(),
      low_critical: typeof lowCritical === "number" ? lowCritical : undefined,
      high_critical: typeof highCritical === "number" ? highCritical : undefined,
      unit: unit.trim() || undefined,
      gender: gender ?? undefined,
      alert_message: alertMessage.trim(),
    });
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text fw={600}>Critical Value Rules ({rules.length})</Text>
        {canManage && (
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setOpened(true)}>
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
              <Table.Td><Text size="sm" fw={500}>{r.test_code}</Text></Table.Td>
              <Table.Td><Text size="sm">{r.test_name}</Text></Table.Td>
              <Table.Td><Text size="sm">{r.low_critical ?? "—"}</Text></Table.Td>
              <Table.Td><Text size="sm">{r.high_critical ?? "—"}</Text></Table.Td>
              <Table.Td><Text size="sm">{r.unit ?? "—"}</Text></Table.Td>
              <Table.Td><Text size="sm">{r.gender ?? "All"}</Text></Table.Td>
              <Table.Td><Text size="xs" lineClamp={1}>{r.alert_message}</Text></Table.Td>
              {canManage && (
                <Table.Td>
                  <ActionIcon variant="subtle" color="danger" size="sm" onClick={() => deleteMutation.mutate(r.id)} aria-label="Delete">
                    <IconTrash size={14} />
                  </ActionIcon>
                </Table.Td>
              )}
            </Table.Tr>
          ))}
          {rules.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={canManage ? 8 : 7}>
                <Text size="sm" c="dimmed" ta="center">No critical value rules configured</Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>

      <Modal opened={opened} onClose={handleClose} title="Add Critical Value Rule" size="md">
        <Stack gap="sm">
          <Group grow>
            <TextInput label="Test Code" placeholder="e.g. K" value={testCode} onChange={(e) => setTestCode(e.currentTarget.value)} required />
            <TextInput label="Test Name" placeholder="e.g. Potassium" value={testName} onChange={(e) => setTestName(e.currentTarget.value)} required />
          </Group>
          <Group grow>
            <NumberInput label="Low Critical" placeholder="e.g. 2.5" value={lowCritical} onChange={setLowCritical} decimalScale={4} />
            <NumberInput label="High Critical" placeholder="e.g. 6.5" value={highCritical} onChange={setHighCritical} decimalScale={4} />
          </Group>
          <Group grow>
            <TextInput label="Unit" placeholder="e.g. mEq/L" value={unit} onChange={(e) => setUnit(e.currentTarget.value)} />
            <Select label="Gender" data={[{ value: "male", label: "Male" }, { value: "female", label: "Female" }]} value={gender} onChange={setGender} clearable placeholder="All" />
          </Group>
          <Textarea label="Alert Message" placeholder="Critical value alert text" value={alertMessage} onChange={(e) => setAlertMessage(e.currentTarget.value)} required autosize minRows={2} />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={handleClose}>Cancel</Button>
            <Button onClick={handleCreate} loading={createMutation.isPending} disabled={!testCode.trim() || !testName.trim() || !alertMessage.trim()}>
              Create
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
