import { useState } from "react";
import { Button, Group, Modal, Stack, TextInput, Textarea } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCheck } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import type { CustomRole } from "@medbrains/types";

interface CreateRoleModalProps {
  opened: boolean;
  onClose: () => void;
  onCreated?: (role: CustomRole) => void;
}

export function CreateRoleModal({
  opened,
  onClose,
  onCreated,
}: CreateRoleModalProps) {
  const queryClient = useQueryClient();

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleOpen = () => {
    setCode("");
    setName("");
    setDescription("");
  };

  const createMutation = useMutation({
    mutationFn: (data: { code: string; name: string; description?: string }) =>
      api.createRole(data),
    onSuccess: (created: CustomRole) => {
      notifications.show({
        title: "Role created",
        message: "Custom role has been created successfully",
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["setup-roles"] });
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
      description: description || undefined,
    });
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Add Role"
      size="md"
      onTransitionEnd={handleOpen}
    >
      <Stack gap="sm">
        <TextInput
          label="Code"
          placeholder="custom_role"
          value={code}
          onChange={(e) => setCode(e.currentTarget.value)}
          required
        />
        <TextInput
          label="Name"
          placeholder="Custom Role"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
        />
        <Textarea
          label="Description"
          placeholder="Describe the role responsibilities..."
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
          minRows={3}
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
