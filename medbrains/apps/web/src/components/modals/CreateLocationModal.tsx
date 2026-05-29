import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Group, Modal, Select, Stack, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { CreateLocationFormInput } from "@medbrains/schemas";
import { createLocationFormSchema } from "@medbrains/schemas";
import type { LocationRow } from "@medbrains/types";
import { IconCheck } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { adminAccessService } from "@/services/adminAccess.service";

const LEVEL_OPTIONS = [
  { value: "campus", label: "Campus" },
  { value: "building", label: "Building" },
  { value: "floor", label: "Floor" },
  { value: "wing", label: "Wing" },
  { value: "zone", label: "Zone" },
  { value: "room", label: "Room" },
  { value: "bed", label: "Bed" },
];

interface CreateLocationModalProps {
  opened: boolean;
  onClose: () => void;
  onCreated?: (location: LocationRow) => void;
}

export function CreateLocationModal({ opened, onClose, onCreated }: CreateLocationModalProps) {
  const queryClient = useQueryClient();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateLocationFormInput>({
    resolver: zodResolver(createLocationFormSchema),
    defaultValues: { code: "", name: "", level: "campus" },
    mode: "onTouched",
  });

  const handleClose = () => {
    reset();
    onClose();
  };

  const createMutation = useMutation({
    mutationFn: (data: CreateLocationFormInput) =>
      adminAccessService.createLocation({
        code: data.code.trim(),
        name: data.name.trim(),
        level: data.level,
      }),
    onSuccess: (created: LocationRow) => {
      notifications.show({
        title: "Location created",
        message: "Location has been created successfully",
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["setup-locations"] });
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

  const submitLocation = handleSubmit((values) => createMutation.mutate(values));

  return (
    <Modal opened={opened} onClose={handleClose} title="Add Location" size="md">
      <Stack gap="sm">
        <Controller
          control={control}
          name="code"
          render={({ field }) => (
            <TextInput
              label="Code"
              placeholder="MAIN-CAMPUS"
              value={field.value}
              onChange={(e) => field.onChange(e.currentTarget.value.toUpperCase())}
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
              placeholder="Main Campus"
              value={field.value}
              onChange={field.onChange}
              error={errors.name?.message}
              required
            />
          )}
        />
        <Controller
          control={control}
          name="level"
          render={({ field }) => (
            <Select
              label="Level"
              data={LEVEL_OPTIONS}
              value={field.value}
              onChange={(v) => field.onChange(v ?? "campus")}
              error={errors.level?.message}
              required
            />
          )}
        />
        <Group justify="flex-end" mt="md">
          <Button variant="light" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={() => void submitLocation()} loading={createMutation.isPending}>
            Create
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
