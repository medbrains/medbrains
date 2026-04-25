import {
  ActionIcon,
  Alert,
  Button,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { createLocationSchema } from "@medbrains/schemas";
import type { CreateLocationInput } from "@medbrains/schemas";
import { api } from "@medbrains/api";
import { useOnboardingStore } from "@medbrains/stores";
import type { OnboardingLocation } from "@medbrains/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { IconTrash, IconUpload } from "@tabler/icons-react";
import { CsvImportModal } from "../../components";
import classes from "./onboarding.module.scss";

interface Props {
  onNext: () => void;
  onBack: () => void;
}

const levelOptions = [
  { value: "campus", label: "Campus" },
  { value: "building", label: "Building" },
  { value: "floor", label: "Floor" },
  { value: "wing", label: "Wing" },
  { value: "zone", label: "Zone" },
  { value: "room", label: "Room" },
  { value: "bed", label: "Bed" },
];

export function LocationsStep({ onNext, onBack }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const locations = useOnboardingStore((s) => s.locations);
  const addLocation = useOnboardingStore((s) => s.addLocation);
  const removeLocation = useOnboardingStore((s) => s.removeLocation);

  const form = useForm<CreateLocationInput>({
    resolver: zodResolver(createLocationSchema),
    defaultValues: {
      code: "",
      name: "",
      level: "campus",
      parent_id: null,
    },
  });

  const parentOptions = locations.map((l: OnboardingLocation) => ({
    value: l.local_id,
    label: `${l.name} (${l.level})`,
  }));

  const handleAdd = form.handleSubmit((data) => {
    if (locations.some((l) => l.code === data.code)) {
      form.setError("code", { message: "A location with this code already exists" });
      return;
    }
    addLocation({
      code: data.code,
      name: data.name,
      level: data.level,
      parent_local_id: data.parent_id ?? undefined,
    });
    setShowModal(false);
    form.reset();
  });

  const openModal = () => {
    form.reset({ code: "", name: "", level: "campus", parent_id: null });
    setShowModal(true);
  };

  const watchedLevel = form.watch("level");

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Build your campus-to-bed hierarchy. Start with a campus, then add
        buildings, floors, rooms, and beds.
      </Text>

      {locations.length === 0 && (
        <Alert variant="light" color="primary">
          No locations yet. Add your first campus location.
        </Alert>
      )}

      {locations.map((loc: OnboardingLocation) => (
        <div key={loc.local_id} className={classes.facilityCard}>
          <div className={classes.facilityInfo}>
            <Text fw={600}>{loc.name}</Text>
            <Text size="sm" c="dimmed">
              {loc.code} &middot; {loc.level}
            </Text>
          </div>
          <ActionIcon
            variant="subtle"
            color="danger"
            onClick={() => removeLocation(loc.local_id)}
            aria-label="Delete"
          >
            <IconTrash size={16} />
          </ActionIcon>
        </div>
      ))}

      <Group gap="sm">
        <Button variant="light" onClick={openModal}>
          Add Location
        </Button>
        <Button
          variant="subtle"
          leftSection={<IconUpload size={16} />}
          onClick={() => setShowImport(true)}
        >
          Import CSV
        </Button>
      </Group>

      <CsvImportModal
        opened={showImport}
        onClose={() => setShowImport(false)}
        title="Import Locations from CSV"
        requiredColumns={["code", "name", "level"]}
        optionalColumns={["parent_code"]}
        onImport={api.importLocations}
      />

      <Modal
        opened={showModal}
        onClose={() => setShowModal(false)}
        title="Add Location"
      >
        <form onSubmit={handleAdd}>
          <Stack gap="sm">
            <Controller
              control={form.control}
              name="level"
              render={({ field }) => (
                <Select
                  label="Level"
                  data={levelOptions}
                  value={field.value}
                  onChange={(v) => field.onChange(v ?? "campus")}
                  error={form.formState.errors.level?.message}
                />
              )}
            />
            <Controller
              control={form.control}
              name="parent_id"
              render={({ field }) => (
                <Select
                  label="Parent Location"
                  data={parentOptions}
                  value={field.value ?? null}
                  onChange={field.onChange}
                  clearable
                  placeholder={watchedLevel === "campus" ? "None (root)" : "Select parent"}
                  description={watchedLevel !== "campus" ? "Required for non-campus locations" : undefined}
                  error={form.formState.errors.parent_id?.message}
                />
              )}
            />
            <TextInput
              label="Code"
              {...form.register("code", {
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                  form.setValue("code", e.currentTarget.value.toUpperCase());
                },
              })}
              error={form.formState.errors.code?.message}
            />
            <TextInput
              label="Name"
              {...form.register("name")}
              error={form.formState.errors.name?.message}
            />
            <Button type="submit">
              Add Location
            </Button>
          </Stack>
        </form>
      </Modal>

      <div className={classes.navButtons}>
        <Button variant="default" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext}>Continue</Button>
      </div>
    </Stack>
  );
}
