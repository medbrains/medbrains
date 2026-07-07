import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type { DentalChartEntry, DentalExam } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import { PatientNameCell } from "@/components/PatientNameCell";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, Button, Drawer, Input, Select, TextArea, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { specialtyService } from "@/services/specialty.service";

const CONDITIONS = [
  "caries",
  "filled",
  "missing",
  "crown",
  "root_canal",
  "implant",
  "extraction_needed",
  "healthy",
  "other",
].map((c) => ({ value: c, label: c.replace(/_/g, " ") }));

const SURFACES = ["mesial", "distal", "occlusal", "buccal", "lingual"].map((s) => ({
  value: s,
  label: s,
}));

const examSchema = z.object({
  patient_id: z.string().min(1, "Patient is required"),
  chief_complaint: z.string().optional(),
  diagnosis: z.string().optional(),
  treatment_plan: z.string().optional(),
});
type ExamForm = z.infer<typeof examSchema>;

const blank = (s?: string) => (s && s.trim() !== "" ? s : undefined);

export function DentalPage() {
  useRequirePermission(P.SPECIALTY.DENTAL.EXAMS_LIST);
  const canCreate = useHasPermission(P.SPECIALTY.DENTAL.EXAMS_CREATE);
  const canChart = useHasPermission(P.SPECIALTY.DENTAL.CHART_CREATE);
  const queryClient = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [detailExam, setDetailExam] = useState<DentalExam | null>(null);
  const [tooth, setTooth] = useState("");
  const [condition, setCondition] = useState<string | null>(null);
  const [surface, setSurface] = useState<string | null>(null);

  const { data: exams = [], isLoading } = useQuery({
    queryKey: ["dental-exams"],
    queryFn: () => specialtyService.listDentalExams(),
  });

  const { data: chart = [] } = useQuery({
    queryKey: ["dental-chart", detailExam?.id],
    queryFn: () => specialtyService.listDentalChart(detailExam?.id ?? ""),
    enabled: !!detailExam,
  });

  const { control, register, handleSubmit, reset, formState } = useForm<ExamForm>({
    resolver: zodResolver(examSchema),
    defaultValues: { patient_id: "" },
  });

  const createExam = useMutation({
    mutationFn: (v: ExamForm) =>
      specialtyService.createDentalExam({
        patient_id: v.patient_id,
        chief_complaint: blank(v.chief_complaint),
        diagnosis: blank(v.diagnosis),
        treatment_plan: blank(v.treatment_plan),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dental-exams"] });
      toast.success("Dental exam created", { title: "Dental" });
      reset({ patient_id: "" });
      close();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not create exam" }),
  });

  const addTooth = useMutation({
    mutationFn: () =>
      specialtyService.createDentalChartEntry(detailExam?.id ?? "", {
        tooth_number: tooth.trim(),
        condition: condition ?? "",
        surface: surface ?? undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dental-chart", detailExam?.id] });
      setTooth("");
      setCondition(null);
      setSurface(null);
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not add tooth" }),
  });

  const columns: Column<DentalExam>[] = [
    {
      key: "patient_id",
      label: "Patient",
      render: (row) => <PatientNameCell patientId={row.patient_id} />,
    },
    {
      key: "chief_complaint",
      label: "Chief complaint",
      render: (row) => row.chief_complaint ?? "—",
    },
    { key: "diagnosis", label: "Diagnosis", render: (row) => row.diagnosis ?? "—" },
    {
      key: "status",
      label: "Status",
      render: (row) => (
        <Badge tone={row.status === "completed" ? "success" : "neutral"}>{row.status}</Badge>
      ),
    },
    {
      key: "created_at",
      label: "Date",
      render: (row) => new Date(row.created_at).toLocaleDateString(),
    },
  ];

  const chartColumns: Column<DentalChartEntry>[] = [
    { key: "tooth_number", label: "Tooth", render: (r) => r.tooth_number },
    {
      key: "condition",
      label: "Condition",
      render: (r) => <Badge tone="neutral">{r.condition.replace(/_/g, " ")}</Badge>,
    },
    { key: "surface", label: "Surface", render: (r) => r.surface ?? "—" },
    { key: "notes", label: "Notes", render: (r) => r.notes ?? "—" },
  ];

  return (
    <Stack gap="md">
      <PageHeader
        title="Dental"
        subtitle="Dental exams + tooth-wise charting (FDI)"
        actions={
          canCreate ? (
            <Button leftSection={<IconPlus size={16} />} onClick={open}>
              New exam
            </Button>
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        data={exams}
        loading={isLoading}
        rowKey={(r) => r.id}
        onRowClick={(r) => setDetailExam(r)}
        emptyTitle="No dental exams yet."
      />

      <Drawer opened={opened} onClose={close} title="New dental exam" position="right" size="md">
        <form onSubmit={handleSubmit((v) => createExam.mutate(v))}>
          <Stack gap="sm">
            <Controller
              control={control}
              name="patient_id"
              render={({ field }) => (
                <PatientSearchSelect
                  label="Patient"
                  value={field.value}
                  onChange={field.onChange}
                  error={formState.errors.patient_id?.message}
                />
              )}
            />
            <Input label="Chief complaint" {...register("chief_complaint")} />
            <TextArea label="Diagnosis" {...register("diagnosis")} />
            <TextArea label="Treatment plan" {...register("treatment_plan")} />
            <Group justify="flex-end">
              <Button tone="secondary" type="button" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" loading={createExam.isPending}>
                Create
              </Button>
            </Group>
          </Stack>
        </form>
      </Drawer>

      <Drawer
        opened={!!detailExam}
        onClose={() => setDetailExam(null)}
        title="Dental chart"
        position="right"
        size="lg"
      >
        {detailExam && (
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              {detailExam.chief_complaint ?? "Exam"} · {detailExam.status}
            </Text>
            {canChart && (
              <Group align="flex-end" gap="xs">
                <Input
                  label="Tooth (FDI)"
                  placeholder="11"
                  value={tooth}
                  onChange={(e) => setTooth(e.currentTarget.value)}
                  style={{ width: 90 }}
                />
                <Select
                  label="Condition"
                  data={CONDITIONS}
                  value={condition}
                  onChange={setCondition}
                  style={{ minWidth: 150 }}
                />
                <Select
                  label="Surface"
                  data={SURFACES}
                  value={surface}
                  onChange={setSurface}
                  clearable
                  style={{ minWidth: 130 }}
                />
                <Button
                  onClick={() => addTooth.mutate()}
                  loading={addTooth.isPending}
                  disabled={!tooth.trim() || !condition}
                >
                  Add
                </Button>
              </Group>
            )}
            <DataTable
              columns={chartColumns}
              data={chart}
              rowKey={(r) => r.id}
              emptyTitle="No teeth charted yet."
            />
          </Stack>
        )}
      </Drawer>
    </Stack>
  );
}
