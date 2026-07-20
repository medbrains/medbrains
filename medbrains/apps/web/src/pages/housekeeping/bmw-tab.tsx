// IPD BmwTab — split from housekeeping.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Box,
  Card,
  Drawer,
  Group,
  Modal,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { BmwTransportManifestFormInput } from "@medbrains/schemas";
import { bmwTransportManifestFormSchema } from "@medbrains/schemas";
import type {
  BiowasteRecord,
  BmwScheduleEntry,
  CreateBiowasteRecordRequest,
  SharpReplacementRequest,
  WasteCategoryType,
} from "@medbrains/types";
import { IconAlertTriangle, IconTruck } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable } from "@/components";
import { DepartmentSelect } from "@/components/DepartmentSelect";
import type { BadgeTone } from "@/components/ui";
import { Alert, Badge, Button } from "@/components/ui";
import {
  type CreateBiowasteRecordInput,
  housekeepingService,
} from "@/services/housekeeping.service";

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function formNumber(value: string | number): number {
  return typeof value === "number" ? value : Number(value);
}

const BMW_CATEGORY_META: Record<
  WasteCategoryType,
  { color: string; mantineColor: BadgeTone; label: string; description: string }
> = {
  yellow: {
    color: "#FFC107",
    mantineColor: "warning",
    label: "Yellow",
    description: "Human anatomical waste, animal waste, expired medicines",
  },
  red: {
    color: "#F44336",
    mantineColor: "danger",
    label: "Red",
    description: "Contaminated waste (recyclable), blood-soaked items, tubing, catheters",
  },
  white_translucent: {
    color: "#90A4AE",
    mantineColor: "neutral",
    label: "White (Translucent)",
    description: "Sharps waste — needles, syringes, blades, broken glass",
  },
  blue: {
    color: "#2196F3",
    mantineColor: "primary",
    label: "Blue",
    description: "Glassware, metallic body implants, contaminated glass",
  },
  cytotoxic: {
    color: "#9C27B0",
    mantineColor: "accent",
    label: "Cytotoxic",
    description: "Cytotoxic drug vials, contaminated items from chemo",
  },
  chemical: {
    color: "#FF9800",
    mantineColor: "warning",
    label: "Chemical",
    description: "Discarded chemicals, liquid waste from lab",
  },
  radioactive: {
    color: "#795548",
    mantineColor: "accent",
    label: "Radioactive",
    description: "Radioactive waste from imaging / nuclear medicine",
  },
};

const BMW_CATEGORIES: WasteCategoryType[] = [
  "yellow",
  "red",
  "white_translucent",
  "blue",
  "cytotoxic",
  "chemical",
  "radioactive",
];

function createEmptyBmwManifestForm(): BmwTransportManifestFormInput {
  return {
    department_id: "",
    waste_category: "yellow",
    weight_kg: 0,
    record_date: todayIsoDate(),
    container_count: 1,
    disposal_vendor: "",
    manifest_number: `BMW-${Date.now()}`,
    vehicle_number: "",
    driver_name: "",
    handover_person: "",
    notes: "",
  };
}

function bmwManifestToPayload(form: BmwTransportManifestFormInput): CreateBiowasteRecordInput {
  const notesWithTransport = [
    form.notes,
    `Vehicle: ${form.vehicle_number}`,
    `Driver: ${form.driver_name}`,
    `Handover: ${form.handover_person}`,
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    department_id: form.department_id.trim(),
    waste_category: form.waste_category,
    weight_kg: formNumber(form.weight_kg),
    record_date: form.record_date,
    container_count: formNumber(form.container_count),
    disposal_vendor: form.disposal_vendor.trim(),
    manifest_number: form.manifest_number.trim(),
    notes: notesWithTransport,
  };
}

export function BmwTab({ canCreate }: { canCreate: boolean }) {
  const qc = useQueryClient();
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [manifestDrawer, manifestDrawerH] = useDisclosure(false);
  const [sharpModalOpen, sharpModalH] = useDisclosure(false);
  const [sharpForm, setSharpForm] = useState<{
    location_id: string;
    container_type: string;
    notes: string;
  }>({
    location_id: "",
    container_type: "",
    notes: "",
  });
  const {
    control: manifestControl,
    formState: { errors: manifestErrors },
    handleSubmit: handleManifestSubmit,
    register: registerManifest,
    reset: resetManifest,
  } = useForm<BmwTransportManifestFormInput>({
    resolver: zodResolver(bmwTransportManifestFormSchema),
    defaultValues: createEmptyBmwManifestForm(),
  });

  const biowasteQ = useQuery({
    queryKey: ["housekeeping", "biowaste", catFilter],
    queryFn: () =>
      housekeepingService.listBiowasteRecords({ waste_category: catFilter ?? undefined }),
  });

  const createBiowasteMut = useMutation({
    mutationFn: (data: CreateBiowasteRecordRequest) =>
      housekeepingService.createBiowasteRecord(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["housekeeping", "biowaste"] });
      void qc.invalidateQueries({ queryKey: ["housekeeping", "bmw-schedule"] });
      manifestDrawerH.close();
      notifications.show({
        title: "Transport Manifest Saved",
        message: "BMW record and NABH evidence updated",
        color: "success",
      });
      resetManifest(createEmptyBmwManifestForm());
    },
  });

  const bmwScheduleQ = useQuery({
    queryKey: ["housekeeping", "bmw-schedule"],
    queryFn: () => housekeepingService.getBmwSchedule(),
  });

  const sharpReplacementMut = useMutation({
    mutationFn: (data: SharpReplacementRequest) => housekeepingService.createSharpReplacement(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["housekeeping", "bmw-schedule"] });
      sharpModalH.close();
      setSharpForm({ location_id: "", container_type: "", notes: "" });
      notifications.show({
        title: "Sharp Container Replaced",
        message: "Replacement record and NABH evidence updated",
        color: "success",
      });
    },
  });

  const records = biowasteQ.data ?? [];

  // Compute segregation summary per category
  const segregationSummary = BMW_CATEGORIES.map((cat) => {
    const catRecords = records.filter((r) => r.waste_category === cat);
    const totalWeight = catRecords.reduce((sum, r) => sum + r.weight_kg, 0);
    const totalContainers = catRecords.reduce((sum, r) => sum + r.container_count, 0);
    const hasManifest = catRecords.filter((r) => r.manifest_number).length;
    const meta = BMW_CATEGORY_META[cat];
    return { cat, meta, count: catRecords.length, totalWeight, totalContainers, hasManifest };
  });

  const openManifestDrawer = () => {
    resetManifest(createEmptyBmwManifestForm());
    manifestDrawerH.open();
  };

  const closeManifestDrawer = () => {
    resetManifest(createEmptyBmwManifestForm());
    manifestDrawerH.close();
  };

  const submitManifest = handleManifestSubmit((values) => {
    createBiowasteMut.mutate(bmwManifestToPayload(values));
  });

  return (
    <Stack gap="lg">
      {/* Segregation Checklist */}
      <Text fw={600} size="lg">
        BMW Segregation Overview
      </Text>
      <Alert icon={<IconAlertTriangle size={16} />} tone="warning" title="CPCB BMW Rules 2016">
        All biomedical waste must be segregated at source into color-coded containers as per
        Biomedical Waste Management Rules, 2016. Saved manifests and sharp-container replacements
        now mirror automatically into the NABH BMW disposal log.
      </Alert>
      <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="md">
        {segregationSummary.map(
          ({ cat, meta, count, totalWeight, totalContainers, hasManifest }) => (
            <Card
              key={cat}
              shadow="xs"
              padding="md"
              radius="md"
              withBorder
              style={{ borderLeft: `4px solid ${meta.color}` }}
            >
              <Group justify="space-between" mb="xs">
                <Badge tone={meta.mantineColor} variant="filled" size="lg">
                  {meta.label}
                </Badge>
                <Text size="xs" c="dimmed">
                  {count} record(s)
                </Text>
              </Group>
              <Text size="xs" c="dimmed" mb="sm">
                {meta.description}
              </Text>
              <Group gap="lg">
                <Box>
                  <Text size="xs" c="dimmed">
                    Weight
                  </Text>
                  <Text fw={600}>{totalWeight.toFixed(2)} kg</Text>
                </Box>
                <Box>
                  <Text size="xs" c="dimmed">
                    Containers
                  </Text>
                  <Text fw={600}>{totalContainers}</Text>
                </Box>
                <Box>
                  <Text size="xs" c="dimmed">
                    Manifests
                  </Text>
                  <Text
                    fw={600}
                    c={
                      hasManifest === count && count > 0
                        ? "success"
                        : count > 0
                          ? "danger"
                          : "dimmed"
                    }
                  >
                    {hasManifest}/{count}
                  </Text>
                </Box>
              </Group>
            </Card>
          ),
        )}
      </SimpleGrid>

      {/* BMW Records Table */}
      <Group justify="space-between">
        <Group gap="sm">
          <Text fw={600} size="lg">
            BMW Records
          </Text>
          <Select
            placeholder="Filter by category"
            data={BMW_CATEGORIES.map((c) => ({ value: c, label: BMW_CATEGORY_META[c].label }))}
            value={catFilter}
            onChange={setCatFilter}
            clearable
            w={200}
            size="xs"
          />
        </Group>
        {canCreate && (
          <Button
            tone="primary"
            leftSection={<IconTruck size={16} />}
            size="xs"
            onClick={openManifestDrawer}
          >
            Transport Manifest
          </Button>
        )}
      </Group>
      <DataTable
        data={records}
        loading={biowasteQ.isLoading}
        rowKey={(r: BiowasteRecord) => r.id}
        columns={[
          {
            key: "category_indicator",
            label: "",
            render: (r: BiowasteRecord) => {
              const meta = BMW_CATEGORY_META[r.waste_category];
              return (
                <Box
                  style={{
                    width: 8,
                    height: 32,
                    borderRadius: 0,
                    backgroundColor: meta?.color ?? "#999",
                  }}
                />
              );
            },
          },
          {
            key: "waste_category",
            label: "Category",
            render: (r: BiowasteRecord) => {
              const meta = BMW_CATEGORY_META[r.waste_category];
              return (
                <Badge tone={meta?.mantineColor ?? "neutral"} variant="filled">
                  {meta?.label ?? r.waste_category}
                </Badge>
              );
            },
          },
          {
            key: "weight_kg",
            label: "Weight (kg)",
            render: (r: BiowasteRecord) => String(r.weight_kg),
          },
          {
            key: "container_count",
            label: "Containers",
            render: (r: BiowasteRecord) => String(r.container_count),
          },
          {
            key: "record_date",
            label: "Date",
            render: (r: BiowasteRecord) => new Date(r.record_date).toLocaleDateString(),
          },
          {
            key: "disposal_vendor",
            label: "Vendor",
            render: (r: BiowasteRecord) => r.disposal_vendor ?? "-",
          },
          {
            key: "manifest_number",
            label: "Manifest #",
            render: (r: BiowasteRecord) =>
              r.manifest_number ? (
                <Badge tone="success" leftSection={<IconTruck size={12} />}>
                  {r.manifest_number}
                </Badge>
              ) : (
                <Badge tone="danger">No manifest</Badge>
              ),
          },
          {
            key: "evidence_status",
            label: "Evidence",
            render: (r: BiowasteRecord) =>
              r.disposal_vendor && r.manifest_number ? (
                <Badge tone="success">NABH ready</Badge>
              ) : (
                <Badge tone="warning">Needs manifest</Badge>
              ),
          },
        ]}
      />

      {/* BMW Collection Schedule */}
      <Group justify="space-between">
        <Text fw={600} size="lg">
          BMW Collection Schedule
        </Text>
        {canCreate && (
          <Button
            tone="primary"
            leftSection={<IconAlertTriangle size={16} />}
            size="xs"
            onClick={sharpModalH.open}
          >
            Replace Sharp Container
          </Button>
        )}
      </Group>
      <DataTable
        data={bmwScheduleQ.data ?? []}
        loading={bmwScheduleQ.isLoading}
        rowKey={(r: BmwScheduleEntry) => `${r.ward}-${r.category}`}
        columns={[
          {
            key: "category",
            label: "Waste Category",
            render: (r: BmwScheduleEntry) => {
              const bmwColorMap: Record<string, BadgeTone> = {
                yellow: "warning",
                red: "danger",
                blue: "primary",
                white_translucent: "neutral",
                cytotoxic: "accent",
                chemical: "warning",
                radioactive: "accent",
              };
              return (
                <Badge tone={bmwColorMap[r.category] ?? "neutral"} variant="filled">
                  {r.category.replace(/_/g, " ")}
                </Badge>
              );
            },
          },
          { key: "ward", label: "Ward", render: (r: BmwScheduleEntry) => r.ward },
          {
            key: "record_count",
            label: "Records",
            render: (r: BmwScheduleEntry) => String(r.record_count),
          },
          {
            key: "latest_collection",
            label: "Last Collection",
            render: (r: BmwScheduleEntry) =>
              r.latest_collection ? new Date(r.latest_collection).toLocaleDateString() : "Never",
          },
          {
            key: "total_weight_kg",
            label: "Total (kg)",
            render: (r: BmwScheduleEntry) => r.total_weight_kg.toFixed(2),
          },
        ]}
      />

      {/* Sharp Container Replacement Modal */}
      <Modal
        opened={sharpModalOpen}
        onClose={sharpModalH.close}
        title="Replace Sharp Container"
        centered
      >
        <Stack>
          <DepartmentSelect
            label="Department"
            required
            value={sharpForm.location_id}
            onChange={(departmentId) => setSharpForm({ ...sharpForm, location_id: departmentId })}
          />
          <Select
            label="Container Type"
            placeholder="Select container type"
            data={[
              { value: "needle_cutter", label: "Needle Cutter Box" },
              { value: "sharp_bin_1l", label: "Sharp Bin (1L)" },
              { value: "sharp_bin_5l", label: "Sharp Bin (5L)" },
              { value: "sharp_bin_10l", label: "Sharp Bin (10L)" },
            ]}
            value={sharpForm.container_type}
            onChange={(v) => setSharpForm({ ...sharpForm, container_type: v ?? "" })}
            clearable
          />
          <Textarea
            label="Notes"
            placeholder="Reason for replacement, condition of old container..."
            value={sharpForm.notes}
            onChange={(e) => setSharpForm({ ...sharpForm, notes: e.currentTarget.value })}
            minRows={3}
          />
          <Button
            tone="primary"
            onClick={() => {
              if (!sharpForm.location_id) return;
              sharpReplacementMut.mutate({
                location_id: sharpForm.location_id,
                container_type: sharpForm.container_type || undefined,
                notes: sharpForm.notes || undefined,
              });
            }}
            loading={sharpReplacementMut.isPending}
          >
            Confirm Replacement
          </Button>
        </Stack>
      </Modal>

      {/* Transport Manifest Drawer */}
      <Drawer
        opened={manifestDrawer}
        onClose={closeManifestDrawer}
        title="BMW Transport Manifest"
        position="right"
        size="lg"
      >
        <Stack component="form" onSubmit={submitManifest}>
          <Alert icon={<IconTruck size={16} />} tone="info" title="Transport Documentation">
            Complete all fields for BMW transport compliance. Saving this source record updates the
            NABH BMW disposal evidence register; no separate compliance capture is needed.
          </Alert>
          <TextInput
            label="Manifest Number"
            error={manifestErrors.manifest_number?.message}
            {...registerManifest("manifest_number")}
            required
          />
          <Controller
            control={manifestControl}
            name="department_id"
            render={({ field }) => (
              <DepartmentSelect
                label="Department"
                required
                value={field.value}
                onChange={field.onChange}
                error={manifestErrors.department_id?.message}
              />
            )}
          />
          <Controller
            name="waste_category"
            control={manifestControl}
            render={({ field }) => (
              <Select
                label="Waste Category"
                data={BMW_CATEGORIES.map((c) => ({
                  value: c,
                  label: `${BMW_CATEGORY_META[c].label} - ${BMW_CATEGORY_META[c].description}`,
                }))}
                value={field.value}
                onChange={field.onChange}
                error={manifestErrors.waste_category?.message}
                required
              />
            )}
          />
          <Group grow>
            <Controller
              name="weight_kg"
              control={manifestControl}
              render={({ field }) => (
                <NumberInput
                  label="Weight (kg)"
                  value={field.value}
                  onChange={field.onChange}
                  error={manifestErrors.weight_kg?.message}
                  decimalScale={3}
                  min={0}
                  required
                />
              )}
            />
            <Controller
              name="container_count"
              control={manifestControl}
              render={({ field }) => (
                <NumberInput
                  label="Container Count"
                  value={field.value}
                  onChange={field.onChange}
                  error={manifestErrors.container_count?.message}
                  min={1}
                  required
                />
              )}
            />
          </Group>
          <TextInput
            label="Pickup Date"
            type="date"
            error={manifestErrors.record_date?.message}
            {...registerManifest("record_date")}
            required
          />
          <TextInput
            label="Vehicle Number"
            error={manifestErrors.vehicle_number?.message}
            {...registerManifest("vehicle_number")}
            placeholder="e.g. KA-01-AB-1234"
            required
          />
          <TextInput
            label="Driver Name"
            error={manifestErrors.driver_name?.message}
            {...registerManifest("driver_name")}
            required
          />
          <TextInput
            label="Disposal Vendor / CBWTF"
            error={manifestErrors.disposal_vendor?.message}
            {...registerManifest("disposal_vendor")}
            placeholder="Common Bio-Medical Waste Treatment Facility"
            required
          />
          <TextInput
            label="Handover Person"
            error={manifestErrors.handover_person?.message}
            {...registerManifest("handover_person")}
            placeholder="Person handing over waste"
            required
          />
          <Textarea
            label="Notes"
            error={manifestErrors.notes?.message}
            {...registerManifest("notes")}
            placeholder="Additional transport notes"
          />
          <Button
            tone="primary"
            type="submit"
            loading={createBiowasteMut.isPending}
            leftSection={<IconTruck size={16} />}
          >
            Save Transport Manifest
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}
