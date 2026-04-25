import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  Select,
  Stack,
  Switch,
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
import type {
  ConsultationTemplate,
  CreateConsultationTemplateRequest,
  DepartmentRow,
} from "@medbrains/types";

type FormState = {
  name: string;
  description: string;
  specialty: string;
  department_id: string;
  is_shared: boolean;
  chief_complaints: string;
  default_plan: string;
  common_diagnoses: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  specialty: "",
  department_id: "",
  is_shared: false,
  chief_complaints: "",
  default_plan: "",
  common_diagnoses: "",
};

export function ConsultationTemplatesSettings() {
  const queryClient = useQueryClient();
  const canCreate = useHasPermission(P.OPD.VISIT_CREATE);
  const canDelete = useHasPermission(P.OPD.VISIT_UPDATE);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["consultation-templates"],
    queryFn: () => api.listConsultationTemplates(),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => api.listDepartments(),
    staleTime: 600_000,
  });

  const deptOptions = (departments as DepartmentRow[]).map((d) => ({
    value: d.id,
    label: d.name,
  }));

  const createMutation = useMutation({
    mutationFn: (data: CreateConsultationTemplateRequest) =>
      api.createConsultationTemplate(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["consultation-templates"] });
      notifications.show({
        title: "Created",
        message: "Consultation template created.",
        color: "success",
      });
      setModalOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Error",
        message: err.message,
        color: "danger",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteConsultationTemplate(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["consultation-templates"] });
      notifications.show({
        title: "Deleted",
        message: "Template removed.",
        color: "success",
      });
    },
  });

  const handleSubmit = () => {
    const data: CreateConsultationTemplateRequest = {
      name: form.name,
      description: form.description || undefined,
      specialty: form.specialty || undefined,
      department_id: form.department_id || undefined,
      is_shared: form.is_shared,
      chief_complaints: form.chief_complaints
        ? form.chief_complaints.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined,
      default_plan: form.default_plan || undefined,
      common_diagnoses: form.common_diagnoses
        ? form.common_diagnoses.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined,
    };
    createMutation.mutate(data);
  };

  const getDeptName = (id: string | null) => {
    if (!id) return "—";
    const d = (departments as DepartmentRow[]).find((dept) => dept.id === id);
    return d?.name ?? "—";
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text fw={600}>Consultation Templates</Text>
        {canCreate && (
          <Button
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => {
              setForm(EMPTY_FORM);
              setModalOpen(true);
            }}
          >
            Add Template
          </Button>
        )}
      </Group>

      {isLoading ? (
        <Text size="sm" c="dimmed">Loading...</Text>
      ) : (templates as ConsultationTemplate[]).length === 0 ? (
        <Text size="sm" c="dimmed" ta="center" py="lg">
          No consultation templates configured yet.
        </Text>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Specialty</Table.Th>
              <Table.Th>Department</Table.Th>
              <Table.Th>Shared</Table.Th>
              <Table.Th>Complaints</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(templates as ConsultationTemplate[]).map((tmpl) => (
              <Table.Tr key={tmpl.id}>
                <Table.Td>
                  <Text size="sm" fw={500}>{tmpl.name}</Text>
                  {tmpl.description && (
                    <Text size="xs" c="dimmed" lineClamp={1}>{tmpl.description}</Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{tmpl.specialty ?? "—"}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{getDeptName(tmpl.department_id)}</Text>
                </Table.Td>
                <Table.Td>
                  <Badge
                    color={tmpl.is_shared ? "success" : "slate"}
                    variant="light"
                    size="sm"
                  >
                    {tmpl.is_shared ? "Shared" : "Private"}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap={4} wrap="wrap">
                    {tmpl.chief_complaints.slice(0, 3).map((cc) => (
                      <Badge key={cc} size="xs" variant="dot">{cc}</Badge>
                    ))}
                    {tmpl.chief_complaints.length > 3 && (
                      <Text size="xs" c="dimmed">+{tmpl.chief_complaints.length - 3}</Text>
                    )}
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    {canDelete && (
                      <ActionIcon
                        variant="subtle"
                        color="danger"
                        title="Delete"
                        onClick={() => deleteMutation.mutate(tmpl.id)}
                        aria-label="Delete"
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create Consultation Template"
        size="lg"
      >
        <Stack gap="sm">
          <TextInput
            label="Template Name"
            placeholder="e.g., General Medicine OPD"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.currentTarget.value })}
            required
          />
          <Textarea
            label="Description"
            placeholder="Optional description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.currentTarget.value })}
            minRows={2}
          />
          <Group grow>
            <TextInput
              label="Specialty"
              placeholder="e.g., Cardiology"
              value={form.specialty}
              onChange={(e) => setForm({ ...form, specialty: e.currentTarget.value })}
            />
            <Select
              label="Department"
              placeholder="Select department"
              data={deptOptions}
              value={form.department_id || null}
              onChange={(v) => setForm({ ...form, department_id: v ?? "" })}
              clearable
              searchable
            />
          </Group>
          <Switch
            label="Share with all doctors"
            checked={form.is_shared}
            onChange={(e) => setForm({ ...form, is_shared: e.currentTarget.checked })}
          />
          <TextInput
            label="Chief Complaints (comma-separated)"
            placeholder="Fever, Headache, Cough"
            value={form.chief_complaints}
            onChange={(e) => setForm({ ...form, chief_complaints: e.currentTarget.value })}
          />
          <Textarea
            label="Default Plan"
            placeholder="Treatment plan template"
            value={form.default_plan}
            onChange={(e) => setForm({ ...form, default_plan: e.currentTarget.value })}
            minRows={2}
          />
          <TextInput
            label="Common Diagnoses (comma-separated)"
            placeholder="J06.9, J18.9"
            value={form.common_diagnoses}
            onChange={(e) => setForm({ ...form, common_diagnoses: e.currentTarget.value })}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              loading={createMutation.isPending}
              disabled={!form.name}
            >
              Create Template
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
