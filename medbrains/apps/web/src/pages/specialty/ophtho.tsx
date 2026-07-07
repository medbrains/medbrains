import { zodResolver } from "@hookform/resolvers/zod";
import { Group, SimpleGrid, Stack } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type { OphthoExam } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import { PatientNameCell } from "@/components/PatientNameCell";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, Button, Drawer, Input, NumberField, TextArea, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { specialtyService } from "@/services/specialty.service";

const examSchema = z.object({
  patient_id: z.string().min(1, "Patient is required"),
  visual_acuity_od: z.string().optional(),
  visual_acuity_os: z.string().optional(),
  sphere_od: z.string().optional(),
  sphere_os: z.string().optional(),
  cylinder_od: z.string().optional(),
  cylinder_os: z.string().optional(),
  axis_od: z.number().nullable().optional(),
  axis_os: z.number().nullable().optional(),
  iop_od: z.string().optional(),
  iop_os: z.string().optional(),
  slit_lamp: z.string().optional(),
  fundus: z.string().optional(),
  diagnosis: z.string().optional(),
  plan: z.string().optional(),
});
type ExamForm = z.infer<typeof examSchema>;

const blank = (s?: string) => (s && s.trim() !== "" ? s : undefined);

export function OphthoPage() {
  useRequirePermission(P.SPECIALTY.OPHTHALMOLOGY.EXAMS_LIST);
  const canCreate = useHasPermission(P.SPECIALTY.OPHTHALMOLOGY.EXAMS_CREATE);
  const queryClient = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);

  const { data: exams = [], isLoading } = useQuery({
    queryKey: ["ophtho-exams"],
    queryFn: () => specialtyService.listOphthoExams(),
  });

  const { control, register, handleSubmit, reset, formState } = useForm<ExamForm>({
    resolver: zodResolver(examSchema),
    defaultValues: { patient_id: "" },
  });

  const createMutation = useMutation({
    mutationFn: (v: ExamForm) =>
      specialtyService.createOphthoExam({
        patient_id: v.patient_id,
        visual_acuity_od: blank(v.visual_acuity_od),
        visual_acuity_os: blank(v.visual_acuity_os),
        sphere_od: blank(v.sphere_od),
        sphere_os: blank(v.sphere_os),
        cylinder_od: blank(v.cylinder_od),
        cylinder_os: blank(v.cylinder_os),
        axis_od: v.axis_od ?? undefined,
        axis_os: v.axis_os ?? undefined,
        iop_od: blank(v.iop_od),
        iop_os: blank(v.iop_os),
        slit_lamp: blank(v.slit_lamp),
        fundus: blank(v.fundus),
        diagnosis: blank(v.diagnosis),
        plan: blank(v.plan),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ophtho-exams"] });
      toast.success("Eye exam recorded", { title: "Ophthalmology" });
      reset({ patient_id: "" });
      close();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not save exam" }),
  });

  const columns: Column<OphthoExam>[] = [
    {
      key: "patient_id",
      label: "Patient",
      render: (row) => <PatientNameCell patientId={row.patient_id} />,
    },
    {
      key: "visual_acuity_od",
      label: "VA (OD / OS)",
      render: (row) => `${row.visual_acuity_od ?? "—"} / ${row.visual_acuity_os ?? "—"}`,
    },
    {
      key: "iop_od",
      label: "IOP (OD / OS)",
      render: (row) => `${row.iop_od ?? "—"} / ${row.iop_os ?? "—"}`,
    },
    {
      key: "diagnosis",
      label: "Diagnosis",
      render: (row) => row.diagnosis ?? "—",
    },
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

  return (
    <Stack gap="md">
      <PageHeader
        title="Ophthalmology"
        subtitle="Eye exams — acuity, refraction, IOP, slit-lamp, fundus"
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
        emptyTitle="No eye exams yet."
      />

      <Drawer opened={opened} onClose={close} title="New eye exam" position="right" size="lg">
        <form onSubmit={handleSubmit((v) => createMutation.mutate(v))}>
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

            <SimpleGrid cols={2} spacing="sm">
              <Input
                label="Visual acuity — OD"
                placeholder="6/6"
                {...register("visual_acuity_od")}
              />
              <Input
                label="Visual acuity — OS"
                placeholder="6/6"
                {...register("visual_acuity_os")}
              />
              <Input label="Sphere — OD" placeholder="-1.25" {...register("sphere_od")} />
              <Input label="Sphere — OS" placeholder="-1.25" {...register("sphere_os")} />
              <Input label="Cylinder — OD" placeholder="-0.50" {...register("cylinder_od")} />
              <Input label="Cylinder — OS" placeholder="-0.50" {...register("cylinder_os")} />
              <Controller
                control={control}
                name="axis_od"
                render={({ field }) => (
                  <NumberField
                    label="Axis — OD"
                    value={field.value ?? undefined}
                    onChange={(v) => field.onChange(typeof v === "number" ? v : null)}
                    min={0}
                    max={180}
                  />
                )}
              />
              <Controller
                control={control}
                name="axis_os"
                render={({ field }) => (
                  <NumberField
                    label="Axis — OS"
                    value={field.value ?? undefined}
                    onChange={(v) => field.onChange(typeof v === "number" ? v : null)}
                    min={0}
                    max={180}
                  />
                )}
              />
              <Input label="IOP — OD (mmHg)" placeholder="14" {...register("iop_od")} />
              <Input label="IOP — OS (mmHg)" placeholder="14" {...register("iop_os")} />
            </SimpleGrid>

            <TextArea label="Slit-lamp findings" {...register("slit_lamp")} />
            <TextArea label="Fundus findings" {...register("fundus")} />
            <TextArea label="Diagnosis" {...register("diagnosis")} />
            <TextArea label="Plan" {...register("plan")} />

            <Group justify="flex-end">
              <Button tone="secondary" onClick={close} type="button">
                Cancel
              </Button>
              <Button type="submit" loading={createMutation.isPending}>
                Save exam
              </Button>
            </Group>
          </Stack>
        </form>
      </Drawer>
    </Stack>
  );
}
