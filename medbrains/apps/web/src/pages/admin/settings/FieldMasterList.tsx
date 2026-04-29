import { useState } from "react";
import {
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
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconCheck,
  IconDatabase,
  IconEye,
  IconPencil,
  IconPlus,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import type {
  CreateFieldRequest,
  FieldDataType,
  FieldDetailResponse,
  FieldMasterFull,
  UpdateFieldRequest,
} from "@medbrains/types";
import { DataTable } from "../../../components";

const dataTypeColors: Record<string, string> = {
  text: "primary",
  email: "info",
  phone: "teal",
  date: "violet",
  datetime: "violet",
  time: "violet",
  select: "violet",
  multiselect: "violet",
  checkbox: "orange",
  radio: "orange",
  textarea: "primary",
  number: "success",
  decimal: "success",
  file: "warning",
  hidden: "slate",
  computed: "danger",
  boolean: "orange",
  uuid_fk: "primary",
  json: "danger",
};

const requirementColors: Record<string, string> = {
  mandatory: "danger",
  conditional: "orange",
  recommended: "warning",
  optional: "slate",
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

function FieldDetailDrawer({
  fieldId,
  opened,
  onClose,
  onEdit,
}: {
  fieldId: string | null;
  opened: boolean;
  onClose: () => void;
  onEdit: (detail: FieldDetailResponse) => void;
}) {
  const { data: detail, isLoading } = useQuery({
    queryKey: ["admin-field-detail", fieldId],
    queryFn: () => api.adminGetFieldDetail(fieldId!),
    enabled: !!fieldId,
  });

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title="Field Detail"
      position="right"
      size="lg"
      padding="md"
    >
      {isLoading && <Text c="dimmed">Loading...</Text>}
      {detail && (
        <Stack gap="md">
          <Group justify="space-between">
            <Box>
              <Text size="lg" fw={600}>
                {detail.field.name}
              </Text>
              <Text size="sm" c="dimmed" ff="monospace">
                {detail.field.code}
              </Text>
            </Box>
            <Group gap="xs">
              <Badge
                color={dataTypeColors[detail.field.data_type] ?? "slate"}
                variant="light"
              >
                {detail.field.data_type}
              </Badge>
              {detail.field.is_system && (
                <Badge color="danger" variant="light">
                  System
                </Badge>
              )}
              {!detail.field.is_system && (
                <ActionIcon
                  variant="light"
                  onClick={() => onEdit(detail)}
                  aria-label="Edit"
                >
                  <IconPencil size={16} />
                </ActionIcon>
              )}
            </Group>
          </Group>

          <DetailRow label="Description" value={detail.field.description} />
          <DetailRow label="Default Value" value={detail.field.default_value} />
          <DetailRow label="Placeholder" value={detail.field.placeholder} />
          <DetailRow label="UI Component" value={detail.field.ui_component} />
          <DetailRow label="UI Width" value={detail.field.ui_width} />
          <DetailRow label="FHIR Path" value={detail.field.fhir_path} />
          <DetailRow label="DB Table" value={detail.field.db_table} />
          <DetailRow label="DB Column" value={detail.field.db_column} />
          <DetailRow
            label="Active"
            value={detail.field.is_active ? "Yes" : "No"}
          />

          {detail.field.validation && (
            <Box>
              <Text size="sm" fw={600} mb="xs">
                Validation
              </Text>
              <JsonInput
                value={JSON.stringify(detail.field.validation, null, 2)}
                readOnly
                minRows={3}
                maxRows={8}
                autosize
              />
            </Box>
          )}

          {detail.field.condition && (
            <Box>
              <Text size="sm" fw={600} mb="xs">
                Condition
              </Text>
              <JsonInput
                value={JSON.stringify(detail.field.condition, null, 2)}
                readOnly
                minRows={3}
                maxRows={8}
                autosize
              />
            </Box>
          )}

          {detail.regulatory_links.length > 0 && (
            <Box>
              <Text size="sm" fw={600} mb="xs">
                Regulatory Links
              </Text>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Body</Table.Th>
                    <Table.Th>Requirement</Table.Th>
                    <Table.Th>Clause</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {detail.regulatory_links.map((rl) => (
                    <Table.Tr key={rl.id}>
                      <Table.Td>
                        <Text size="sm">{rl.body_name}</Text>
                        <Text size="xs" c="dimmed">
                          {rl.body_code}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          size="xs"
                          color={
                            requirementColors[rl.requirement_level] ?? "slate"
                          }
                          variant="light"
                        >
                          {rl.requirement_level}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs">
                          {rl.clause_code ?? rl.clause_reference ?? "-"}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Box>
          )}
        </Stack>
      )}
    </Drawer>
  );
}

function FieldEditModal({
  opened,
  onClose,
  editingField,
}: {
  opened: boolean;
  onClose: () => void;
  editingField: FieldDetailResponse | null;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!editingField;

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dataType, setDataType] = useState<FieldDataType>("text");
  const [defaultValue, setDefaultValue] = useState("");
  const [placeholder, setPlaceholder] = useState("");
  const [uiComponent, setUiComponent] = useState("");
  const [uiWidth, setUiWidth] = useState("half");
  const [validation, setValidation] = useState("");

  const handleOpen = () => {
    if (editingField) {
      setCode(editingField.field.code);
      setName(editingField.field.name);
      setDescription(editingField.field.description ?? "");
      setDataType(editingField.field.data_type);
      setDefaultValue(editingField.field.default_value ?? "");
      setPlaceholder(editingField.field.placeholder ?? "");
      setUiComponent(editingField.field.ui_component ?? "");
      setUiWidth(editingField.field.ui_width ?? "half");
      setValidation(
        editingField.field.validation
          ? JSON.stringify(editingField.field.validation, null, 2)
          : "",
      );
    } else {
      setCode("");
      setName("");
      setDescription("");
      setDataType("text");
      setDefaultValue("");
      setPlaceholder("");
      setUiComponent("");
      setUiWidth("half");
      setValidation("");
    }
  };

  const createMutation = useMutation({
    mutationFn: (data: CreateFieldRequest) => api.adminCreateField(data),
    onSuccess: () => {
      notifications.show({
        title: "Field created",
        message: "New field has been created",
        color: "success",
      });
      void queryClient.invalidateQueries({ queryKey: ["admin-fields"] });
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
    mutationFn: (data: UpdateFieldRequest) =>
      api.adminUpdateField(editingField!.field.id, data),
    onSuccess: () => {
      notifications.show({
        title: "Field updated",
        message: "Field has been updated",
        color: "success",
      });
      void queryClient.invalidateQueries({ queryKey: ["admin-fields"] });
      void queryClient.invalidateQueries({
        queryKey: ["admin-field-detail", editingField?.field.id],
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
    let parsedValidation: Record<string, unknown> | undefined;
    if (validation.trim()) {
      try {
        parsedValidation = JSON.parse(validation) as Record<string, unknown>;
      } catch {
        notifications.show({
          title: "Invalid JSON",
          message: "Validation must be valid JSON",
          color: "danger",
        });
        return;
      }
    }

    if (isEdit) {
      updateMutation.mutate({
        name: name || undefined,
        description: description || undefined,
        default_value: defaultValue || undefined,
        placeholder: placeholder || undefined,
        ui_component: uiComponent || undefined,
        ui_width: uiWidth || undefined,
        validation: parsedValidation,
      });
    } else {
      createMutation.mutate({
        code,
        name,
        description: description || undefined,
        data_type: dataType,
        default_value: defaultValue || undefined,
        placeholder: placeholder || undefined,
        ui_component: uiComponent || undefined,
        ui_width: uiWidth || undefined,
        validation: parsedValidation,
      });
    }
  };

  const dataTypeOptions = [
    "text",
    "email",
    "phone",
    "date",
    "datetime",
    "time",
    "select",
    "multiselect",
    "checkbox",
    "radio",
    "textarea",
    "number",
    "decimal",
    "file",
    "hidden",
    "computed",
    "boolean",
    "uuid_fk",
    "json",
  ].map((v) => ({ value: v, label: v }));

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEdit ? "Edit Field" : "New Field"}
      size="lg"
      onTransitionEnd={handleOpen}
    >
      <Stack gap="sm">
        <TextInput
          label="Code"
          placeholder="patient.first_name"
          value={code}
          onChange={(e) => setCode(e.currentTarget.value)}
          disabled={isEdit}
          required
        />
        <TextInput
          label="Name"
          placeholder="First Name"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
        />
        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
          minRows={2}
        />
        <Select
          label="Data Type"
          data={dataTypeOptions}
          value={dataType}
          onChange={(v) => setDataType((v ?? "text") as FieldDataType)}
          disabled={isEdit}
        />
        <Group grow>
          <TextInput
            label="Default Value"
            value={defaultValue}
            onChange={(e) => setDefaultValue(e.currentTarget.value)}
          />
          <TextInput
            label="Placeholder"
            value={placeholder}
            onChange={(e) => setPlaceholder(e.currentTarget.value)}
          />
        </Group>
        <Group grow>
          <TextInput
            label="UI Component"
            value={uiComponent}
            onChange={(e) => setUiComponent(e.currentTarget.value)}
          />
          <Select
            label="UI Width"
            data={[
              { value: "full", label: "Full" },
              { value: "half", label: "Half" },
              { value: "third", label: "Third" },
              { value: "quarter", label: "Quarter" },
            ]}
            value={uiWidth}
            onChange={(v) => setUiWidth(v ?? "half")}
          />
        </Group>
        <JsonInput
          label="Validation (JSON)"
          value={validation}
          onChange={setValidation}
          minRows={3}
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

export function FieldMasterList() {
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [drawerFieldId, setDrawerFieldId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingField, setEditingField] =
    useState<FieldDetailResponse | null>(null);

  const { data: fields, isLoading } = useQuery({
    queryKey: ["admin-fields", debouncedSearch],
    queryFn: () => api.adminListFields(debouncedSearch || undefined),
  });

  const openDetail = (field: FieldMasterFull) => {
    setDrawerFieldId(field.id);
    setDrawerOpen(true);
  };

  const openCreate = () => {
    setEditingField(null);
    setModalOpen(true);
  };

  const openEdit = (detail: FieldDetailResponse) => {
    setEditingField(detail);
    setModalOpen(true);
  };

  const columns = [
    {
      key: "code",
      label: "Code",
      render: (row: FieldMasterFull) => (
        <Text size="sm" ff="monospace">
          {row.code}
        </Text>
      ),
    },
    {
      key: "name",
      label: "Name",
      render: (row: FieldMasterFull) => row.name,
    },
    {
      key: "data_type",
      label: "Type",
      render: (row: FieldMasterFull) => (
        <Badge
          color={dataTypeColors[row.data_type] ?? "slate"}
          variant="light"
          size="sm"
        >
          {row.data_type}
        </Badge>
      ),
    },
    {
      key: "db_table",
      label: "DB Table",
      render: (row: FieldMasterFull) => (
        <Text size="xs" c="dimmed">
          {row.db_table ?? "-"}
        </Text>
      ),
    },
    {
      key: "system",
      label: "System",
      render: (row: FieldMasterFull) =>
        row.is_system ? (
          <IconCheck size={14} color="var(--mantine-color-green-6)" />
        ) : null,
    },
    {
      key: "active",
      label: "Active",
      render: (row: FieldMasterFull) =>
        row.is_active ? (
          <IconCheck size={14} color="var(--mantine-color-green-6)" />
        ) : (
          <IconX size={14} color="var(--mantine-color-red-6)" />
        ),
    },
    {
      key: "actions",
      label: "",
      render: (row: FieldMasterFull) => (
        <Group gap={4} wrap="nowrap">
          <ActionIcon
            variant="subtle"
            color="primary"
            onClick={() => openDetail(row)}
            aria-label="View details"
          >
            <IconEye size={16} />
          </ActionIcon>
        </Group>
      ),
    },
  ];

  return (
    <>
      <Group justify="space-between" mb="md">
        <TextInput
          placeholder="Search fields..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          style={{ flex: 1, maxWidth: 400 }}
        />
        <Button
          size="sm"
          leftSection={<IconPlus size={14} />}
          onClick={openCreate}
        >
          New Field
        </Button>
      </Group>

      <DataTable<FieldMasterFull>
        columns={columns}
        data={fields ?? []}
        loading={isLoading}
        rowKey={(row) => row.id}
        emptyIcon={<IconDatabase size={32} />}
        emptyTitle="No fields found"
        emptyDescription={
          debouncedSearch
            ? "Try adjusting your search"
            : "No field masters configured"
        }
      />

      <FieldDetailDrawer
        fieldId={drawerFieldId}
        opened={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onEdit={openEdit}
      />

      <FieldEditModal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        editingField={editingField}
      />

    </>
  );
}
