import {
  ActionIcon,
  Button,
  Card,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { useFormBuilderStore } from "@medbrains/stores";
import type { FieldAction, FieldActionTrigger, FieldActionType, FormBuilderFieldNode } from "@medbrains/types";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useMemo } from "react";

const TRIGGER_OPTIONS = [
  { value: "on_click", label: "On Click (button)" },
  { value: "on_blur", label: "On Blur" },
  { value: "on_change", label: "On Change" },
];

const ACTION_TYPE_OPTIONS = [
  { value: "api_call", label: "API Call" },
  { value: "validate", label: "Validate (MBX)" },
  { value: "lookup", label: "Lookup" },
  { value: "copy_value", label: "Copy Value" },
];

const METHOD_OPTIONS = [
  { value: "GET", label: "GET" },
  { value: "POST", label: "POST" },
];

const LOOKUP_ENTITY_OPTIONS = [
  { value: "patients", label: "Patients" },
  { value: "doctors", label: "Doctors" },
  { value: "departments", label: "Departments" },
  { value: "services", label: "Services" },
];

let actionCounter = 0;
function generateActionId(): string {
  actionCounter += 1;
  return `act_${Date.now()}_${actionCounter}`;
}

interface MappingEditorProps {
  mappings: Record<string, string>;
  onChange: (mappings: Record<string, string>) => void;
  label: string;
  keyPlaceholder: string;
  valuePlaceholder: string;
}

function MappingEditor({ mappings, onChange, label, keyPlaceholder, valuePlaceholder }: MappingEditorProps) {
  const pairs = Object.entries(mappings);

  const addPair = () => {
    onChange({ ...mappings, "": "" });
  };

  const updateKey = (oldKey: string, newKey: string) => {
    const entries = Object.entries(mappings);
    const next: Record<string, string> = {};
    for (const [k, v] of entries) {
      next[k === oldKey ? newKey : k] = v;
    }
    onChange(next);
  };

  const updateValue = (key: string, val: string) => {
    onChange({ ...mappings, [key]: val });
  };

  const removePair = (key: string) => {
    const next = { ...mappings };
    delete next[key];
    onChange(next);
  };

  return (
    <Stack gap="xs">
      <Text size="xs" fw={500}>{label}</Text>
      {pairs.map(([key, val], idx) => (
        <Group key={idx} gap="xs" wrap="nowrap">
          <TextInput
            size="xs"
            placeholder={keyPlaceholder}
            value={key}
            onChange={(e) => updateKey(key, e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <TextInput
            size="xs"
            placeholder={valuePlaceholder}
            value={val}
            onChange={(e) => updateValue(key, e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <ActionIcon size="sm" variant="subtle" color="danger" onClick={() => removePair(key)} aria-label="Delete">
            <IconTrash size={12} />
          </ActionIcon>
        </Group>
      ))}
      <Button size="xs" variant="subtle" leftSection={<IconPlus size={12} />} onClick={addPair}>
        Add Mapping
      </Button>
    </Stack>
  );
}

function ActionCard({
  action,
  field,
}: {
  action: FieldAction;
  field: FormBuilderFieldNode;
}) {
  const updateFieldAction = useFormBuilderStore((s) => s.updateFieldAction);
  const removeFieldAction = useFormBuilderStore((s) => s.removeFieldAction);
  const allFields = useFormBuilderStore((s) => s.fields);

  const siblingFields = useMemo(
    () =>
      Object.values(allFields)
        .filter((f) => f.id !== field.id)
        .map((f) => ({ value: f.fieldCode, label: f.label })),
    [allFields, field.id],
  );

  const update = (updates: Partial<FieldAction>) => {
    updateFieldAction(field.id, action.id, updates);
  };

  return (
    <Card withBorder padding="xs" radius="sm">
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap">
          <TextInput
            size="xs"
            placeholder="Action label"
            value={action.label}
            onChange={(e) => update({ label: e.currentTarget.value })}
            style={{ flex: 1 }}
          />
          <ActionIcon
            size="sm"
            variant="subtle"
            color="danger"
            onClick={() => removeFieldAction(field.id, action.id)}
            aria-label="Delete"
          >
            <IconTrash size={12} />
          </ActionIcon>
        </Group>

        <Group gap="xs" grow>
          <Select
            size="xs"
            label="Trigger"
            data={TRIGGER_OPTIONS}
            value={action.trigger}
            onChange={(val) => update({ trigger: (val as FieldActionTrigger) ?? "on_click" })}
          />
          <Select
            size="xs"
            label="Action Type"
            data={ACTION_TYPE_OPTIONS}
            value={action.actionType}
            onChange={(val) => update({ actionType: (val as FieldActionType) ?? "api_call" })}
          />
        </Group>

        <TextInput
          size="xs"
          label="Icon (Tabler)"
          placeholder="IconCheck"
          value={action.icon ?? ""}
          onChange={(e) => update({ icon: e.currentTarget.value || undefined })}
        />

        {action.actionType === "api_call" && (
          <>
            <Group gap="xs" grow>
              <TextInput
                size="xs"
                label="Endpoint"
                placeholder="/api/verify-aadhaar"
                value={action.endpoint ?? ""}
                onChange={(e) => update({ endpoint: e.currentTarget.value })}
              />
              <Select
                size="xs"
                label="Method"
                data={METHOD_OPTIONS}
                value={action.method ?? "POST"}
                onChange={(val) => update({ method: (val as "GET" | "POST") ?? "POST" })}
              />
            </Group>
            <MappingEditor
              label="Body Mapping"
              mappings={action.bodyMapping ?? {}}
              onChange={(bodyMapping) => update({ bodyMapping })}
              keyPlaceholder="request_key"
              valuePlaceholder="$self or field_code"
            />
            <MappingEditor
              label="Response Mapping"
              mappings={action.responseMapping ?? {}}
              onChange={(responseMapping) => update({ responseMapping })}
              keyPlaceholder="field_code"
              valuePlaceholder="data.path"
            />
          </>
        )}

        {action.actionType === "validate" && (
          <Textarea
            size="xs"
            label="Validation Expression (MBX)"
            placeholder='$self.length === 12 ? true : "Must be 12 digits"'
            autosize
            minRows={2}
            value={action.validationExpr ?? ""}
            onChange={(e) => update({ validationExpr: e.currentTarget.value })}
          />
        )}

        {action.actionType === "lookup" && (
          <>
            <Select
              size="xs"
              label="Lookup Entity"
              data={LOOKUP_ENTITY_OPTIONS}
              value={action.lookupEntity ?? null}
              onChange={(val) => update({ lookupEntity: val ?? undefined })}
              searchable
              clearable
            />
            <Text size="xs" c="dimmed">
              Display fields and modal integration are configured at runtime.
            </Text>
          </>
        )}

        {action.actionType === "copy_value" && (
          <Group gap="xs" grow>
            <Select
              size="xs"
              label="Source Field"
              data={siblingFields}
              value={action.sourceField ?? null}
              onChange={(val) => update({ sourceField: val ?? undefined })}
              searchable
              clearable
            />
            <Select
              size="xs"
              label="Target Field"
              data={siblingFields}
              value={action.targetField ?? null}
              onChange={(val) => update({ targetField: val ?? undefined })}
              searchable
              clearable
            />
          </Group>
        )}
      </Stack>
    </Card>
  );
}

export function FieldActionsEditor({ field }: { field: FormBuilderFieldNode }) {
  const addFieldAction = useFormBuilderStore((s) => s.addFieldAction);

  const handleAdd = () => {
    addFieldAction(field.id, {
      id: generateActionId(),
      label: "New Action",
      trigger: "on_click",
      actionType: "api_call",
    });
  };

  return (
    <Stack gap="sm" p="xs">
      {field.actions.length === 0 && (
        <Text size="xs" c="dimmed">
          No actions configured. Add an action to attach API calls, validation, or lookup to this
          field.
        </Text>
      )}

      {field.actions.map((action) => (
        <ActionCard key={action.id} action={action} field={field} />
      ))}

      <Button size="xs" variant="light" leftSection={<IconPlus size={12} />} onClick={handleAdd}>
        Add Action
      </Button>
    </Stack>
  );
}
