import { useState } from "react";
import {
  Accordion,
  ActionIcon,
  Badge,
  Box,
  Button,
  Drawer,
  Grid,
  Group,
  JsonInput,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconEye,
  IconForms,
  IconGitBranch,
  IconLock,
  IconPencil,
  IconPencilCode,
  IconPlus,
  IconUpload,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { api } from "@medbrains/api";
import type {
  CreateFormRequest,
  FormDetailResponse,
  FormMaster,
  FormStatus,
  UpdateFormRequest,
} from "@medbrains/types";
import { DataTable } from "../../../components";

const statusColors: Record<string, string> = {
  draft: "slate",
  active: "success",
  deprecated: "orange",
};

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <Grid mb="xs">
      <Grid.Col span={4}>
        <Text size="sm" fw={500} c="dimmed">
          {label}
        </Text>
      </Grid.Col>
      <Grid.Col span={8}>
        <Text size="sm">{value || "-"}</Text>
      </Grid.Col>
    </Grid>
  );
}

function FormDetailDrawer({
  formId,
  opened,
  onClose,
  onEdit,
}: {
  formId: string | null;
  opened: boolean;
  onClose: () => void;
  onEdit: (form: FormDetailResponse) => void;
}) {
  const navigate = useNavigate();
  const { data: detail, isLoading } = useQuery({
    queryKey: ["admin-form-detail", formId],
    queryFn: () => api.adminGetFormDetail(formId!),
    enabled: !!formId,
  });

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title="Form Detail"
      position="right"
      size="xl"
      padding="md"
    >
      {isLoading && <Text c="dimmed">Loading...</Text>}
      {detail && (
        <Stack gap="md">
          <Group justify="space-between">
            <Box>
              <Text size="lg" fw={600}>
                {detail.name}
              </Text>
              <Text size="sm" c="dimmed">
                {detail.code}
              </Text>
            </Box>
            <Group gap="xs">
              <Badge
                color={statusColors[detail.status] ?? "slate"}
                variant="light"
                size="lg"
              >
                {detail.status}
              </Badge>
              <Badge variant="light" color="primary">
                v{detail.version}
              </Badge>
              <Tooltip label="Design in Form Builder">
                <ActionIcon
                  variant="light"
                  color="violet"
                  onClick={() => navigate(`/admin/form-builder/${detail.id}`)}
                  aria-label="Pencil Code"
                >
                  <IconPencilCode size={16} />
                </ActionIcon>
              </Tooltip>
              <ActionIcon
                variant="light"
                onClick={() => onEdit(detail)}
                aria-label="Edit"
              >
                <IconPencil size={16} />
              </ActionIcon>
            </Group>
          </Group>

          {detail.config && (
            <Box>
              <Text size="sm" fw={600} mb="xs">
                Config
              </Text>
              <JsonInput
                value={JSON.stringify(detail.config, null, 2)}
                readOnly
                minRows={4}
                maxRows={10}
                autosize
              />
            </Box>
          )}

          <Text size="sm" fw={600}>
            Sections & Fields ({detail.sections.length} sections)
          </Text>

          {detail.sections.length === 0 ? (
            <Text c="dimmed" size="sm">
              No sections configured.
            </Text>
          ) : (
            <Accordion variant="separated">
              {detail.sections.map((sec) => (
                <Accordion.Item key={sec.id} value={sec.id}>
                  <Accordion.Control>
                    <Group gap="xs">
                      <Text size="sm" fw={500}>
                        {sec.name}
                      </Text>
                      <Badge size="xs" variant="light">
                        {sec.fields.length} fields
                      </Badge>
                      <Text size="xs" c="dimmed">
                        {sec.code}
                      </Text>
                    </Group>
                  </Accordion.Control>
                  <Accordion.Panel>
                    {sec.fields.length === 0 ? (
                      <Text size="sm" c="dimmed">
                        No fields in this section.
                      </Text>
                    ) : (
                      <Table>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Code</Table.Th>
                            <Table.Th>Label</Table.Th>
                            <Table.Th>Type</Table.Th>
                            <Table.Th>Quick</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {sec.fields.map((f) => (
                            <Table.Tr key={f.ff_id}>
                              <Table.Td>
                                <Text size="xs" ff="monospace">
                                  {f.field_code}
                                </Text>
                              </Table.Td>
                              <Table.Td>
                                {f.label_override ?? f.field_name}
                              </Table.Td>
                              <Table.Td>
                                <Badge
                                  size="xs"
                                  variant="light"
                                  color="primary"
                                >
                                  {f.data_type}
                                </Badge>
                              </Table.Td>
                              <Table.Td>
                                {f.is_quick_mode ? "Yes" : "-"}
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    )}
                  </Accordion.Panel>
                </Accordion.Item>
              ))}
            </Accordion>
          )}

          {detail.module_links.length > 0 && (
            <Box>
              <Text size="sm" fw={600} mb="xs">
                Module Links
              </Text>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Module</Table.Th>
                    <Table.Th>Context</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {detail.module_links.map((ml) => (
                    <Table.Tr key={`${ml.module_code}-${ml.context}`}>
                      <Table.Td>{ml.module_code}</Table.Td>
                      <Table.Td>{ml.context}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Box>
          )}

          <DetailRow label="Created" value={detail.created_at} />
          <DetailRow label="Updated" value={detail.updated_at} />
        </Stack>
      )}
    </Drawer>
  );
}

function FormEditModal({
  opened,
  onClose,
  editingForm,
}: {
  opened: boolean;
  onClose: () => void;
  editingForm: FormDetailResponse | null;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!editingForm;

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<FormStatus>("draft");
  const [config, setConfig] = useState("");

  // Reset form when modal opens
  const handleOpen = () => {
    if (editingForm) {
      setCode(editingForm.code);
      setName(editingForm.name);
      setStatus(editingForm.status);
      setConfig(
        editingForm.config ? JSON.stringify(editingForm.config, null, 2) : "",
      );
    } else {
      setCode("");
      setName("");
      setStatus("draft");
      setConfig("");
    }
  };

  const createMutation = useMutation({
    mutationFn: (data: CreateFormRequest) => api.adminCreateForm(data),
    onSuccess: () => {
      notifications.show({
        title: "Form created",
        message: "New form has been created",
        color: "success",
      });
      void queryClient.invalidateQueries({ queryKey: ["admin-forms"] });
      onClose();
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Create failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateFormRequest) =>
      api.adminUpdateForm(editingForm!.id, data),
    onSuccess: () => {
      notifications.show({
        title: "Form updated",
        message: "Form has been updated",
        color: "success",
      });
      void queryClient.invalidateQueries({ queryKey: ["admin-forms"] });
      void queryClient.invalidateQueries({
        queryKey: ["admin-form-detail", editingForm?.id],
      });
      onClose();
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Update failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  const handleSubmit = () => {
    let parsedConfig: Record<string, unknown> | undefined;
    if (config.trim()) {
      try {
        parsedConfig = JSON.parse(config) as Record<string, unknown>;
      } catch {
        notifications.show({
          title: "Invalid JSON",
          message: "Config must be valid JSON",
          color: "danger",
        });
        return;
      }
    }

    if (isEdit) {
      updateMutation.mutate({ name, status, config: parsedConfig });
    } else {
      createMutation.mutate({ code, name, status, config: parsedConfig });
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEdit ? "Edit Form" : "New Form"}
      onTransitionEnd={handleOpen}
    >
      <Stack gap="sm">
        <TextInput
          label="Code"
          placeholder="patient_registration"
          value={code}
          onChange={(e) => setCode(e.currentTarget.value)}
          disabled={isEdit}
          required
        />
        <TextInput
          label="Name"
          placeholder="Patient Registration"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
        />
        <Select
          label="Status"
          data={[
            { value: "draft", label: "Draft" },
            { value: "active", label: "Active" },
            { value: "deprecated", label: "Deprecated" },
          ]}
          value={status}
          onChange={(v) => setStatus((v ?? "draft") as FormStatus)}
        />
        <JsonInput
          label="Config (JSON)"
          placeholder='{"activities": []}'
          value={config}
          onChange={setConfig}
          minRows={4}
          maxRows={10}
          autosize
          validationError="Invalid JSON"
        />
        <Group justify="flex-end" mt="md">
          <Button variant="light" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            loading={createMutation.isPending || updateMutation.isPending}
          >
            {isEdit ? "Save" : "Create"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export function FormMasterList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [drawerFormId, setDrawerFormId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingForm, setEditingForm] = useState<FormDetailResponse | null>(
    null,
  );

  // Publish modal state
  const [publishForm, setPublishForm] = useState<FormMaster | null>(null);
  const [publishSummary, setPublishSummary] = useState("");
  // New version modal state
  const [newVersionForm, setNewVersionForm] = useState<FormMaster | null>(null);

  const { data: forms, isLoading } = useQuery({
    queryKey: ["admin-forms"],
    queryFn: () => api.adminListForms(),
  });

  const publishMutation = useMutation({
    mutationFn: ({ id, summary }: { id: string; summary?: string }) =>
      api.adminPublishForm(id, { change_summary: summary }),
    onSuccess: () => {
      notifications.show({
        title: "Form published",
        message: "Form is now active and locked.",
        color: "success",
      });
      void queryClient.invalidateQueries({ queryKey: ["admin-forms"] });
      setPublishForm(null);
      setPublishSummary("");
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Publish failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  const newVersionMutation = useMutation({
    mutationFn: (id: string) => api.adminCreateNewVersion(id),
    onSuccess: () => {
      notifications.show({
        title: "New version created",
        message: "Form is now a draft. You can edit it.",
        color: "primary",
      });
      void queryClient.invalidateQueries({ queryKey: ["admin-forms"] });
      setNewVersionForm(null);
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  const openDetail = (form: FormMaster) => {
    setDrawerFormId(form.id);
    setDrawerOpen(true);
  };

  const openCreate = () => {
    setEditingForm(null);
    setModalOpen(true);
  };

  const openEdit = (detail: FormDetailResponse) => {
    setEditingForm(detail);
    setModalOpen(true);
  };

  const columns = [
    {
      key: "code",
      label: "Code",
      render: (row: FormMaster) => (
        <Text size="sm" ff="monospace">
          {row.code}
        </Text>
      ),
    },
    {
      key: "name",
      label: "Name",
      render: (row: FormMaster) => (
        <Group gap="xs">
          <Text size="sm">{row.name}</Text>
          {row.status === "active" && (
            <IconLock size={14} color="var(--mantine-color-green-6)" />
          )}
        </Group>
      ),
    },
    {
      key: "version",
      label: "Version",
      render: (row: FormMaster) => `v${row.version}`,
    },
    {
      key: "status",
      label: "Status",
      render: (row: FormMaster) => (
        <Badge
          color={statusColors[row.status] ?? "slate"}
          variant="light"
          size="sm"
        >
          {row.status}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row: FormMaster) => (
        <Group gap={4} wrap="nowrap">
          {row.status === "draft" && (
            <Tooltip label="Publish">
              <ActionIcon
                variant="subtle"
                color="success"
                onClick={() => setPublishForm(row)}
                aria-label="Upload"
              >
                <IconUpload size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          {row.status === "active" && (
            <Tooltip label="New Version">
              <ActionIcon
                variant="subtle"
                color="primary"
                onClick={() => setNewVersionForm(row)}
                aria-label="Git Branch"
              >
                <IconGitBranch size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          <Tooltip label="View details">
            <ActionIcon
              variant="subtle"
              color="primary"
              onClick={() => openDetail(row)}
              aria-label="View details"
            >
              <IconEye size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Design in Builder">
            <ActionIcon
              variant="subtle"
              color="violet"
              onClick={() => navigate(`/admin/form-builder/${row.id}`)}
              aria-label="Pencil Code"
            >
              <IconPencilCode size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      ),
    },
  ];

  return (
    <>
      <Group justify="space-between" mb="md">
        <Text size="sm" c="dimmed">
          All form definitions
        </Text>
        <Button
          size="sm"
          leftSection={<IconPlus size={14} />}
          onClick={openCreate}
        >
          New Form
        </Button>
      </Group>

      <DataTable<FormMaster>
        columns={columns}
        data={forms ?? []}
        loading={isLoading}
        rowKey={(row) => row.id}
        emptyIcon={<IconForms size={32} />}
        emptyTitle="No forms found"
        emptyDescription="Create your first form definition"
        emptyAction={{ label: "New Form", onClick: openCreate }}
      />

      <FormDetailDrawer
        formId={drawerFormId}
        opened={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onEdit={openEdit}
      />

      <FormEditModal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        editingForm={editingForm}
      />

      {/* Publish Modal */}
      <Modal
        opened={!!publishForm}
        onClose={() => setPublishForm(null)}
        title="Publish Form"
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">
            Publishing will make <strong>{publishForm?.name}</strong> active and
            locked. A snapshot of this version will be saved to history.
          </Text>
          <Textarea
            label="Change Summary (optional)"
            placeholder="Describe what changed in this version..."
            value={publishSummary}
            onChange={(e) => setPublishSummary(e.currentTarget.value)}
            minRows={2}
          />
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setPublishForm(null)}>
              Cancel
            </Button>
            <Button
              color="success"
              leftSection={<IconUpload size={14} />}
              loading={publishMutation.isPending}
              onClick={() => {
                if (publishForm) {
                  publishMutation.mutate({
                    id: publishForm.id,
                    summary: publishSummary || undefined,
                  });
                }
              }}
            >
              Publish
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* New Version Modal */}
      <Modal
        opened={!!newVersionForm}
        onClose={() => setNewVersionForm(null)}
        title="Create New Version"
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">
            This will create a new draft version of{" "}
            <strong>{newVersionForm?.name}</strong> (v
            {(newVersionForm?.version ?? 0) + 1}). The current active version
            will be preserved in history.
          </Text>
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setNewVersionForm(null)}>
              Cancel
            </Button>
            <Button
              color="primary"
              leftSection={<IconGitBranch size={14} />}
              loading={newVersionMutation.isPending}
              onClick={() => {
                if (newVersionForm) {
                  newVersionMutation.mutate(newVersionForm.id);
                }
              }}
            >
              Create Draft
            </Button>
          </Group>
        </Stack>
      </Modal>

    </>
  );
}
