/**
 * One eye exam: recorded, corrected while a draft, signed by the doctor, and
 * printed as the spectacle prescription (#231). A signed exam is fixed — a
 * changed prescription is a new exam, so the one the optician holds is never
 * silently rewritten.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { type OphthoExam, P } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { DocumentActions } from "@/components/DocumentActions";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Alert, Button, Drawer, toast } from "@/components/ui";
import { specialtyService } from "@/services/specialty.service";
import { ExamFields } from "./ExamFields";
import { type ExamForm, examSchema, toForm, toWorkup } from "./exam-form";

interface ExamDrawerProps {
  /** null = closed, "new" = record one, an exam = open it. */
  target: OphthoExam | "new" | null;
  /** The patient and visit the screen was opened for, if any. */
  scope: { patientId: string; encounterId: string };
  onClose: () => void;
  onSaved: (exam: OphthoExam) => void;
}

export function ExamDrawer({ target, scope, onClose, onSaved }: ExamDrawerProps) {
  const queryClient = useQueryClient();
  const canCreate = useHasPermission(P.SPECIALTY.OPHTHALMOLOGY.EXAMS_CREATE);
  const canUpdate = useHasPermission(P.SPECIALTY.OPHTHALMOLOGY.EXAMS_UPDATE);
  const canSign = useHasPermission(P.SPECIALTY.OPHTHALMOLOGY.EXAMS_SIGN);
  const exam = target !== null && target !== "new" ? target : null;
  const signed = exam?.signed_at != null;
  const canEdit = exam ? canUpdate && !signed : canCreate;
  const form = useForm<ExamForm>({
    resolver: zodResolver(examSchema),
    values: toForm(exam, scope.patientId),
  });

  const done = (saved: OphthoExam, message: string) => {
    void queryClient.invalidateQueries({ queryKey: ["ophtho-exams"] });
    toast.success(message, { title: "Eye exam" });
    onSaved(saved);
  };
  const save = useMutation({
    mutationFn: (v: ExamForm) =>
      exam
        ? specialtyService.updateOphthoExam(exam.id, toWorkup(v))
        : specialtyService.createOphthoExam({
            ...toWorkup(v),
            patient_id: v.patient_id,
            encounter_id:
              v.patient_id === scope.patientId && scope.encounterId ? scope.encounterId : null,
          }),
    onSuccess: (saved) => done(saved, "Saved"),
  });
  const sign = useMutation({
    mutationFn: async (v: ExamForm) => {
      // Sign what is on the screen: save first, so an edit is not left behind.
      const saved = exam ? await specialtyService.updateOphthoExam(exam.id, toWorkup(v)) : null;
      return specialtyService.signOphthoExam(saved?.id ?? exam?.id ?? "");
    },
    onSuccess: (saved) => done(saved, "Prescription signed"),
  });
  const failure = save.error ?? sign.error;

  return (
    <Drawer
      opened={target !== null}
      onClose={onClose}
      title={exam ? "Eye exam" : "New eye exam"}
      position="right"
      size="xl"
    >
      <form aria-label="Eye exam" noValidate onSubmit={form.handleSubmit((v) => save.mutate(v))}>
        <Stack gap="md">
          {failure && (
            <Alert tone="danger" title="Not saved">
              {(failure as Error).message}
            </Alert>
          )}
          {signed && (
            <Alert tone="success" title="Signed">
              Signed by {exam?.signed_by_name ?? "the doctor"} on{" "}
              {new Date(exam?.signed_at ?? "").toLocaleString()}. To change the prescription, record
              a new exam.
            </Alert>
          )}
          {!exam && (
            <Controller
              control={form.control}
              name="patient_id"
              render={({ field, fieldState }) => (
                <PatientSearchSelect
                  label="Patient"
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldState.error?.message}
                />
              )}
            />
          )}
          <ExamFields control={form.control} readOnly={!canEdit} />
          <Group justify="flex-end" gap="sm">
            {exam && (
              <DocumentActions templateCode="spectacle_prescription" sourceId={exam.id} size="sm" />
            )}
            {canEdit && (
              <Button tone="secondary" type="submit" loading={save.isPending}>
                Save
              </Button>
            )}
            {exam && !signed && canSign && (
              <Button
                tone="primary"
                loading={sign.isPending}
                onClick={form.handleSubmit((v) => sign.mutate(v))}
              >
                Sign prescription
              </Button>
            )}
          </Group>
        </Stack>
      </form>
    </Drawer>
  );
}
