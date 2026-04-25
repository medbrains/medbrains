import { useState } from "react";
import { Button, Group, Modal, Select, Stack, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCheck } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import type { DepartmentRow } from "@medbrains/types";

const DEPARTMENT_TYPE_OPTIONS = [
  { value: "clinical", label: "Clinical" },
  { value: "pre_clinical", label: "Pre-Clinical" },
  { value: "para_clinical", label: "Para-Clinical" },
  { value: "administrative", label: "Administrative" },
  { value: "support", label: "Support" },
  { value: "academic", label: "Academic" },
];

interface CreateDepartmentModalProps {
  opened: boolean;
  onClose: () => void;
  onCreated?: (department: DepartmentRow) => void;
}

export function CreateDepartmentModal({
  opened,
  onClose,
  onCreated,
}: CreateDepartmentModalProps) {
  const queryClient = useQueryClient();

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [departmentType, setDepartmentType] = useState("clinical");

  const handleOpen = () => {
    setCode("");
    setName("");
    setDepartmentType("clinical");
  };

  const createMutation = useMutation({
    mutationFn: (data: {
      code: string;
      name: string;
      department_type: string;
    }) => api.createDepartment(data),
    onSuccess: (created: DepartmentRow) => {
      notifications.show({
        title: "Department created",
        message: "Department has been created successfully",
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["setup-departments"] });
      if (onCreated) {
        onCreated(created);
      } else {
        onClose();
      }
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Create failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  const handleSubmit = () => {
    if (!code.trim() || !name.trim()) {
      notifications.show({
        title: "Missing fields",
        message: "Code and Name are required",
        color: "danger",
      });
      return;
    }
    createMutation.mutate({
      code,
      name,
      department_type: departmentType,
    });
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Add Department"
      size="md"
      onTransitionEnd={handleOpen}
    >
      <Stack gap="sm">
        <TextInput
          label="Code"
          placeholder="GEN-MED"
          value={code}
          onChange={(e) => setCode(e.currentTarget.value.toUpperCase())}
          required
        />
        <TextInput
          label="Name"
          placeholder="General Medicine"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
        />
        <Select
          label="Department Type"
          data={DEPARTMENT_TYPE_OPTIONS}
          value={departmentType}
          onChange={(v) => setDepartmentType(v ?? "clinical")}
          required
        />
        <Group justify="flex-end" mt="md">
          <Button variant="light" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={createMutation.isPending}>
            Create
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
