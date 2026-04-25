import {
  Accordion,
  ActionIcon,
  Button,
  Grid,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { createDepartmentSchema } from "@medbrains/schemas";
import type { CreateDepartmentInput } from "@medbrains/schemas";
import { useOnboardingStore } from "@medbrains/stores";
import type { OnboardingDepartment, WorkingHours } from "@medbrains/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { IconClock, IconCopy, IconPlus, IconTrash, IconUpload } from "@tabler/icons-react";
import { api } from "@medbrains/api";
import { CsvImportModal } from "../../components";
import classes from "./onboarding.module.scss";

interface Props {
  onNext: () => void;
  onBack: () => void;
}

const departmentTypes = [
  { value: "clinical", label: "Clinical" },
  { value: "pre_clinical", label: "Pre-Clinical" },
  { value: "para_clinical", label: "Para-Clinical" },
  { value: "administrative", label: "Administrative" },
  { value: "support", label: "Support" },
  { value: "academic", label: "Academic" },
];

const weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const defaultDaySchedule = {
  morning: { start: "09:00", end: "13:00" },
  evening: { start: "16:00", end: "20:00" },
};

function makeDefaultWorkingHours(): WorkingHours {
  const wh: WorkingHours = { sunday: null };
  for (const day of weekdays) {
    wh[day] = { ...defaultDaySchedule };
  }
  return wh;
}

const templateDepartments = [
  { code: "GEN-MED", name: "General Medicine", type: "clinical" },
  { code: "GEN-SURG", name: "General Surgery", type: "clinical" },
  { code: "PEDS", name: "Pediatrics", type: "clinical" },
  { code: "OBGYN", name: "Obstetrics & Gynecology", type: "clinical" },
  { code: "ORTHO", name: "Orthopedics", type: "clinical" },
  { code: "ENT", name: "ENT", type: "clinical" },
  { code: "OPHTH", name: "Ophthalmology", type: "clinical" },
  { code: "DERMA", name: "Dermatology", type: "clinical" },
  { code: "RADIO", name: "Radiology", type: "para_clinical" },
  { code: "PATH", name: "Pathology", type: "para_clinical" },
  { code: "MICRO", name: "Microbiology", type: "para_clinical" },
  { code: "PHARMA", name: "Pharmacy", type: "support" },
  { code: "ADMIN", name: "Hospital Administration", type: "administrative" },
  { code: "HR", name: "Human Resources", type: "administrative" },
  { code: "EMERG", name: "Emergency", type: "clinical" },
  { code: "ICU", name: "Intensive Care Unit", type: "clinical" },
];

const clinicalTypes = new Set(["clinical", "pre_clinical"]);

function formatWorkingHours(wh?: WorkingHours): string | null {
  if (!wh) return null;
  const activeDays = weekdays.filter((d) => wh[d] != null);
  if (activeDays.length === 0) return null;

  const first = wh[activeDays[0]!];
  if (!first) return null;
  const parts: string[] = [];
  if (first.morning) parts.push(`${first.morning.start}-${first.morning.end}`);
  if (first.evening) parts.push(`${first.evening.start}-${first.evening.end}`);
  if (parts.length === 0) return null;

  const dayRange = activeDays.length === 6 ? "Mon-Sat" : activeDays.map((d) => d.slice(0, 3)).join(", ");
  return `${dayRange}: ${parts.join(", ")}`;
}

export function DepartmentsStep({ onNext, onBack }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [workingHours, setWorkingHours] = useState<WorkingHours>({});
  const departments = useOnboardingStore((s) => s.departments);
  const addDepartment = useOnboardingStore((s) => s.addDepartment);
  const removeDepartment = useOnboardingStore((s) => s.removeDepartment);

  const form = useForm<CreateDepartmentInput>({
    resolver: zodResolver(createDepartmentSchema),
    defaultValues: {
      code: "",
      name: "",
      department_type: "clinical",
      parent_id: null,
    },
  });

  const watchedType = form.watch("department_type");
  const isClinical = clinicalTypes.has(watchedType);

  const parentOptions = departments.map((d: OnboardingDepartment) => ({
    value: d.local_id,
    label: `${d.name} (${d.department_type.replace(/_/g, " ")})`,
  }));

  const updateDayTime = (day: string, session: "morning" | "evening", field: "start" | "end", value: string) => {
    setWorkingHours((prev) => {
      const dayData = prev[day] ?? {};
      const sessionData = dayData?.[session] ?? { start: "", end: "" };
      return {
        ...prev,
        [day]: {
          ...dayData,
          [session]: { ...sessionData, [field]: value },
        },
      };
    });
  };

  const applyToAllWeekdays = () => {
    const monday = workingHours.monday;
    if (!monday) return;
    setWorkingHours((prev) => {
      const updated = { ...prev };
      for (const day of weekdays) {
        updated[day] = { ...monday };
      }
      return updated;
    });
  };

  const handleAdd = form.handleSubmit((data) => {
    if (departments.some((d) => d.code === data.code)) {
      form.setError("code", { message: "A department with this code already exists" });
      return;
    }
    addDepartment({
      code: data.code,
      name: data.name,
      department_type: data.department_type,
      parent_local_id: data.parent_id ?? undefined,
      working_hours: isClinical ? workingHours : undefined,
    });
    setShowModal(false);
    form.reset();
    setWorkingHours({});
  });

  const addFromTemplate = () => {
    const existingCodes = new Set(departments.map((d) => d.code));
    for (const tmpl of templateDepartments) {
      if (!existingCodes.has(tmpl.code)) {
        addDepartment({
          code: tmpl.code,
          name: tmpl.name,
          department_type: tmpl.type,
          working_hours: clinicalTypes.has(tmpl.type) ? makeDefaultWorkingHours() : undefined,
        });
        existingCodes.add(tmpl.code);
      }
    }
  };

  const openModal = () => {
    form.reset({ code: "", name: "", department_type: "clinical", parent_id: null });
    setWorkingHours(makeDefaultWorkingHours());
    setShowModal(true);
  };

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Add departments for your hospital. You can quick-add from a template or
        create custom departments.
      </Text>

      <Group>
        <Button
          variant="light"
          leftSection={<IconPlus size={16} />}
          onClick={openModal}
        >
          Add Department
        </Button>
        <Button
          variant="subtle"
          onClick={addFromTemplate}
        >
          Quick-Add from Template
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
        title="Import Departments from CSV"
        requiredColumns={["code", "name"]}
        optionalColumns={["type", "parent_code"]}
        onImport={api.importDepartments}
      />

      {departments.map((dept: OnboardingDepartment) => {
        const whSummary = formatWorkingHours(dept.working_hours);
        return (
          <div key={dept.local_id} className={classes.facilityCard}>
            <div className={classes.facilityInfo}>
              <Text fw={600}>{dept.name}</Text>
              <Text size="sm" c="dimmed">
                {dept.code} &middot;{" "}
                {dept.department_type.replace(/_/g, " ")}
                {dept.parent_local_id && " (sub-department)"}
              </Text>
              {whSummary && (
                <Text size="xs" c="teal">
                  <IconClock size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />
                  {whSummary}
                </Text>
              )}
            </div>
            <ActionIcon
              variant="subtle"
              color="danger"
              onClick={() => removeDepartment(dept.local_id)}
              aria-label="Delete"
            >
              <IconTrash size={16} />
            </ActionIcon>
          </div>
        );
      })}

      <Modal
        opened={showModal}
        onClose={() => setShowModal(false)}
        title="Add Department"
        size="lg"
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
              name="department_type"
              render={({ field }) => (
                <Select
                  label="Department Type"
                  data={departmentTypes}
                  value={field.value}
                  onChange={(v) => field.onChange(v ?? "clinical")}
                  error={form.formState.errors.department_type?.message}
                />
              )}
            />
            <Controller
              control={form.control}
              name="parent_id"
              render={({ field }) => (
                <Select
                  label="Parent Department"
                  placeholder="None (top-level)"
                  data={parentOptions}
                  value={field.value ?? null}
                  onChange={field.onChange}
                  clearable
                />
              )}
            />

            {isClinical && (
              <Accordion variant="contained" defaultValue="working-hours">
                <Accordion.Item value="working-hours">
                  <Accordion.Control icon={<IconClock size={16} />}>
                    Working Hours
                  </Accordion.Control>
                  <Accordion.Panel>
                    <Stack gap="xs">
                      <Button
                        variant="subtle"
                        size="xs"
                        leftSection={<IconCopy size={14} />}
                        onClick={applyToAllWeekdays}
                      >
                        Apply Monday to all weekdays
                      </Button>
                      {weekdays.map((day) => (
                        <div key={day}>
                          <Text size="sm" fw={500} tt="capitalize" mb={4}>
                            {day}
                          </Text>
                          <Grid gap="xs">
                            <Grid.Col span={3}>
                              <TextInput
                                size="xs"
                                type="time"
                                label="AM Start"
                                value={workingHours[day]?.morning?.start ?? ""}
                                onChange={(e) => updateDayTime(day, "morning", "start", e.currentTarget.value)}
                              />
                            </Grid.Col>
                            <Grid.Col span={3}>
                              <TextInput
                                size="xs"
                                type="time"
                                label="AM End"
                                value={workingHours[day]?.morning?.end ?? ""}
                                onChange={(e) => updateDayTime(day, "morning", "end", e.currentTarget.value)}
                              />
                            </Grid.Col>
                            <Grid.Col span={3}>
                              <TextInput
                                size="xs"
                                type="time"
                                label="PM Start"
                                value={workingHours[day]?.evening?.start ?? ""}
                                onChange={(e) => updateDayTime(day, "evening", "start", e.currentTarget.value)}
                              />
                            </Grid.Col>
                            <Grid.Col span={3}>
                              <TextInput
                                size="xs"
                                type="time"
                                label="PM End"
                                value={workingHours[day]?.evening?.end ?? ""}
                                onChange={(e) => updateDayTime(day, "evening", "end", e.currentTarget.value)}
                              />
                            </Grid.Col>
                          </Grid>
                        </div>
                      ))}
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>
              </Accordion>
            )}

            <Button type="submit">
              Add Department
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
