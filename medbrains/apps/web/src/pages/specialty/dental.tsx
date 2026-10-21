import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type { DentalExam } from "@medbrains/types";
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
import { Badge, Button, Input, Modal, TextArea, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { specialtyService } from "@/services/specialty.service";
import { ExamDrawer } from "./dental/ExamDrawer";

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
  const queryClient = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [detailExam, setDetailExam] = useState<DentalExam | null>(null);

  const { data: exams = [], isLoading } = useQuery({
    queryKey: ["dental-exams"],
    queryFn: () => specialtyService.listDentalExams(),
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

  return (
    <Stack gap="md">
      <PageHeader
        title="Dental"
        subtitle="Dental exams, the tooth chart (FDI) and treatment plans"
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

      <Modal opened={opened} onClose={close} title="New dental exam" size="md">
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
      </Modal>

      <ExamDrawer exam={detailExam} onClose={() => setDetailExam(null)} />
    </Stack>
  );
}
