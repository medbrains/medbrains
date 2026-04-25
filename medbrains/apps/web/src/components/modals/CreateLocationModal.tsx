import { useState } from "react";
import { Button, Group, Modal, Select, Stack, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCheck } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import type { LocationRow } from "@medbrains/types";

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

export function CreateLocationModal({
  opened,
  onClose,
  onCreated,
}: CreateLocationModalProps) {
  const queryClient = useQueryClient();

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [level, setLevel] = useState("campus");

  const handleOpen = () => {
    setCode("");
    setName("");
    setLevel("campus");
  };

  const createMutation = useMutation({
    mutationFn: (data: { code: string; name: string; level: string }) =>
      api.createLocation(data),
    onSuccess: (created: LocationRow) => {
      notifications.show({
        title: "Location created",
        message: "Location has been created successfully",
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["setup-locations"] });
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
    createMutation.mutate({ code, name, level });
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Add Location"
      size="md"
      onTransitionEnd={handleOpen}
    >
      <Stack gap="sm">
        <TextInput
          label="Code"
          placeholder="MAIN-CAMPUS"
          value={code}
          onChange={(e) => setCode(e.currentTarget.value.toUpperCase())}
          required
        />
        <TextInput
          label="Name"
          placeholder="Main Campus"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
        />
        <Select
          label="Level"
          data={LEVEL_OPTIONS}
          value={level}
          onChange={(v) => setLevel(v ?? "campus")}
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
