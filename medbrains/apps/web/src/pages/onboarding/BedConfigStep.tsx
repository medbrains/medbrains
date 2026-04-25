import {
  ActionIcon,
  Button,
  Group,
  Modal,
  NumberInput,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { createBedTypeSchema } from "@medbrains/schemas";
import type { CreateBedTypeInput } from "@medbrains/schemas";
import { useOnboardingStore } from "@medbrains/stores";
import type { OnboardingBedType } from "@medbrains/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { IconBed, IconPlus, IconTrash } from "@tabler/icons-react";
import classes from "./onboarding.module.scss";

interface Props {
  onNext: () => void;
  onBack: () => void;
}

const templateBedTypes: Array<{ code: string; name: string; daily_rate: number }> = [
  { code: "GENERAL", name: "General Ward", daily_rate: 500 },
  { code: "SEMI-PRIVATE", name: "Semi-Private Room", daily_rate: 1500 },
  { code: "PRIVATE", name: "Private Room", daily_rate: 3000 },
  { code: "ICU", name: "ICU", daily_rate: 5000 },
  { code: "NICU", name: "NICU", daily_rate: 6000 },
  { code: "HDU", name: "High Dependency Unit", daily_rate: 4000 },
];

export function BedConfigStep({ onNext, onBack }: Props) {
  const [showModal, setShowModal] = useState(false);
  const bedTypes = useOnboardingStore((s) => s.bedTypes);
  const addBedType = useOnboardingStore((s) => s.addBedType);
  const removeBedType = useOnboardingStore((s) => s.removeBedType);

  const form = useForm<CreateBedTypeInput>({
    resolver: zodResolver(createBedTypeSchema),
    defaultValues: {
      code: "",
      name: "",
      daily_rate: 0,
      description: "",
    },
  });

  const handleAdd = form.handleSubmit((data) => {
    if (bedTypes.some((b) => b.code === data.code)) {
      form.setError("code", { message: "A bed type with this code already exists" });
      return;
    }
    addBedType({
      code: data.code,
      name: data.name,
      daily_rate: data.daily_rate,
      description: data.description,
    });
    setShowModal(false);
    form.reset();
  });

  const addFromTemplate = () => {
    const existingCodes = new Set(bedTypes.map((b) => b.code));
    for (const tmpl of templateBedTypes) {
      if (!existingCodes.has(tmpl.code)) {
        addBedType({
          code: tmpl.code,
          name: tmpl.name,
          daily_rate: tmpl.daily_rate,
        });
        existingCodes.add(tmpl.code);
      }
    }
  };

  const openModal = () => {
    form.reset({ code: "", name: "", daily_rate: 0, description: "" });
    setShowModal(true);
  };

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Configure bed types and daily rates for your hospital. These are used in
        IPD billing and bed management.
      </Text>

      <Group>
        <Button
          variant="light"
          leftSection={<IconPlus size={16} />}
          onClick={openModal}
        >
          Add Bed Type
        </Button>
        <Button variant="subtle" onClick={addFromTemplate}>
          Quick-Add from Template
        </Button>
      </Group>

      {bedTypes.map((bed: OnboardingBedType) => (
        <div key={bed.local_id} className={classes.facilityCard}>
          <div className={classes.facilityInfo}>
            <Text fw={600}>
              <IconBed size={14} style={{ verticalAlign: "middle", marginRight: 4 }} />
              {bed.name}
            </Text>
            <Text size="sm" c="dimmed">
              {bed.code}
              {bed.description && ` — ${bed.description}`}
            </Text>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Text fw={600} c="teal" size="sm">
              ₹{bed.daily_rate}/day
            </Text>
            <ActionIcon
              variant="subtle"
              color="danger"
              onClick={() => removeBedType(bed.local_id)}
              aria-label="Delete"
            >
              <IconTrash size={16} />
            </ActionIcon>
          </div>
        </div>
      ))}

      <Modal
        opened={showModal}
        onClose={() => setShowModal(false)}
        title="Add Bed Type"
      >
        <form onSubmit={handleAdd}>
          <Stack gap="sm">
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
            <Controller
              control={form.control}
              name="daily_rate"
              render={({ field }) => (
                <NumberInput
                  label="Daily Rate"
                  prefix="₹ "
                  min={0}
                  value={field.value}
                  onChange={(v) => field.onChange(Number(v))}
                  error={form.formState.errors.daily_rate?.message}
                />
              )}
            />
            <TextInput
              label="Description"
              {...form.register("description")}
              error={form.formState.errors.description?.message}
            />
            <Button type="submit">Add Bed Type</Button>
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
