import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Modal,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import { createFacilitySchema } from "@medbrains/schemas";
import type { CreateFacilityInput } from "@medbrains/schemas";
import { useOnboardingStore } from "@medbrains/stores";
import type { OnboardingFacility } from "@medbrains/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { IconTrash } from "@tabler/icons-react";
import classes from "./onboarding.module.scss";

interface Props {
  onNext: () => void;
  onBack: () => void;
}

const facilityTypeOptions = [
  { value: "medical_college", label: "Medical College" },
  { value: "dental_college", label: "Dental College" },
  { value: "nursing_college", label: "Nursing College" },
  { value: "pharmacy_college", label: "Pharmacy College" },
  { value: "ayush_hospital", label: "AYUSH Hospital" },
  { value: "research_center", label: "Research Center" },
  { value: "blood_bank", label: "Blood Bank" },
  { value: "dialysis_center", label: "Dialysis Center" },
  { value: "trauma_center", label: "Trauma Center" },
  { value: "burn_center", label: "Burn Center" },
  { value: "rehabilitation_center", label: "Rehabilitation Center" },
  { value: "palliative_care", label: "Palliative Care" },
  { value: "psychiatric_hospital", label: "Psychiatric Hospital" },
  { value: "eye_hospital", label: "Eye Hospital" },
  { value: "maternity_hospital", label: "Maternity Hospital" },
  { value: "pediatric_hospital", label: "Pediatric Hospital" },
  { value: "cancer_center", label: "Cancer Center" },
  { value: "cardiac_center", label: "Cardiac Center" },
  { value: "neuro_center", label: "Neuro Center" },
  { value: "diagnostic_center", label: "Diagnostic Center" },
  { value: "telemedicine_hub", label: "Telemedicine Hub" },
  { value: "day_care_center", label: "Day Care Center" },
  { value: "community_health_center", label: "Community Health Center" },
  { value: "primary_health_center", label: "Primary Health Center" },
  { value: "other", label: "Other" },
];

export function FacilitiesStep({ onNext, onBack }: Props) {
  const [showModal, setShowModal] = useState(false);
  const facilities = useOnboardingStore((s) => s.facilities);
  const addFacility = useOnboardingStore((s) => s.addFacility);
  const removeFacility = useOnboardingStore((s) => s.removeFacility);

  const form = useForm<CreateFacilityInput>({
    resolver: zodResolver(createFacilitySchema),
    defaultValues: {
      code: "",
      name: "",
      facility_type: "medical_college",
      parent_id: null,
      shared_billing: true,
      shared_pharmacy: true,
      shared_lab: true,
      shared_hr: true,
    },
  });

  const parentOptions = facilities.map((f: OnboardingFacility) => ({
    value: f.local_id,
    label: `${f.name} (${f.facility_type.replace(/_/g, " ")})`,
  }));

  const handleAdd = form.handleSubmit((data) => {
    // Check for duplicate codes in store
    if (facilities.some((f) => f.code === data.code)) {
      form.setError("code", { message: "A facility with this code already exists" });
      return;
    }
    addFacility({
      code: data.code,
      name: data.name,
      facility_type: data.facility_type as OnboardingFacility["facility_type"],
      parent_local_id: data.parent_id ?? undefined,
      bed_count: data.bed_count ?? undefined,
      shared_billing: data.shared_billing ?? true,
      shared_pharmacy: data.shared_pharmacy ?? true,
      shared_lab: data.shared_lab ?? true,
      shared_hr: data.shared_hr ?? true,
    });
    setShowModal(false);
    form.reset();
  });

  const openModal = () => {
    form.reset({
      code: "",
      name: "",
      facility_type: "medical_college",
      parent_id: null,
      shared_billing: true,
      shared_pharmacy: true,
      shared_lab: true,
      shared_hr: true,
    });
    setShowModal(true);
  };

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        A main hospital facility will be created automatically. Add
        sub-institutions or satellite facilities below.
      </Text>

      <Alert variant="light" color="primary">
        <Text size="sm" fw={600}>Main Hospital</Text>
        <Text size="xs" c="dimmed">MAIN &middot; main hospital (auto-created)</Text>
        <Badge size="xs" mt={4}>Main</Badge>
      </Alert>

      {facilities.map((f: OnboardingFacility) => (
        <div key={f.local_id} className={classes.facilityCard}>
          <div className={classes.facilityInfo}>
            <Text fw={600}>{f.name}</Text>
            <Text size="sm" c="dimmed">
              {f.code} &middot;{" "}
              {f.facility_type.replace(/_/g, " ")}
              {f.parent_local_id && " (sub-institution)"}
            </Text>
          </div>
          <ActionIcon
            variant="subtle"
            color="danger"
            onClick={() => removeFacility(f.local_id)}
            aria-label="Delete"
          >
            <IconTrash size={16} />
          </ActionIcon>
        </div>
      ))}

      <Button variant="light" onClick={openModal}>
        Add Sub-Institution
      </Button>

      <Modal
        opened={showModal}
        onClose={() => setShowModal(false)}
        title="Add Sub-Institution"
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
              name="facility_type"
              render={({ field }) => (
                <Select
                  label="Facility Type"
                  data={facilityTypeOptions}
                  value={field.value}
                  onChange={(v) => field.onChange(v ?? "medical_college")}
                  error={form.formState.errors.facility_type?.message}
                />
              )}
            />
            <Controller
              control={form.control}
              name="parent_id"
              render={({ field }) => (
                <Select
                  label="Parent Facility"
                  placeholder="None (under Main Hospital)"
                  data={parentOptions}
                  value={field.value ?? null}
                  onChange={field.onChange}
                  clearable
                />
              )}
            />
            <Controller
              control={form.control}
              name="shared_billing"
              render={({ field }) => (
                <Switch
                  label="Shared Billing"
                  checked={field.value ?? true}
                  onChange={(e) => field.onChange(e.currentTarget.checked)}
                />
              )}
            />
            <Controller
              control={form.control}
              name="shared_pharmacy"
              render={({ field }) => (
                <Switch
                  label="Shared Pharmacy"
                  checked={field.value ?? true}
                  onChange={(e) => field.onChange(e.currentTarget.checked)}
                />
              )}
            />
            <Controller
              control={form.control}
              name="shared_lab"
              render={({ field }) => (
                <Switch
                  label="Shared Lab"
                  checked={field.value ?? true}
                  onChange={(e) => field.onChange(e.currentTarget.checked)}
                />
              )}
            />
            <Controller
              control={form.control}
              name="shared_hr"
              render={({ field }) => (
                <Switch
                  label="Shared HR"
                  checked={field.value ?? true}
                  onChange={(e) => field.onChange(e.currentTarget.checked)}
                />
              )}
            />
            <Button type="submit">
              Add Facility
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
