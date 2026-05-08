// In-place OPD visit creator — replaces the previous flow that
// redirected to /opd?action=new&patient_id=X. Operators reported the
// redirect as a context-loss footgun: they were on the patient detail
// drawer mid-review, clicked "New OPD visit", and ended up on the OPD
// queue page with the patient pre-filtered but no longer visible in
// the same drawer. The modal here keeps them in place, creates the
// encounter, and emits an event so the patient-detail view refetches
// the active encounter.
import { Alert, Button, Group, Modal, Select, Stack, Textarea } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { api } from "@medbrains/api";
import type { CreateEncounterRequest } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DepartmentSelect } from "../DepartmentSelect";
import { DoctorSearchSelect } from "../DoctorSearchSelect";

interface StartOpdVisitModalProps {
  patientId: string;
  patientName: string;
  opened: boolean;
  onClose: () => void;
  /** Called with the new encounter id after success — caller can
   * use it to navigate to a tab or refetch, but no redirect happens
   * by default. */
  onCreated?: (encounterId: string) => void;
}

const VISIT_TYPES = [
  { value: "new", label: "New visit" },
  { value: "follow_up", label: "Follow-up" },
  { value: "review", label: "Review" },
  { value: "emergency", label: "Emergency walk-in" },
  { value: "telemedicine", label: "Telemedicine" },
];

export function StartOpdVisitModal({
  patientId,
  patientName,
  opened,
  onClose,
  onCreated,
}: StartOpdVisitModalProps) {
  const queryClient = useQueryClient();
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [visitType, setVisitType] = useState<string>("new");
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: (data: CreateEncounterRequest) => api.createEncounter(data),
    onSuccess: (result) => {
      notifications.show({
        title: "OPD visit started",
        message: `Token T${String(result.queue.token_number).padStart(3, "0")} for ${patientName}`,
        color: "success",
      });
      // Refetch the active encounter banner on patient-detail + the OPD
      // queue cache so any open OPD page picks up the new entry.
      void queryClient.invalidateQueries({ queryKey: ["patient", patientId] });
      void queryClient.invalidateQueries({ queryKey: ["patient-visits", patientId] });
      void queryClient.invalidateQueries({ queryKey: ["opd-queue"] });
      onCreated?.(result.encounter.id);
      // Reset + close
      setDepartmentId(null);
      setDoctorId(null);
      setVisitType("new");
      setNotes("");
      onClose();
    },
    onError: () => {
      notifications.show({
        title: "Failed to start visit",
        message: "Backend rejected the request. Check department + doctor.",
        color: "danger",
      });
    },
  });

  const submit = () => {
    if (!departmentId) {
      notifications.show({
        title: "Department required",
        message: "Pick the OPD department before starting the visit.",
        color: "danger",
      });
      return;
    }
    mutation.mutate({
      patient_id: patientId,
      department_id: departmentId,
      doctor_id: doctorId ?? undefined,
      visit_type: visitType,
      notes: notes || undefined,
    });
  };

  return (
    <Modal opened={opened} onClose={onClose} title={`New OPD visit — ${patientName}`} size="md">
      <Stack gap="sm">
        <Alert color="primary" variant="light">
          Creates an encounter + queue token in one shot, then opens the current OPD visit record.
        </Alert>

        <DepartmentSelect
          label="Department"
          placeholder="Pick OPD department"
          value={departmentId ?? ""}
          onChange={(v) => setDepartmentId(v || null)}
          required
        />
        <DoctorSearchSelect
          label="Doctor (optional — assigned at consultation if blank)"
          value={doctorId ?? ""}
          onChange={(v) => setDoctorId(v || null)}
        />
        <Select
          label="Visit type"
          data={VISIT_TYPES}
          value={visitType}
          onChange={(v) => setVisitType(v ?? "new")}
        />
        <Textarea
          label="Reason / chief complaint"
          autosize
          minRows={2}
          value={notes}
          onChange={(e) => setNotes(e.currentTarget.value)}
          placeholder="Headache for 3 days, follow-up of HTN, etc."
        />

        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={mutation.isPending}>
            Start visit
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
