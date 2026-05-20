import { zodResolver } from "@hookform/resolvers/zod";
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
  Textarea,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  type ConsultationTemplateSettingsFormInput,
  consultationTemplateSettingsFormSchema,
} from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { clinicalTemplatesService } from "../../../services/clinicalTemplates.service";
import { settingsSetupService } from "../../../services/settingsSetup.service";

const EMPTY_FORM: ConsultationTemplateSettingsFormInput = {
  name: "",
  description: "",
  specialty: "",
  department_id: null,
  is_shared: false,
  chief_complaints: "",
  default_plan: "",
  common_diagnoses: "",
};

function splitCommaList(value: string): string[] | undefined {
  const values = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return values.length > 0 ? values : undefined;
}

function formToPayload(form: ConsultationTemplateSettingsFormInput) {
  return {
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    specialty: form.specialty.trim() || undefined,
    department_id: form.department_id || undefined,
    is_shared: form.is_shared,
    chief_complaints: splitCommaList(form.chief_complaints),
    default_plan: form.default_plan.trim() || undefined,
    common_diagnoses: splitCommaList(form.common_diagnoses),
  };
}

export function ConsultationTemplatesSettings() {
  const queryClient = useQueryClient();
  const canCreate = useHasPermission(P.OPD.VISIT_CREATE);
  const canDelete = useHasPermission(P.OPD.VISIT_UPDATE);

  const [modalOpen, setModalOpen] = useState(false);
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<ConsultationTemplateSettingsFormInput>({
    resolver: zodResolver(consultationTemplateSettingsFormSchema),
    defaultValues: EMPTY_FORM,
  });

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["consultation-templates"],
    queryFn: () => clinicalTemplatesService.listConsultationTemplates(),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => settingsSetupService.listDepartments(),
    staleTime: 600_000,
  });

  const deptOptions = departments.map((d) => ({
    value: d.id,
    label: d.name,
  }));

  const createMutation = useMutation({
    mutationFn: (data: ReturnType<typeof formToPayload>) =>
      clinicalTemplatesService.createConsultationTemplate(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["consultation-templates"] });
      notifications.show({
        title: "Created",
        message: "Consultation template created.",
        color: "success",
      });
      setModalOpen(false);
      reset(EMPTY_FORM);
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
    mutationFn: (id: string) => clinicalTemplatesService.deleteConsultationTemplate(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["consultation-templates"] });
      notifications.show({
        title: "Deleted",
        message: "Template removed.",
        color: "success",
      });
    },
  });

  const submitTemplate = handleSubmit((form) => {
    createMutation.mutate(formToPayload(form));
  });

  const getDeptName = (id: string | null) => {
    if (!id) return "—";
    const d = departments.find((dept) => dept.id === id);
    return d?.name ?? "—";
  };

  const openCreateModal = () => {
    reset(EMPTY_FORM);
    setModalOpen(true);
  };

  const closeCreateModal = () => {
    reset(EMPTY_FORM);
    setModalOpen(false);
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text fw={600}>Consultation Templates</Text>
        {canCreate && (
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={openCreateModal}>
            Add Template
          </Button>
        )}
      </Group>

      {isLoading ? (
        <Text size="sm" c="dimmed">
          Loading...
        </Text>
      ) : templates.length === 0 ? (
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
            {templates.map((tmpl) => (
              <Table.Tr key={tmpl.id}>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {tmpl.name}
                  </Text>
                  {tmpl.description && (
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {tmpl.description}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{tmpl.specialty ?? "—"}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{getDeptName(tmpl.department_id)}</Text>
                </Table.Td>
                <Table.Td>
                  <Badge color={tmpl.is_shared ? "success" : "slate"} variant="light" size="sm">
                    {tmpl.is_shared ? "Shared" : "Private"}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap={4} wrap="wrap">
                    {tmpl.chief_complaints.slice(0, 3).map((cc) => (
                      <Badge key={cc} size="xs" variant="dot">
                        {cc}
                      </Badge>
                    ))}
                    {tmpl.chief_complaints.length > 3 && (
                      <Text size="xs" c="dimmed">
                        +{tmpl.chief_complaints.length - 3}
                      </Text>
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
        onClose={closeCreateModal}
        title="Create Consultation Template"
        size="lg"
      >
        <Stack gap="sm">
          <TextInput
            label="Template Name"
            placeholder="e.g., General Medicine OPD"
            error={errors.name?.message}
            {...register("name")}
            required
          />
          <Textarea
            label="Description"
            placeholder="Optional description"
            error={errors.description?.message}
            {...register("description")}
            minRows={2}
          />
          <Group grow>
            <TextInput
              label="Specialty"
              placeholder="e.g., Cardiology"
              error={errors.specialty?.message}
              {...register("specialty")}
            />
            <Controller
              control={control}
              name="department_id"
              render={({ field }) => (
                <Select
                  label="Department"
                  placeholder="Select department"
                  data={deptOptions}
                  value={field.value}
                  onChange={field.onChange}
                  clearable
                  searchable
                />
              )}
            />
          </Group>
          <Controller
            control={control}
            name="is_shared"
            render={({ field }) => (
              <Switch
                label="Share with all doctors"
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
              />
            )}
          />
          <TextInput
            label="Chief Complaints (comma-separated)"
            placeholder="Fever, Headache, Cough"
            error={errors.chief_complaints?.message}
            {...register("chief_complaints")}
          />
          <Textarea
            label="Default Plan"
            placeholder="Treatment plan template"
            error={errors.default_plan?.message}
            {...register("default_plan")}
            minRows={2}
          />
          <TextInput
            label="Common Diagnoses (comma-separated)"
            placeholder="J06.9, J18.9"
            error={errors.common_diagnoses?.message}
            {...register("common_diagnoses")}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={closeCreateModal}>
              Cancel
            </Button>
            <Button onClick={() => void submitTemplate()} loading={createMutation.isPending}>
              Create Template
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
