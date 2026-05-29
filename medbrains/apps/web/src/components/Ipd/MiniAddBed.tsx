import { Button, Group, Select, Stack, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { AvailableBed } from "@medbrains/types";
import { IconBed, IconCheck } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ipdService } from "@/services/ipd.service";
import { settingsSetupService } from "@/services/settingsSetup.service";

interface MiniAddBedProps {
  searchText: string;
  wardId?: string;
  onCreated: (bed: AvailableBed) => void;
  onCancel: () => void;
}

function inferName(searchText: string): string {
  return searchText.trim();
}

function inferCode(name: string): string {
  const code = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 20);
  return code || "BED";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to add bed";
}

export function MiniAddBed({ searchText, wardId, onCreated, onCancel }: MiniAddBedProps) {
  const initialName = useMemo(() => inferName(searchText), [searchText]);
  const queryClient = useQueryClient();
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState(() => inferCode(initialName));
  const [parentId, setParentId] = useState("");

  const { data: locations = [] } = useQuery({
    queryKey: ["setup-locations"],
    queryFn: () => settingsSetupService.listLocations(),
    staleTime: 300_000,
  });

  const parentOptions = useMemo(
    () =>
      locations
        .filter((location) => location.is_active && location.level !== "bed")
        .map((location) => ({
          value: location.id,
          label: `${location.name} (${location.level})`,
        })),
    [locations],
  );

  const mutation = useMutation({
    mutationFn: async () => {
      const location = await settingsSetupService.createLocation({
        parent_id: parentId,
        level: "bed",
        code: code.trim(),
        name: name.trim(),
      });

      if (wardId) {
        await ipdService.assignBedToWard(wardId, { bed_location_id: location.id });
      }

      return {
        bed_id: location.id,
        bed_number: location.name,
        ward_id: wardId ?? null,
        ward_name: null,
        room_number: null,
        bed_type: null,
        is_isolation: false,
      } satisfies AvailableBed;
    },
    onSuccess: (bed) => {
      void queryClient.invalidateQueries({ queryKey: ["available-beds"] });
      void queryClient.invalidateQueries({ queryKey: ["setup-locations"] });
      if (wardId) {
        void queryClient.invalidateQueries({ queryKey: ["ipd-ward-beds", wardId] });
        void queryClient.invalidateQueries({ queryKey: ["ipd-wards"] });
      }
      notifications.show({
        title: "Bed added",
        message: `${bed.bed_number} is now selected`,
        color: "success",
        icon: <IconCheck size={16} />,
      });
      onCreated(bed);
    },
    onError: (error) => {
      notifications.show({
        title: "Bed add failed",
        message: errorMessage(error),
        color: "danger",
      });
    },
  });

  const canSubmit = name.trim().length >= 2 && code.trim().length >= 2 && parentId.length > 0;

  return (
    <Stack gap="sm">
      <TextInput
        label="Bed name"
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
          data={parentOptions}
          label="Parent location"
          placeholder="Select room or ward"
          required
          searchable
          value={parentId || null}
          onChange={(value) => setParentId(value ?? "")}
        />
      </Group>
      <Group justify="flex-end">
        <Button variant="subtle" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          leftSection={<IconBed size={16} />}
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
