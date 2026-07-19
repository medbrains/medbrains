// PATIENT AllergiesTab — split from patient-detail.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Autocomplete, Group, Loader, Modal, Select, Stack, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { PatientDetailAllergyFormInput } from "@medbrains/schemas";
import { patientDetailAllergyFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { Patient, PatientAllergy } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable } from "@/components/DataTable";
import { DrugSearchSelect } from "@/components/DrugSearchSelect";
import { Alert, Badge, type BadgeTone, Button, IconButton } from "@/components/ui";
import { allergenPresetsFor } from "@/data/allergen-presets";
import {
  DEFAULT_PATIENT_ALLERGY_FORM_VALUES,
  PATIENT_ALLERGY_SEVERITY_OPTIONS,
  PATIENT_ALLERGY_TYPE_OPTIONS,
  toCreatePatientAllergyRequest,
} from "@/forms/patient-detail.form";
import { confirmDestructive } from "@/lib/confirm";
import { statusColor } from "@/lib/status-colors";
import { patientDetailService } from "@/services/patientDetail.service";

function statusBadgeTone(color: string): BadgeTone {
  switch (color) {
    case "primary":
      return "primary";
    case "success":
    case "green":
    case "teal":
    case "lime":
      return "success";
    case "warning":
    case "yellow":
    case "orange":
      return "warning";
    case "danger":
    case "red":
      return "danger";
    case "info":
    case "blue":
    case "cyan":
    case "indigo":
      return "info";
    case "violet":
    case "grape":
    case "pink":
      return "accent";
    default:
      return "neutral";
  }
}

export function AllergiesTab({ patient }: { patient: Patient }) {
  const canUpdate = useHasPermission(P.PATIENTS.UPDATE);
  const queryClient = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PatientDetailAllergyFormInput>({
    resolver: zodResolver(patientDetailAllergyFormSchema),
    defaultValues: DEFAULT_PATIENT_ALLERGY_FORM_VALUES,
  });
  const allergyType = watch("allergy_type");

  const { data: allergies = [], isLoading } = useQuery({
    queryKey: ["patient-allergies", patient.id],
    queryFn: () => patientDetailService.listPatientAllergies(patient.id),
  });

  // Grown allergen catalogue (per-tenant), merged with the curated presets so
  // the picker offers both common allergens and ones this hospital has added.
  const { data: allergenCatalog = [] } = useQuery({
    queryKey: ["allergen-catalog"],
    queryFn: () => patientDetailService.listAllergenCatalog(),
    staleTime: 300_000,
  });
  const allergenOptions = useMemo(() => {
    const fromCatalog = allergenCatalog
      .filter((e) => e.allergy_type === allergyType)
      .map((e) => e.name);
    return Array.from(new Set([...allergenPresetsFor(allergyType), ...fromCatalog])).sort();
  }, [allergenCatalog, allergyType]);

  const createMutation = useMutation({
    mutationFn: (values: PatientDetailAllergyFormInput) =>
      patientDetailService.createPatientAllergy(patient.id, toCreatePatientAllergyRequest(values)),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["patient-allergies", patient.id] });
      void queryClient.invalidateQueries({ queryKey: ["allergen-catalog"] });
      const conflicts = result.active_medication_conflicts;
      if (conflicts.length > 0) {
        notifications.show({
          title: "Active medication conflicts this allergy",
          message: `Review / discontinue: ${conflicts.join(", ")}`,
          color: "orange",
          autoClose: false,
        });
      } else {
        notifications.show({
          title: "Allergy added",
          message: "Allergy recorded",
          color: "success",
        });
      }
      handleClose();
    },
    onError: (err: Error) => {
      notifications.show({ title: "Failed", message: err.message, color: "danger" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (allergyId: string) =>
      patientDetailService.deletePatientAllergy(patient.id, allergyId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["patient-allergies", patient.id] });
      notifications.show({ title: "Removed", message: "Allergy removed", color: "success" });
    },
    onError: (err: Error) => {
      notifications.show({ title: "Failed", message: err.message, color: "danger" });
    },
  });

  const handleClose = () => {
    close();
    reset(DEFAULT_PATIENT_ALLERGY_FORM_VALUES);
  };

  if (isLoading) return <Loader size="sm" />;

  return (
    <Stack gap="md">
      {patient.no_known_allergies && <Alert tone="success">NKDA -- No Known Drug Allergies</Alert>}

      {canUpdate && (
        <Group justify="flex-end">
          <Button tone="primary" leftSection={<IconPlus size={14} />} size="sm" onClick={open}>
            Add Allergy
          </Button>
        </Group>
      )}

      {allergies.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          No allergies recorded.
        </Text>
      ) : (
        <DataTable
          columns={[
            {
              key: "allergen",
              label: "Allergen",
              render: (a: PatientAllergy) => (
                <Text size="sm" fw={500}>
                  {a.allergen_name}
                </Text>
              ),
            },
            {
              key: "type",
              label: "Type",
              render: (a: PatientAllergy) => (
                <Badge size="sm">{a.allergy_type.replace(/_/g, " ")}</Badge>
              ),
            },
            {
              key: "severity",
              label: "Severity",
              render: (a: PatientAllergy) =>
                a.severity ? (
                  <Badge tone={statusBadgeTone(statusColor(a.severity))} size="sm">
                    {a.severity.replace(/_/g, " ")}
                  </Badge>
                ) : (
                  <Text size="sm" c="dimmed">
                    -
                  </Text>
                ),
            },
            {
              key: "reaction",
              label: "Reaction",
              render: (a: PatientAllergy) => <Text size="sm">{a.reaction ?? "-"}</Text>,
            },
            ...(canUpdate
              ? [
                  {
                    key: "actions",
                    label: "",
                    render: (a: PatientAllergy) => (
                      <IconButton
                        tone="danger"
                        size="sm"
                        onClick={() =>
                          confirmDestructive({
                            title: "Delete allergy",
                            message:
                              "Remove this allergy from the patient's record? Allergy history is safety-critical — this cannot be undone.",
                            onConfirm: () => deleteMutation.mutate(a.id),
                          })
                        }
                        loading={deleteMutation.isPending}
                        aria-label="Delete allergy"
                      >
                        <IconTrash size={14} />
                      </IconButton>
                    ),
                  },
                ]
              : []),
          ]}
          data={allergies}
          rowKey={(a) => a.id}
        />
      )}

      <Modal opened={opened} onClose={handleClose} title="Add Allergy" size="md">
        <Stack
          component="form"
          gap="sm"
          onSubmit={handleSubmit((values) => createMutation.mutate(values))}
        >
          <Controller
            name="allergy_type"
            control={control}
            render={({ field }) => (
              <Select
                label="Allergy Type"
                data={PATIENT_ALLERGY_TYPE_OPTIONS}
                value={field.value}
                onChange={(value) => {
                  field.onChange(value ?? "drug");
                  setValue("allergen_name", "");
                }}
                error={errors.allergy_type?.message}
                required
              />
            )}
          />
          {allergyType === "drug" ? (
            <Controller
              name="allergen_name"
              control={control}
              render={({ field }) => (
                <DrugSearchSelect
                  value={field.value}
                  onChange={(_id, drug) => field.onChange(drug?.name ?? "")}
                  label="Drug"
                  required
                />
              )}
            />
          ) : (
            <Controller
              name="allergen_name"
              control={control}
              render={({ field }) => (
                <Autocomplete
                  label="Allergen Name"
                  placeholder="Pick from the list or type a new allergen"
                  data={allergenOptions}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.allergen_name?.message}
                  limit={20}
                  required
                />
              )}
            />
          )}
          {allergyType === "drug" && errors.allergen_name?.message && (
            <Text size="xs" c="danger">
              {errors.allergen_name.message}
            </Text>
          )}
          <Controller
            name="severity"
            control={control}
            render={({ field }) => (
              <Select
                label="Severity"
                data={PATIENT_ALLERGY_SEVERITY_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={errors.severity?.message}
                clearable
              />
            )}
          />
          <Controller
            name="reaction"
            control={control}
            render={({ field }) => (
              <TextInput
                label="Reaction"
                placeholder="e.g., Rash, Anaphylaxis, Itching"
                value={field.value}
                onChange={field.onChange}
                error={errors.reaction?.message}
              />
            )}
          />
          <Group justify="flex-end">
            <Button tone="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button tone="primary" type="submit" loading={createMutation.isPending}>
              Add Allergy
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

// ── Visits Tab ─────────────────────────────────────────────
