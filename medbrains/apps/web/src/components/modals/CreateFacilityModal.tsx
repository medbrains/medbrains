import { useState } from "react";
import { Button, Group, Modal, Select, Stack, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCheck } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import type { Facility } from "@medbrains/types";

const FACILITY_TYPE_OPTIONS = [
  { value: "hospital", label: "Hospital" },
  { value: "clinic", label: "Clinic" },
  { value: "satellite_center", label: "Satellite Center" },
  { value: "nursing_home", label: "Nursing Home" },
  { value: "blood_bank", label: "Blood Bank" },
  { value: "diagnostic_center", label: "Diagnostic Center" },
  { value: "pharmacy", label: "Pharmacy" },
  { value: "warehouse", label: "Warehouse" },
];

interface CreateFacilityModalProps {
  opened: boolean;
  onClose: () => void;
  onCreated?: (facility: Facility) => void;
}

export function CreateFacilityModal({
  opened,
  onClose,
  onCreated,
}: CreateFacilityModalProps) {
  const queryClient = useQueryClient();

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [facilityType, setFacilityType] = useState<string | null>("hospital");

  const handleOpen = () => {
    setCode("");
    setName("");
    setFacilityType("hospital");
  };

  const createMutation = useMutation({
    mutationFn: (data: { code: string; name: string; facility_type: string }) =>
      api.createFacility(data),
    onSuccess: (created: Facility) => {
      notifications.show({
        title: "Facility created",
        message: "Facility has been created successfully",
        color: "success",
        icon: <IconCheck size={16} />,
      });
      void queryClient.invalidateQueries({ queryKey: ["setup-facilities"] });
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
    if (!code.trim() || !name.trim() || !facilityType) {
      notifications.show({
        title: "Missing fields",
        message: "Code, Name, and Type are required",
        color: "danger",
      });
      return;
    }
    createMutation.mutate({
      code,
      name,
      facility_type: facilityType,
    });
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Add Facility"
      size="md"
      onTransitionEnd={handleOpen}
    >
      <Stack gap="sm">
        <TextInput
          label="Code"
          placeholder="FAC-001"
          value={code}
          onChange={(e) => setCode(e.currentTarget.value)}
          required
        />
        <TextInput
          label="Name"
          placeholder="Main Hospital"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
        />
        <Select
          label="Facility Type"
          data={FACILITY_TYPE_OPTIONS}
          value={facilityType}
          onChange={setFacilityType}
          required
          placeholder="Select type..."
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
