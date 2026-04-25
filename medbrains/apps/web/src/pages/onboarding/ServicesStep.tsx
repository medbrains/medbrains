import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { createServiceSchema } from "@medbrains/schemas";
import type { CreateServiceInput } from "@medbrains/schemas";
import { useOnboardingStore } from "@medbrains/stores";
import type { OnboardingService, ServiceType } from "@medbrains/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import classes from "./onboarding.module.scss";

interface Props {
  onNext: () => void;
  onBack: () => void;
}

const serviceTypes = [
  { value: "consultation", label: "Consultation" },
  { value: "procedure", label: "Procedure" },
  { value: "investigation", label: "Investigation" },
  { value: "nursing", label: "Nursing" },
  { value: "diet", label: "Diet" },
  { value: "other", label: "Other" },
];

const templateServices: Array<{ code: string; name: string; service_type: ServiceType; description?: string }> = [
  { code: "GEN-CONSULT", name: "General Consultation", service_type: "consultation", description: "General outpatient consultation" },
  { code: "SPEC-CONSULT", name: "Specialist Consultation", service_type: "consultation", description: "Specialist outpatient consultation" },
  { code: "LAB-INV", name: "Lab Investigation", service_type: "investigation", description: "Laboratory diagnostic tests" },
  { code: "RAD-INV", name: "Radiology", service_type: "investigation", description: "Imaging and radiology services" },
  { code: "NURSING-CARE", name: "Nursing Care", service_type: "nursing", description: "General nursing services" },
  { code: "ROOM-CHARGES", name: "Room Charges", service_type: "other", description: "Room and bed charges" },
];

const typeColors: Record<string, string> = {
  consultation: "primary",
  procedure: "violet",
  investigation: "teal",
  nursing: "danger",
  diet: "orange",
  other: "slate",
};

export function ServicesStep({ onNext, onBack }: Props) {
  const [showModal, setShowModal] = useState(false);
  const services = useOnboardingStore((s) => s.services);
  const addService = useOnboardingStore((s) => s.addService);
  const removeService = useOnboardingStore((s) => s.removeService);

  const form = useForm<CreateServiceInput>({
    resolver: zodResolver(createServiceSchema),
    defaultValues: {
      code: "",
      name: "",
      service_type: "consultation",
      description: "",
    },
  });

  const handleAdd = form.handleSubmit((data) => {
    if (services.some((s) => s.code === data.code)) {
      form.setError("code", { message: "A service with this code already exists" });
      return;
    }
    addService({
      code: data.code,
      name: data.name,
      service_type: data.service_type as ServiceType,
      description: data.description,
    });
    setShowModal(false);
    form.reset();
  });

  const addFromTemplate = () => {
    const existingCodes = new Set(services.map((s) => s.code));
    for (const tmpl of templateServices) {
      if (!existingCodes.has(tmpl.code)) {
        addService({
          code: tmpl.code,
          name: tmpl.name,
          service_type: tmpl.service_type,
          description: tmpl.description,
        });
        existingCodes.add(tmpl.code);
      }
    }
  };

  const openModal = () => {
    form.reset({ code: "", name: "", service_type: "consultation", description: "" });
    setShowModal(true);
  };

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Define the service categories your hospital offers. These are used for billing
        and operational tracking.
      </Text>

      <Group>
        <Button
          variant="light"
          leftSection={<IconPlus size={16} />}
          onClick={openModal}
        >
          Add Service
        </Button>
        <Button variant="subtle" onClick={addFromTemplate}>
          Quick-Add from Template
        </Button>
      </Group>

      {services.map((svc: OnboardingService) => (
        <div key={svc.local_id} className={classes.facilityCard}>
          <div className={classes.facilityInfo}>
            <Text fw={600}>{svc.name}</Text>
            <Text size="sm" c="dimmed">
              {svc.code}
              {svc.description && ` — ${svc.description}`}
            </Text>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Badge variant="light" color={typeColors[svc.service_type] ?? "slate"}>
              {svc.service_type}
            </Badge>
            <ActionIcon
              variant="subtle"
              color="danger"
              onClick={() => removeService(svc.local_id)}
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
        title="Add Service"
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
              name="service_type"
              render={({ field }) => (
                <Select
                  label="Service Type"
                  data={serviceTypes}
                  value={field.value}
                  onChange={(v) => field.onChange(v ?? "consultation")}
                  error={form.formState.errors.service_type?.message}
                />
              )}
            />
            <TextInput
              label="Description"
              {...form.register("description")}
              error={form.formState.errors.description?.message}
            />
            <Button type="submit">Add Service</Button>
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
