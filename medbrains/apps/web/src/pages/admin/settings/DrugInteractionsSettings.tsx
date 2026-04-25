import { useState } from "react";
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
  TextInput,
  Textarea,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import type { DrugInteraction, CreateDrugInteractionRequest } from "@medbrains/types";

const SEVERITY_COLORS: Record<string, string> = {
  minor: "warning",
  moderate: "orange",
  major: "danger",
  contraindicated: "violet",
};

export function DrugInteractionsSettings() {
  const canManage = useHasPermission(P.ADMIN.SETTINGS.GENERAL.MANAGE);
  const queryClient = useQueryClient();
  const [opened, setOpened] = useState(false);
  const [drugA, setDrugA] = useState("");
  const [drugB, setDrugB] = useState("");
  const [severity, setSeverity] = useState<string | null>("moderate");
  const [description, setDescription] = useState("");
  const [mechanism, setMechanism] = useState("");
  const [management, setManagement] = useState("");

  const { data: interactions = [] } = useQuery({
    queryKey: ["drug-interactions"],
    queryFn: () => api.listDrugInteractions(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateDrugInteractionRequest) => api.createDrugInteraction(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["drug-interactions"] });
      notifications.show({ title: "Created", message: "Drug interaction rule added", color: "success" });
      handleClose();
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to create interaction rule", color: "danger" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteDrugInteraction(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["drug-interactions"] });
      notifications.show({ title: "Deleted", message: "Interaction rule removed", color: "warning" });
    },
  });

  const handleClose = () => {
    setOpened(false);
    setDrugA("");
    setDrugB("");
    setSeverity("moderate");
    setDescription("");
    setMechanism("");
    setManagement("");
  };

  const handleCreate = () => {
    if (!drugA.trim() || !drugB.trim() || !severity || !description.trim()) return;
    createMutation.mutate({
      drug_a_name: drugA.trim(),
      drug_b_name: drugB.trim(),
      severity: severity as CreateDrugInteractionRequest["severity"],
      description: description.trim(),
      mechanism: mechanism.trim() || undefined,
      management: management.trim() || undefined,
    });
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text fw={600}>Drug Interaction Rules ({interactions.length})</Text>
        {canManage && (
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setOpened(true)}>
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
              <Table.Td><Text size="sm" fw={500}>{row.drug_a_name}</Text></Table.Td>
              <Table.Td><Text size="sm" fw={500}>{row.drug_b_name}</Text></Table.Td>
              <Table.Td>
                <Badge size="sm" color={SEVERITY_COLORS[row.severity] ?? "slate"}>{row.severity}</Badge>
              </Table.Td>
              <Table.Td><Text size="xs" lineClamp={2}>{row.description}</Text></Table.Td>
              <Table.Td><Text size="xs" c="dimmed" lineClamp={1}>{row.management ?? "—"}</Text></Table.Td>
              {canManage && (
                <Table.Td>
                  <ActionIcon variant="subtle" color="danger" size="sm" onClick={() => deleteMutation.mutate(row.id)} aria-label="Delete">
                    <IconTrash size={14} />
                  </ActionIcon>
                </Table.Td>
              )}
            </Table.Tr>
          ))}
          {interactions.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={canManage ? 6 : 5}>
                <Text size="sm" c="dimmed" ta="center">No drug interaction rules configured</Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>

      <Modal opened={opened} onClose={handleClose} title="Add Drug Interaction Rule" size="md">
        <Stack gap="sm">
          <TextInput label="Drug A" placeholder="e.g. Warfarin" value={drugA} onChange={(e) => setDrugA(e.currentTarget.value)} required />
          <TextInput label="Drug B" placeholder="e.g. Aspirin" value={drugB} onChange={(e) => setDrugB(e.currentTarget.value)} required />
          <Select
            label="Severity"
            data={[
              { value: "minor", label: "Minor" },
              { value: "moderate", label: "Moderate" },
              { value: "major", label: "Major" },
              { value: "contraindicated", label: "Contraindicated" },
            ]}
            value={severity}
            onChange={setSeverity}
            required
          />
          <Textarea label="Description" placeholder="Describe the interaction" value={description} onChange={(e) => setDescription(e.currentTarget.value)} required autosize minRows={2} />
          <TextInput label="Mechanism" placeholder="Optional" value={mechanism} onChange={(e) => setMechanism(e.currentTarget.value)} />
          <Textarea label="Management" placeholder="How to manage this interaction" value={management} onChange={(e) => setManagement(e.currentTarget.value)} autosize minRows={2} />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={handleClose}>Cancel</Button>
            <Button onClick={handleCreate} loading={createMutation.isPending} disabled={!drugA.trim() || !drugB.trim() || !severity || !description.trim()}>
              Create
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
