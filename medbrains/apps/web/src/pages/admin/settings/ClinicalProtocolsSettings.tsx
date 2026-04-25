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
import type { ClinicalProtocol, CreateClinicalProtocolRequest } from "@medbrains/types";

const CATEGORIES = [
  { value: "sepsis", label: "Sepsis Bundle" },
  { value: "dvt_prophylaxis", label: "DVT Prophylaxis" },
  { value: "diabetes", label: "Diabetes Management" },
  { value: "hypertension", label: "Hypertension" },
  { value: "cardiac", label: "Cardiac" },
  { value: "respiratory", label: "Respiratory" },
  { value: "renal", label: "Renal" },
  { value: "infection", label: "Infection Control" },
  { value: "surgical", label: "Surgical" },
  { value: "other", label: "Other" },
];

export function ClinicalProtocolsSettings() {
  const canManage = useHasPermission(P.ADMIN.SETTINGS.GENERAL.MANAGE);
  const queryClient = useQueryClient();
  const [opened, setOpened] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [category, setCategory] = useState<string | null>("other");
  const [description, setDescription] = useState("");

  const { data: protocols = [] } = useQuery({
    queryKey: ["clinical-protocols"],
    queryFn: () => api.listClinicalProtocols(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateClinicalProtocolRequest) => api.createClinicalProtocol(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["clinical-protocols"] });
      notifications.show({ title: "Created", message: "Clinical protocol added", color: "success" });
      handleClose();
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to create protocol", color: "danger" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteClinicalProtocol(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["clinical-protocols"] });
      notifications.show({ title: "Deleted", message: "Protocol removed", color: "warning" });
    },
  });

  const handleClose = () => {
    setOpened(false);
    setName("");
    setCode("");
    setCategory("other");
    setDescription("");
  };

  const handleCreate = () => {
    if (!name.trim() || !category) return;
    createMutation.mutate({
      name: name.trim(),
      code: code.trim() || undefined,
      category,
      description: description.trim() || undefined,
    });
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text fw={600}>Clinical Protocols ({protocols.length})</Text>
        {canManage && (
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setOpened(true)}>
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
              <Table.Td><Text size="sm" fw={500}>{p.name}</Text></Table.Td>
              <Table.Td><Text size="sm" c="dimmed">{p.code ?? "—"}</Text></Table.Td>
              <Table.Td>
                <Badge size="sm" variant="light">{p.category}</Badge>
              </Table.Td>
              <Table.Td><Text size="xs" lineClamp={2}>{p.description ?? "—"}</Text></Table.Td>
              {canManage && (
                <Table.Td>
                  <ActionIcon variant="subtle" color="danger" size="sm" onClick={() => deleteMutation.mutate(p.id)} aria-label="Delete">
                    <IconTrash size={14} />
                  </ActionIcon>
                </Table.Td>
              )}
            </Table.Tr>
          ))}
          {protocols.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={canManage ? 5 : 4}>
                <Text size="sm" c="dimmed" ta="center">No clinical protocols configured</Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>

      <Modal opened={opened} onClose={handleClose} title="Add Clinical Protocol" size="md">
        <Stack gap="sm">
          <TextInput label="Protocol Name" placeholder="e.g. Sepsis Bundle 1-Hour" value={name} onChange={(e) => setName(e.currentTarget.value)} required />
          <Group grow>
            <TextInput label="Code" placeholder="Optional identifier" value={code} onChange={(e) => setCode(e.currentTarget.value)} />
            <Select label="Category" data={CATEGORIES} value={category} onChange={setCategory} required />
          </Group>
          <Textarea label="Description" placeholder="Protocol description" value={description} onChange={(e) => setDescription(e.currentTarget.value)} autosize minRows={3} />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={handleClose}>Cancel</Button>
            <Button onClick={handleCreate} loading={createMutation.isPending} disabled={!name.trim() || !category}>
              Create
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
