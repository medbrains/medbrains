import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Loader,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useFormBuilderStore } from "@medbrains/stores";
import type { FieldDataSource, FormBuilderFieldNode } from "@medbrains/types";
import { IconPlus, IconTestPipe, IconTrash } from "@tabler/icons-react";
import { useMemo, useState } from "react";

const SOURCE_TYPE_OPTIONS = [
  { value: "static", label: "Static (manual options)" },
  { value: "api", label: "API Endpoint" },
  { value: "dependent", label: "Dependent (cascading)" },
];

const METHOD_OPTIONS = [
  { value: "GET", label: "GET" },
  { value: "POST", label: "POST" },
];

interface KeyValueEditorProps {
  entries: Record<string, string>;
  onChange: (entries: Record<string, string>) => void;
  label: string;
}

function KeyValueEditor({ entries, onChange, label }: KeyValueEditorProps) {
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  const pairs = Object.entries(entries);

  const addPair = () => {
    const k = newKey.trim();
    if (!k) return;
    onChange({ ...entries, [k]: newValue.trim() });
    setNewKey("");
    setNewValue("");
  };

  const removePair = (key: string) => {
    const next = { ...entries };
    delete next[key];
    onChange(next);
  };

  return (
    <Stack gap="xs">
      <Text size="xs" fw={500}>{label}</Text>
      {pairs.map(([key, val]) => (
        <Group key={key} gap="xs" wrap="nowrap">
          <TextInput size="xs" value={key} readOnly style={{ flex: 1 }} />
          <TextInput
            size="xs"
            value={val}
            onChange={(e) => onChange({ ...entries, [key]: e.currentTarget.value })}
            style={{ flex: 1 }}
          />
          <ActionIcon size="sm" variant="subtle" color="danger" onClick={() => removePair(key)} aria-label="Delete">
            <IconTrash size={12} />
          </ActionIcon>
        </Group>
      ))}
      <Group gap="xs" wrap="nowrap">
        <TextInput
          size="xs"
          placeholder="Key"
          value={newKey}
          onChange={(e) => setNewKey(e.currentTarget.value)}
          style={{ flex: 1 }}
        />
        <TextInput
          size="xs"
          placeholder="Value"
          value={newValue}
          onChange={(e) => setNewValue(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === "Enter") addPair(); }}
          style={{ flex: 1 }}
        />
        <ActionIcon size="sm" variant="light" color="primary" onClick={addPair} aria-label="Add">
          <IconPlus size={12} />
        </ActionIcon>
      </Group>
    </Stack>
  );
}

export function DataSourceEditor({ field }: { field: FormBuilderFieldNode }) {
  const updateFieldDataSource = useFormBuilderStore((s) => s.updateFieldDataSource);
  const allFields = useFormBuilderStore((s) => s.fields);
  const [testResults, setTestResults] = useState<string[] | null>(null);
  const [testing, setTesting] = useState(false);

  const ds = field.dataSource;
  const currentType = ds?.type ?? "static";

  const siblingFields = useMemo(
    () =>
      Object.values(allFields)
        .filter((f) => f.id !== field.id)
        .map((f) => ({ value: f.fieldCode, label: f.label })),
    [allFields, field.id],
  );

  const updateDs = (updates: Partial<FieldDataSource>) => {
    const current = ds ?? { type: "static" as const };
    updateFieldDataSource(field.id, { ...current, ...updates });
  };

  const handleTypeChange = (val: string | null) => {
    if (!val || val === "static") {
      updateFieldDataSource(field.id, null);
      return;
    }
    updateFieldDataSource(field.id, {
      type: val as FieldDataSource["type"],
      endpoint: ds?.endpoint ?? "",
      method: ds?.method ?? "GET",
      valueKey: ds?.valueKey ?? "id",
      labelKey: ds?.labelKey ?? "name",
    });
  };

  const handleTest = async () => {
    if (!ds?.endpoint) return;
    setTesting(true);
    setTestResults(null);
    try {
      const params = new URLSearchParams(ds.params ?? {});
      const url = `${ds.endpoint}${params.toString() ? `?${params.toString()}` : ""}`;
      const resp = await fetch(url, {
        method: ds.method ?? "GET",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!resp.ok) {
        setTestResults([`Error: ${resp.status} ${resp.statusText}`]);
        return;
      }
      const data = await resp.json();
      const items = Array.isArray(data) ? data : (data.data ?? data.items ?? []);
      const vk = ds.valueKey ?? "id";
      const lk = ds.labelKey ?? "name";
      const labels = items.slice(0, 5).map((item: Record<string, unknown>) => {
        const v = item[vk] ?? "?";
        const l = item[lk] ?? "?";
        return `${l} (${v})`;
      });
      setTestResults(labels.length > 0 ? labels : ["No items returned"]);
    } catch (err) {
      setTestResults([`Fetch error: ${err instanceof Error ? err.message : "unknown"}`]);
    } finally {
      setTesting(false);
    }
  };

  return (
    <Stack gap="sm" p="xs">
      <Select
        label="Source Type"
        size="xs"
        data={SOURCE_TYPE_OPTIONS}
        value={currentType}
        onChange={handleTypeChange}
      />

      {(currentType === "api" || currentType === "dependent") && (
        <>
          <TextInput
            label="Endpoint"
            size="xs"
            placeholder="/api/departments"
            value={ds?.endpoint ?? ""}
            onChange={(e) => updateDs({ endpoint: e.currentTarget.value })}
          />

          <Select
            label="Method"
            size="xs"
            data={METHOD_OPTIONS}
            value={ds?.method ?? "GET"}
            onChange={(val) => updateDs({ method: (val as "GET" | "POST") ?? "GET" })}
          />

          <Group gap="xs" grow>
            <TextInput
              label="Value Key"
              size="xs"
              placeholder="id"
              value={ds?.valueKey ?? "id"}
              onChange={(e) => updateDs({ valueKey: e.currentTarget.value })}
            />
            <TextInput
              label="Label Key"
              size="xs"
              placeholder="name"
              value={ds?.labelKey ?? "name"}
              onChange={(e) => updateDs({ labelKey: e.currentTarget.value })}
            />
          </Group>

          <KeyValueEditor
            label="Static Params"
            entries={ds?.params ?? {}}
            onChange={(params) => updateDs({ params })}
          />

          {currentType === "dependent" && (
            <>
              <Select
                label="Depends On (parent field)"
                size="xs"
                data={siblingFields}
                value={ds?.dependsOn ?? null}
                onChange={(val) => updateDs({ dependsOn: val ?? undefined })}
                searchable
                clearable
                placeholder="Select parent field..."
              />
              <TextInput
                label="Parent Param Key"
                size="xs"
                placeholder="state_id"
                value={ds?.parentParamKey ?? ""}
                onChange={(e) => updateDs({ parentParamKey: e.currentTarget.value })}
              />
            </>
          )}

          <Button
            size="xs"
            variant="light"
            leftSection={testing ? <Loader size={12} /> : <IconTestPipe size={14} />}
            onClick={handleTest}
            disabled={!ds?.endpoint || testing}
          >
            Test Endpoint
          </Button>

          {testResults && (
            <Stack gap={2}>
              <Text size="xs" fw={500}>Preview:</Text>
              {testResults.map((r, i) => (
                <Badge key={i} size="xs" variant="light" fullWidth>
                  {r}
                </Badge>
              ))}
            </Stack>
          )}
        </>
      )}
    </Stack>
  );
}
