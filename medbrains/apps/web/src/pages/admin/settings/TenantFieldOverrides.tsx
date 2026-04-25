import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  JsonInput,
  Modal,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconCheck,
  IconPencil,
  IconPlus,
  IconShield,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import type {
  FieldMasterFull,
  RequirementLevel,
  TenantFieldOverrideRow,
} from "@medbrains/types";
import { DataTable } from "../../../components";

const requirementColors: Record<string, string> = {
  mandatory: "danger",
  conditional: "orange",
  recommended: "warning",
  optional: "slate",
};

function OverrideEditModal({
  opened,
  onClose,
  editingOverride,
  fields,
}: {
  opened: boolean;
  onClose: () => void;
  editingOverride: TenantFieldOverrideRow | null;
  fields: FieldMasterFull[];
}) {
  const queryClient = useQueryClient();
  const isEdit = !!editingOverride;

  const [fieldCode, setFieldCode] = useState<string | null>(null);
  const [labelOverride, setLabelOverride] = useState("");
  const [requirementOverride, setRequirementOverride] =
    useState<RequirementLevel | null>(null);
  const [isHidden, setIsHidden] = useState(false);
  const [validationOverride, setValidationOverride] = useState("");

  const handleOpen = () => {
    if (editingOverride) {
      setFieldCode(editingOverride.field_code);
      setLabelOverride(editingOverride.label_override ?? "");
      setRequirementOverride(editingOverride.requirement_override);
      setIsHidden(editingOverride.is_hidden);
      setValidationOverride(
        editingOverride.validation_override
          ? JSON.stringify(editingOverride.validation_override, null, 2)
          : "",
      );
    } else {
      setFieldCode(null);
      setLabelOverride("");
      setRequirementOverride(null);
      setIsHidden(false);
      setValidationOverride("");
    }
  };

  const upsertMutation = useMutation({
    mutationFn: (data: {
      code: string;
      body: {
        label_override?: string;
        requirement_override?: RequirementLevel;
        is_hidden?: boolean;
        validation_override?: Record<string, unknown>;
      };
    }) => api.upsertFieldOverride(data.code, data.body),
    onSuccess: () => {
      notifications.show({
        title: isEdit ? "Override updated" : "Override created",
        message: "Field override saved",
        color: "success",
      });
      void queryClient.invalidateQueries({ queryKey: ["tenant-field-overrides"] });
      onClose();
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Save failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  const handleSubmit = () => {
    const code = fieldCode ?? editingOverride?.field_code;
    if (!code) return;

    let parsedValidation: Record<string, unknown> | undefined;
    if (validationOverride.trim()) {
      try {
        parsedValidation = JSON.parse(validationOverride) as Record<
          string,
          unknown
        >;
      } catch {
        notifications.show({
          title: "Invalid JSON",
          message: "Validation override must be valid JSON",
          color: "danger",
        });
        return;
      }
    }

    upsertMutation.mutate({
      code,
      body: {
        label_override: labelOverride || undefined,
        requirement_override: requirementOverride ?? undefined,
        is_hidden: isHidden,
        validation_override: parsedValidation,
      },
    });
  };

  const fieldOptions = fields.map((f) => ({
    value: f.code,
    label: `${f.name} (${f.code})`,
  }));

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEdit ? "Edit Override" : "Add Override"}
      onTransitionEnd={handleOpen}
    >
      <Stack gap="sm">
        <Select
          label="Field"
          placeholder="Select a field"
          data={fieldOptions}
          value={fieldCode}
          onChange={setFieldCode}
          searchable
          disabled={isEdit}
          required
        />
        <TextInput
          label="Label Override"
          placeholder="Custom label for this tenant"
          value={labelOverride}
          onChange={(e) => setLabelOverride(e.currentTarget.value)}
        />
        <Select
          label="Requirement Override"
          placeholder="No override"
          data={[
            { value: "optional", label: "Optional" },
            { value: "recommended", label: "Recommended" },
            { value: "conditional", label: "Conditional" },
            { value: "mandatory", label: "Mandatory" },
          ]}
          value={requirementOverride}
          onChange={(v) =>
            setRequirementOverride(v as RequirementLevel | null)
          }
          clearable
        />
        <Switch
          label="Hidden"
          description="Hide this field from forms (cannot hide mandatory fields)"
          checked={isHidden}
          onChange={(e) => setIsHidden(e.currentTarget.checked)}
        />
        <JsonInput
          label="Validation Override (JSON)"
          value={validationOverride}
          onChange={setValidationOverride}
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
            loading={upsertMutation.isPending}
            disabled={!fieldCode && !editingOverride}
          >
            {isEdit ? "Save" : "Create"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export function TenantFieldOverrides() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOverride, setEditingOverride] =
    useState<TenantFieldOverrideRow | null>(null);

  const { data: overrides, isLoading } = useQuery({
    queryKey: ["tenant-field-overrides"],
    queryFn: () => api.listFieldOverrides(),
  });

  const { data: fields } = useQuery({
    queryKey: ["admin-fields"],
    queryFn: () => api.adminListFields(),
  });

  const deleteMutation = useMutation({
    mutationFn: (fieldCode: string) => api.deleteFieldOverride(fieldCode),
    onSuccess: () => {
      notifications.show({
        title: "Override deleted",
        message: "Field override removed",
        color: "success",
      });
      void queryClient.invalidateQueries({ queryKey: ["tenant-field-overrides"] });
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Delete failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  const openCreate = () => {
    setEditingOverride(null);
    setModalOpen(true);
  };

  const openEdit = (override: TenantFieldOverrideRow) => {
    setEditingOverride(override);
    setModalOpen(true);
  };

  // Map TenantFieldOverride to our display rows
  const rows: TenantFieldOverrideRow[] = (overrides ?? []).map((o) => ({
    id: o.id,
    field_id: o.field_id,
    field_code: (o as unknown as { field_code?: string }).field_code ?? "",
    field_name: (o as unknown as { field_name?: string }).field_name ?? "",
    form_id: o.form_id ?? null,
    label_override: o.label_override,
    requirement_override: o.requirement_override,
    is_hidden: o.is_hidden,
    validation_override: o.validation_override,
  }));

  const columns = [
    {
      key: "field_code",
      label: "Field Code",
      render: (row: TenantFieldOverrideRow) => (
        <Text size="sm" ff="monospace">
          {row.field_code}
        </Text>
      ),
    },
    {
      key: "field_name",
      label: "Field Name",
      render: (row: TenantFieldOverrideRow) => row.field_name || "-",
    },
    {
      key: "label_override",
      label: "Label Override",
      render: (row: TenantFieldOverrideRow) => row.label_override || "-",
    },
    {
      key: "requirement",
      label: "Requirement",
      render: (row: TenantFieldOverrideRow) =>
        row.requirement_override ? (
          <Badge
            color={requirementColors[row.requirement_override] ?? "slate"}
            variant="light"
            size="sm"
          >
            {row.requirement_override}
          </Badge>
        ) : (
          "-"
        ),
    },
    {
      key: "hidden",
      label: "Hidden",
      render: (row: TenantFieldOverrideRow) =>
        row.is_hidden ? (
          <IconCheck size={14} color="var(--mantine-color-red-6)" />
        ) : (
          <IconX size={14} color="var(--mantine-color-gray-5)" />
        ),
    },
    {
      key: "actions",
      label: "",
      render: (row: TenantFieldOverrideRow) => (
        <Group gap="xs">
          <ActionIcon
            variant="subtle"
            color="primary"
            onClick={() => openEdit(row)}
            aria-label="Edit"
          >
            <IconPencil size={16} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="danger"
            onClick={() => deleteMutation.mutate(row.field_code)}
            aria-label="Delete"
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      ),
    },
  ];

  return (
    <>
      <Group justify="space-between" mb="md">
        <Text size="sm" c="dimmed">
          Tenant-specific field customizations
        </Text>
        <Button
          size="sm"
          leftSection={<IconPlus size={14} />}
          onClick={openCreate}
        >
          Add Override
        </Button>
      </Group>

      <DataTable<TenantFieldOverrideRow>
        columns={columns}
        data={rows}
        loading={isLoading}
        rowKey={(row) => row.id}
        emptyIcon={<IconShield size={32} />}
        emptyTitle="No overrides configured"
        emptyDescription="Add overrides to customize field labels, requirements, or visibility for this tenant"
        emptyAction={{ label: "Add Override", onClick: openCreate }}
      />

      <OverrideEditModal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        editingOverride={editingOverride}
        fields={fields ?? []}
      />
    </>
  );
}
