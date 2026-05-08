import { Button, Group, Select, Stack, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { api } from "@medbrains/api";
import type { DepartmentRow } from "@medbrains/types";
import { IconBuilding, IconCheck } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

interface MiniAddDepartmentProps {
  searchText: string;
  departmentType?: "clinical" | "para_clinical" | "administrative" | "support";
  onCreated: (department: DepartmentRow) => void;
  onCancel: () => void;
}

const departmentTypeOptions = [
  { value: "clinical", label: "Clinical" },
  { value: "para_clinical", label: "Para-Clinical" },
  { value: "administrative", label: "Administrative" },
  { value: "support", label: "Support" },
  { value: "academic", label: "Academic" },
];

function inferName(searchText: string): string {
  return searchText.trim();
}

function inferCode(name: string): string {
  const code = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 20);
  return code || "DEPT";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to add department";
}

export function MiniAddDepartment({
  searchText,
  departmentType,
  onCreated,
  onCancel,
}: MiniAddDepartmentProps) {
  const initialName = useMemo(() => inferName(searchText), [searchText]);
  const queryClient = useQueryClient();
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState(() => inferCode(initialName));
  const [type, setType] = useState<string>(departmentType ?? "clinical");

  const mutation = useMutation({
    mutationFn: () =>
      api.createDepartment({
        code: code.trim(),
        name: name.trim(),
        department_type: type,
      }),
    onSuccess: (department) => {
      void queryClient.invalidateQueries({ queryKey: ["departments-list"] });
      void queryClient.invalidateQueries({ queryKey: ["setup-departments"] });
      void queryClient.invalidateQueries({ queryKey: ["setup", "departments"] });
      notifications.show({
        title: "Department added",
        message: `${department.name} is now selected`,
        color: "success",
        icon: <IconCheck size={16} />,
      });
      onCreated(department);
    },
    onError: (error) => {
      notifications.show({
        title: "Department add failed",
        message: errorMessage(error),
        color: "danger",
      });
    },
  });

  const canSubmit = name.trim().length >= 2 && code.trim().length >= 2;

  return (
    <Stack gap="sm">
      <TextInput
        label="Department name"
        required
        value={name}
        onChange={(event) => {
          const next = event.currentTarget.value;
          setName(next);
          if (!code || code === inferCode(name)) {
            setCode(inferCode(next));
          }
        }}
      />
      <Group grow align="flex-start">
        <TextInput
          label="Code"
          required
          value={code}
          onChange={(event) => setCode(event.currentTarget.value.toUpperCase())}
        />
        <Select
          allowDeselect={false}
          data={departmentTypeOptions}
          disabled={Boolean(departmentType)}
          label="Type"
          value={type}
          onChange={(value) => setType(value ?? "clinical")}
        />
      </Group>
      <Group justify="flex-end">
        <Button variant="subtle" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          leftSection={<IconBuilding size={16} />}
          loading={mutation.isPending}
          disabled={!canSubmit}
          onClick={() => mutation.mutate()}
        >
          Add & select
        </Button>
      </Group>
    </Stack>
  );
}
