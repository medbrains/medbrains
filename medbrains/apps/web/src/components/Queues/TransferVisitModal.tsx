import { Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import type { ModuleToken } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DoctorSearchSelect } from "@/components/DoctorSearchSelect";
import { Button, Modal, Select, toast } from "@/components/ui";

interface TransferVisitModalProps {
  /** The waiting OPD token whose visit moves; null when closed. */
  token: ModuleToken | null;
  departments: { value: string; label: string }[];
  onClose: () => void;
}

/**
 * Move a waiting patient to the department they should have been registered
 * to. They keep their place by arrival; if the new department numbers its own
 * queue, the desk is told the new number to pass on.
 */
export function TransferVisitModal({ token, departments, onClose }: TransferVisitModalProps) {
  const queryClient = useQueryClient();
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [doctorId, setDoctorId] = useState("");

  const close = () => {
    setDepartmentId(null);
    setDoctorId("");
    onClose();
  };

  const move = useMutation({
    mutationFn: () =>
      api.transferEncounter(token?.entity_id ?? "", {
        department_id: departmentId ?? "",
        doctor_id: doctorId || null,
      }),
    onSuccess: (moved) => {
      void queryClient.invalidateQueries({ queryKey: ["token-board"] });
      const place = departments.find((d) => d.value === moved.department_id)?.label;
      const where = place ?? "the new department";
      // A visit keeps its number unless the new department runs its own queue.
      const message = !moved.token_number
        ? "The patient has no token in the new department"
        : moved.token_number === token?.number
          ? `Same number ${moved.token_number} — send the patient to ${where}`
          : `Tell the patient: new number ${moved.token_number}`;
      toast.success(message, { title: `Moved to ${where}` });
      close();
    },
    onError: (error: Error) => toast.error(error.message, { title: "Not moved" }),
  });

  return (
    <Modal opened={Boolean(token)} onClose={close} title={`Move ${token?.number ?? ""}`}>
      <Stack gap="md">
        <Text size="sm">
          For a patient registered to the wrong department. They keep their place by the time they
          arrived.
        </Text>
        <Select
          label="Move to"
          placeholder="Department"
          data={departments.filter((d) => d.value !== token?.scope_id)}
          value={departmentId}
          onChange={setDepartmentId}
          searchable
          data-testid="picker-transfer-department"
        />
        <DoctorSearchSelect
          label="Doctor (optional)"
          placeholder="The new department assigns one"
          value={doctorId}
          onChange={setDoctorId}
          departmentIds={departmentId ? [departmentId] : undefined}
          disabled={!departmentId}
          clearable
        />
        <Button
          tone="primary"
          onClick={() => move.mutate()}
          loading={move.isPending}
          disabled={!departmentId}
          data-testid="btn-confirm-transfer"
        >
          Move patient
        </Button>
      </Stack>
    </Modal>
  );
}
