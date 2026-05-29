import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Group, Modal, Stack, Textarea, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { InlineCreateRoleFormInput } from "@medbrains/schemas";
import { inlineCreateRoleFormSchema } from "@medbrains/schemas";
import type { CustomRole } from "@medbrains/types";
import { IconCheck } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { adminAccessService } from "@/services/adminAccess.service";

interface CreateRoleModalProps {
  opened: boolean;
  onClose: () => void;
  onCreated?: (role: CustomRole) => void;
}

export function CreateRoleModal({ opened, onClose, onCreated }: CreateRoleModalProps) {
  const queryClient = useQueryClient();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InlineCreateRoleFormInput>({
    resolver: zodResolver(inlineCreateRoleFormSchema),
    defaultValues: { code: "", name: "", description: "" },
    mode: "onTouched",
  });

  const handleClose = () => {
    reset();
    onClose();
  };

  const createMutation = useMutation({
    mutationFn: (data: InlineCreateRoleFormInput) =>
      adminAccessService.createRole({
        code: data.code.trim(),
        name: data.name.trim(),
        description: data.description.trim() || undefined,
      }),
    onSuccess: (created: CustomRole) => {
      notifications.show({
        title: "Role created",
        message: "Custom role has been created successfully",
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["setup-roles"] });
      reset();
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

  const submitRole = handleSubmit((values) => createMutation.mutate(values));

  return (
    <Modal opened={opened} onClose={handleClose} title="Add Role" size="md">
      <Stack gap="sm">
        <Controller
          control={control}
          name="code"
          render={({ field }) => (
            <TextInput
              label="Code"
              placeholder="custom_role"
              value={field.value}
              onChange={field.onChange}
              error={errors.code?.message}
              required
            />
          )}
        />
        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <TextInput
              label="Name"
              placeholder="Custom Role"
              value={field.value}
              onChange={field.onChange}
              error={errors.name?.message}
              required
            />
          )}
        />
        <Controller
          control={control}
          name="description"
          render={({ field }) => (
            <Textarea
              label="Description"
              placeholder="Describe the role responsibilities..."
              value={field.value}
              onChange={field.onChange}
              minRows={3}
            />
          )}
        />
        <Group justify="flex-end" mt="md">
          <Button variant="light" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={() => void submitRole()} loading={createMutation.isPending}>
            Create
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
