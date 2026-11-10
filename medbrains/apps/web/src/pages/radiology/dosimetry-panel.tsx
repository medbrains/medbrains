/**
 * Staff TLD dosimetry: each badge reading per monitoring period, and each
 * person's year and five-year totals against the AERB occupational limits
 * (20 mSv a year averaged over five years, 30 mSv in any one year).
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Select, SimpleGrid, Stack, Text } from "@mantine/core";
import type { DosimetryReading, StaffDose } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { DataTable } from "@/components";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { QueryError } from "@/components/QueryError";
import { Badge, Button, Input, Modal, NumberField, toast } from "@/components/ui";
import { radiologyService } from "@/services/radiology.service";

const YEARS_SHOWN = 5;
const MAX_READING_MSV = 1000;

const schema = z
  .object({
    staff_id: z.string().min(1, "Pick the staff member"),
    badge_number: z.string().trim().min(1, "Enter the badge number"),
    period_start: z.iso.date("A date"),
    period_end: z.iso.date("A date"),
    dose_value: z.number({ error: "Enter the reading" }).min(0).max(MAX_READING_MSV),
    notes: z.string().trim(),
  })
  .refine((v) => v.period_end >= v.period_start, {
    path: ["period_end"],
    message: "The period ends before it starts",
  });
type Form = z.infer<typeof schema>;

function RecordReading({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [employee, setEmployee] = useState("");
  const { control, handleSubmit, setValue, formState } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { staff_id: "", badge_number: "", period_start: "", period_end: "", notes: "" },
  });
  const save = useMutation({
    mutationFn: (v: Form) =>
      radiologyService.createRadiologyDosimetry({ ...v, ...(v.notes ? {} : { notes: undefined }) }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ["radiology-dosimetry"] });
      if (r.alerts.length > 0)
        toast.warning(r.alerts[0]?.message ?? "", { title: "Reading recorded — over a limit" });
      else toast.success(`${r.year_msv.toFixed(2)} mSv this year.`, { title: "Reading recorded" });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Not recorded" }),
  });
  return (
    <Modal opened onClose={onClose} title="Record a badge reading">
      <form aria-label="Badge reading" noValidate onSubmit={handleSubmit((v) => save.mutate(v))}>
        <Stack>
          <EmployeeSearchSelect
            label="Staff member"
            required
            value={employee}
            error={formState.errors.staff_id?.message}
            onChange={(id, e) => {
              setEmployee(id);
              setValue("staff_id", e?.user_id ?? "", { shouldValidate: true });
            }}
          />
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Controller
              control={control}
              name="badge_number"
              render={({ field, fieldState }) => (
                <Input
                  label="TLD badge number"
                  required
                  {...field}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="dose_value"
              render={({ field, fieldState }) => (
                <NumberField
                  label="Reading (mSv)"
                  required
                  min={0}
                  decimalScale={3}
                  value={field.value ?? ""}
                  onChange={(v) => field.onChange(typeof v === "number" ? v : undefined)}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="period_start"
              render={({ field, fieldState }) => (
                <Input
                  label="Period from"
                  type="date"
                  required
                  {...field}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="period_end"
              render={({ field, fieldState }) => (
                <Input
                  label="Period to"
                  type="date"
                  required
                  {...field}
                  error={fieldState.error?.message}
                />
              )}
            />
          </SimpleGrid>
          <Controller
            control={control}
            name="notes"
            render={({ field }) => <Input label="Notes" {...field} />}
          />
          <Group justify="flex-end">
            <Button tone="primary" type="submit" loading={save.isPending}>
              Record
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

function alertBadges(s: StaffDose) {
  if (s.alerts.length === 0) return <Badge tone="success">Within limits</Badge>;
  return (
    <Stack gap={2}>
      {s.alerts.map((a) => (
        <Badge key={a.message} tone={a.level === "danger" ? "danger" : "warning"}>
          {a.message}
        </Badge>
      ))}
    </Stack>
  );
}

export function DosimetryPanel() {
  const qc = useQueryClient();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(String(thisYear));
  const [recording, setRecording] = useState(false);
  const data = useQuery({
    queryKey: ["radiology-dosimetry", year],
    queryFn: () => radiologyService.listRadiologyDosimetry(Number(year)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => radiologyService.removeRadiologyDosimetry(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["radiology-dosimetry"] }),
    onError: (e: Error) => toast.error(e.message, { title: "Not removed" }),
  });
  if (data.isError) return <QueryError error={data.error} onRetry={() => void data.refetch()} />;
  return (
    <Stack>
      <Group justify="space-between">
        <Select
          aria-label="Year"
          w={120}
          data={Array.from({ length: YEARS_SHOWN }, (_, i) => String(thisYear - i))}
          value={year}
          onChange={(v) => setYear(v ?? String(thisYear))}
        />
        <Button tone="primary" onClick={() => setRecording(true)}>
          Record a reading
        </Button>
      </Group>
      <Text fw={600} size="sm">
        Staff against the limits
      </Text>
      <DataTable
        loading={data.isLoading}
        data={data.data?.staff ?? []}
        rowKey={(s) => s.staff_id}
        emptyTitle="No readings this year"
        columns={[
          { key: "who", label: "Staff", render: (s: StaffDose) => s.staff_name ?? "—" },
          {
            key: "year",
            label: "This year (mSv)",
            render: (s: StaffDose) => s.year_msv.toFixed(2),
          },
          {
            key: "five",
            label: "Five years (mSv)",
            render: (s: StaffDose) => s.five_year_msv.toFixed(2),
          },
          { key: "n", label: "Readings", render: (s: StaffDose) => String(s.readings) },
          { key: "status", label: "Status", render: alertBadges },
        ]}
      />
      <Text fw={600} size="sm">
        Readings
      </Text>
      <DataTable
        loading={data.isLoading}
        data={data.data?.readings ?? []}
        rowKey={(r) => r.id}
        emptyTitle="No readings this year"
        columns={[
          { key: "who", label: "Staff", render: (r: DosimetryReading) => r.staff_name ?? "—" },
          { key: "badge", label: "Badge", render: (r: DosimetryReading) => r.badge_number },
          {
            key: "period",
            label: "Period",
            render: (r: DosimetryReading) =>
              `${r.monitoring_period_start} – ${r.monitoring_period_end}`,
          },
          {
            key: "dose",
            label: "mSv",
            render: (r: DosimetryReading) => Number(r.dose_value).toFixed(3),
          },
          {
            key: "remove",
            label: "",
            render: (r: DosimetryReading) => (
              <Button size="xs" tone="ghost" onClick={() => remove.mutate(r.id)}>
                Entered in error
              </Button>
            ),
          },
        ]}
      />
      {recording && <RecordReading onClose={() => setRecording(false)} />}
    </Stack>
  );
}
