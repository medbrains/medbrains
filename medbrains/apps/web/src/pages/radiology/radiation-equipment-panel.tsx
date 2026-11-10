/**
 * The AERB register of X-ray, CT, fluoroscopy and mammography units. Each
 * unit comes from the biomedical register; this records its licence, eLORA
 * ID, RSO and QA dates, and says what is expired, due or missing.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Select, SimpleGrid, Stack, Text } from "@mantine/core";
import type { RadiationEquipment, SaveRadiationEquipment } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { DataTable } from "@/components";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { QueryError } from "@/components/QueryError";
import { Badge, Button, Input, Modal, toast } from "@/components/ui";
import { radiologyService } from "@/services/radiology.service";

const date = z.union([z.literal(""), z.iso.date("A date")]);
const schema = z
  .object({
    bme_equipment_id: z.string().min(1, "Pick the unit from the biomedical register"),
    modality_id: z.string(),
    aerb_licence_number: z.string().trim(),
    elora_id: z.string().trim(),
    licence_valid_until: date,
    rso_user_id: z.string(),
    qa_agency: z.string().trim(),
    last_qa_date: date,
    qa_due_date: date,
  })
  .refine((v) => !v.last_qa_date || !v.qa_due_date || v.qa_due_date >= v.last_qa_date, {
    path: ["qa_due_date"],
    message: "The next QA cannot be before the last one",
  });
type Form = z.infer<typeof schema>;

function fromUnit(u: RadiationEquipment | null): Form {
  return {
    bme_equipment_id: u?.bme_equipment_id ?? "",
    modality_id: u?.modality_id ?? "",
    aerb_licence_number: u?.aerb_licence_number ?? "",
    elora_id: u?.elora_id ?? "",
    licence_valid_until: u?.licence_valid_until ?? "",
    rso_user_id: u?.rso_user_id ?? "",
    qa_agency: u?.qa_agency ?? "",
    last_qa_date: u?.last_qa_date ?? "",
    qa_due_date: u?.qa_due_date ?? "",
  };
}

/** Only the fields that hold something. */
function toRequest(v: Form): SaveRadiationEquipment {
  const entries = Object.entries(v).filter(([, x]) => x !== "");
  return Object.fromEntries(entries) as unknown as SaveRadiationEquipment;
}

const TEXT_FIELDS = [
  ["aerb_licence_number", "AERB licence number"],
  ["elora_id", "eLORA ID"],
  ["qa_agency", "QA agency"],
] as const;
const DATE_FIELDS = [
  ["licence_valid_until", "Licence valid until"],
  ["last_qa_date", "Last QA"],
  ["qa_due_date", "Next QA due"],
] as const;

function UnitForm({ unit, onClose }: { unit: RadiationEquipment | null; onClose: () => void }) {
  const qc = useQueryClient();
  const assets = useQuery({
    queryKey: ["bme-equipment"],
    queryFn: () => radiologyService.listBmeEquipment({ status: "active" }),
  });
  const modalities = useQuery({
    queryKey: ["radiology-modalities"],
    queryFn: () => radiologyService.listRadiologyModalities(),
  });
  const [rsoEmployee, setRsoEmployee] = useState("");
  const [rsoError, setRsoError] = useState<string | undefined>();
  const { control, handleSubmit } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: fromUnit(unit),
  });
  const save = useMutation({
    mutationFn: (v: Form) => radiologyService.saveRadiationEquipment(toRequest(v)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["radiation-equipment"] });
      toast.success("The register is up to date.", { title: "Unit saved" });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Not saved" }),
  });
  return (
    <Modal opened onClose={onClose} title={unit ? unit.name : "Add a unit"} size="lg">
      <form
        aria-label="Radiation equipment"
        noValidate
        onSubmit={handleSubmit((v) => save.mutate(v))}
      >
        <Stack>
          <Controller
            control={control}
            name="bme_equipment_id"
            render={({ field, fieldState }) => (
              <Select
                label="Unit (from the biomedical register)"
                required
                searchable
                disabled={unit !== null}
                data={(assets.data ?? []).map((a) => ({
                  value: a.id,
                  label: [a.name, a.make, a.model, a.serial_number].filter(Boolean).join(" · "),
                }))}
                value={field.value || null}
                onChange={(v) => field.onChange(v ?? "")}
                error={
                  fieldState.error?.message ??
                  (assets.isError ? "The register didn't load" : undefined)
                }
              />
            )}
          />
          <Controller
            control={control}
            name="modality_id"
            render={({ field }) => (
              <Select
                label="Modality"
                data={(modalities.data ?? []).map((m) => ({
                  value: m.id,
                  label: `${m.code} — ${m.name}`,
                }))}
                value={field.value || null}
                onChange={(v) => field.onChange(v ?? "")}
                clearable
              />
            )}
          />
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            {TEXT_FIELDS.map(([name, label]) => (
              <Controller
                key={name}
                control={control}
                name={name}
                render={({ field }) => <Input label={label} {...field} />}
              />
            ))}
            {DATE_FIELDS.map(([name, label]) => (
              <Controller
                key={name}
                control={control}
                name={name}
                render={({ field, fieldState }) => (
                  <Input label={label} type="date" {...field} error={fieldState.error?.message} />
                )}
              />
            ))}
          </SimpleGrid>
          <Controller
            control={control}
            name="rso_user_id"
            render={({ field }) => (
              <Stack gap={2}>
                <EmployeeSearchSelect
                  label="Radiological Safety Officer"
                  value={rsoEmployee}
                  error={rsoError}
                  onChange={(id, employee) => {
                    setRsoEmployee(id);
                    setRsoError(
                      id && !employee?.user_id ? "This person has no MedBrains login" : undefined,
                    );
                    field.onChange(employee?.user_id ?? "");
                  }}
                />
                {unit?.rso_name && !rsoEmployee && (
                  <Text size="xs">Currently: {unit.rso_name}</Text>
                )}
              </Stack>
            )}
          />
          <Text size="xs" c="dimmed">
            AERB requires a nominated RSO for CT and cath-lab units.
          </Text>
          <Group justify="flex-end">
            <Button tone="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button tone="primary" type="submit" loading={save.isPending}>
              Save
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

export function RadiationEquipmentPanel() {
  const [editing, setEditing] = useState<RadiationEquipment | null | "new">(null);
  const units = useQuery({
    queryKey: ["radiation-equipment"],
    queryFn: () => radiologyService.listRadiationEquipment(),
  });
  if (units.isError) return <QueryError error={units.error} onRetry={() => void units.refetch()} />;
  return (
    <Stack>
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Licence, eLORA and QA for each unit. Expired or missing items are shown first.
        </Text>
        <Button tone="primary" onClick={() => setEditing("new")}>
          Add a unit
        </Button>
      </Group>
      <DataTable
        loading={units.isLoading}
        data={units.data ?? []}
        rowKey={(u) => u.id}
        emptyTitle="No units registered"
        columns={[
          {
            key: "unit",
            label: "Unit",
            render: (u: RadiationEquipment) =>
              [u.name, u.modality_code, u.serial_number].filter(Boolean).join(" · "),
          },
          {
            key: "licence",
            label: "AERB licence",
            render: (u: RadiationEquipment) => u.aerb_licence_number ?? "—",
          },
          {
            key: "valid",
            label: "Valid until",
            render: (u: RadiationEquipment) => u.licence_valid_until ?? "—",
          },
          { key: "qa", label: "Next QA", render: (u: RadiationEquipment) => u.qa_due_date ?? "—" },
          { key: "rso", label: "RSO", render: (u: RadiationEquipment) => u.rso_name ?? "—" },
          {
            key: "alerts",
            label: "Status",
            render: (u: RadiationEquipment) =>
              u.alerts.length === 0 ? (
                <Badge tone="success">In order</Badge>
              ) : (
                <Stack gap={2}>
                  {u.alerts.map((a) => (
                    <Badge key={a.message} tone={a.level === "danger" ? "danger" : "warning"}>
                      {a.message}
                    </Badge>
                  ))}
                </Stack>
              ),
          },
          {
            key: "edit",
            label: "",
            render: (u: RadiationEquipment) => (
              <Button size="xs" tone="ghost" onClick={() => setEditing(u)}>
                Edit
              </Button>
            ),
          },
        ]}
      />
      {editing !== null && (
        <UnitForm unit={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      )}
    </Stack>
  );
}
