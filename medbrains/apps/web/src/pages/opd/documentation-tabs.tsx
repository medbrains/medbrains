import { Button, Group, Stack } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type {
  Consultation,
  CreateConsultationRequest,
  FamilyHistoryEntry,
  PastMedicalEntry,
  PastSurgicalEntry,
  PhysicalExamination,
  ReviewOfSystems as ROSType,
  SocialHistory,
  UpdateConsultationRequest,
} from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PhysicalExamPanel, ReviewOfSystems, StructuredHistory } from "@/components";
import { opdService } from "@/services/opd.service";
import { toCreateConsultationPayload } from "./consultation-utils";

interface EncounterTabProps {
  encounterId: string;
  canUpdate: boolean;
}

// ── History ──────────────────────────────────────────────

export function HistoryTab({ encounterId, canUpdate }: EncounterTabProps) {
  const queryClient = useQueryClient();

  const { data: consultation } = useQuery({
    queryKey: ["consultation", encounterId],
    queryFn: () => opdService.getConsultation(encounterId).catch(() => null),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateConsultationRequest) =>
      opdService.createConsultation(encounterId, data),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["consultation", encounterId] }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateConsultationRequest) =>
      opdService.updateConsultation(encounterId, (consultation as Consultation).id, data),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["consultation", encounterId] }),
  });

  const handleUpdate = (data: Partial<UpdateConsultationRequest>) => {
    if (consultation) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(toCreateConsultationPayload(data));
    }
  };

  const c = consultation as Consultation | null;

  return (
    <StructuredHistory
      hpi={c?.hpi ?? ""}
      pastMedical={(c?.past_medical_history as PastMedicalEntry[] | null) ?? []}
      pastSurgical={(c?.past_surgical_history as PastSurgicalEntry[] | null) ?? []}
      familyHistory={(c?.family_history as FamilyHistoryEntry[] | null) ?? []}
      socialHistory={(c?.social_history as SocialHistory | null) ?? {}}
      canUpdate={canUpdate}
      onUpdate={handleUpdate}
    />
  );
}

// ── Review of Systems ────────────────────────────────────

export function ROSTab({ encounterId, canUpdate }: EncounterTabProps) {
  const queryClient = useQueryClient();
  const [localRos, setLocalRos] = useState<ROSType>({});
  const [dirty, setDirty] = useState(false);

  const { data: consultation } = useQuery({
    queryKey: ["consultation", encounterId],
    queryFn: () => opdService.getConsultation(encounterId).catch(() => null),
  });

  const c = consultation as Consultation | null;
  const serverRos = (c?.review_of_systems as ROSType | null) ?? {};

  // Initialize local state from server (only when not dirty)
  useState(() => {
    if (!dirty) setLocalRos(serverRos);
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateConsultationRequest) =>
      opdService.createConsultation(encounterId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["consultation", encounterId] });
      setDirty(false);
      notifications.show({ title: "Saved", message: "Review of Systems saved", color: "success" });
    },
    onError: () =>
      notifications.show({ title: "Error", message: "Failed to save ROS", color: "danger" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateConsultationRequest) =>
      opdService.updateConsultation(encounterId, (consultation as Consultation).id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["consultation", encounterId] });
      setDirty(false);
      notifications.show({
        title: "Saved",
        message: "Review of Systems updated",
        color: "success",
      });
    },
    onError: () =>
      notifications.show({ title: "Error", message: "Failed to update ROS", color: "danger" }),
  });

  const handleChange = (ros: ROSType) => {
    setLocalRos(ros);
    setDirty(true);
  };

  const handleSave = () => {
    if (consultation) {
      updateMutation.mutate({ review_of_systems: localRos });
    } else {
      createMutation.mutate({ review_of_systems: localRos });
    }
  };

  return (
    <Stack>
      <ReviewOfSystems
        data={dirty ? localRos : serverRos}
        canUpdate={canUpdate}
        onUpdate={handleChange}
      />
      {canUpdate && (
        <Group justify="flex-end">
          <Button
            onClick={handleSave}
            loading={createMutation.isPending || updateMutation.isPending}
            disabled={!dirty}
          >
            Save Review of Systems
          </Button>
        </Group>
      )}
    </Stack>
  );
}

// ── Physical Examination ─────────────────────────────────

export function PhysicalExamTab({ encounterId, canUpdate }: EncounterTabProps) {
  const queryClient = useQueryClient();

  const { data: consultation } = useQuery({
    queryKey: ["consultation", encounterId],
    queryFn: () => opdService.getConsultation(encounterId).catch(() => null),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateConsultationRequest) =>
      opdService.createConsultation(encounterId, data),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["consultation", encounterId] }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateConsultationRequest) =>
      opdService.updateConsultation(encounterId, (consultation as Consultation).id, data),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["consultation", encounterId] }),
  });

  const handleUpdate = (exam: PhysicalExamination, generalAppearance?: string) => {
    const data: UpdateConsultationRequest = { physical_examination: exam };
    if (generalAppearance !== undefined) data.general_appearance = generalAppearance;
    if (consultation) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(toCreateConsultationPayload(data));
    }
  };

  const c = consultation as Consultation | null;

  return (
    <PhysicalExamPanel
      data={(c?.physical_examination as PhysicalExamination | null) ?? {}}
      generalAppearance={c?.general_appearance ?? ""}
      canUpdate={canUpdate}
      onUpdate={handleUpdate}
    />
  );
}
