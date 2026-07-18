// IPD DischargeSummaryTab — split from ipd.tsx (pure move).

import { useClinicalEmit } from "@/components";
import { Badge, Button, toast } from "@/components/ui";
import { ipdService } from "@/services/ipd.service";
import { Group, Stack, Text, TextInput, Textarea } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import type { CreateDischargeSummaryRequest, IpdDischargeSummary, UpdateDischargeSummaryRequest } from "@medbrains/types";
import { IconPencil } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

export function DischargeSummaryTab({
  admissionId,
  canCreate,
  patientId,
}: {
  admissionId: string;
  canCreate: boolean;
  patientId: string;
}) {
  const emit = useClinicalEmit();
  const canFinalize = useHasPermission(P.IPD.DISCHARGE_SUMMARY_FINALIZE);
  const queryClient = useQueryClient();

  const { data: existing } = useQuery({
    queryKey: ["ipd-discharge-summary", admissionId],
    queryFn: () => ipdService.getDischargeSummary(admissionId).catch(() => null),
  });

  const [finalDiagnosis, setFinalDiagnosis] = useState("");
  const [conditionAtDischarge, setConditionAtDischarge] = useState("");
  const [courseInHospital, setCourseInHospital] = useState("");
  const [treatmentGiven, setTreatmentGiven] = useState("");
  const [investigationSummary, setInvestigationSummary] = useState("");
  const [followUpInstructions, setFollowUpInstructions] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [dietaryAdvice, setDietaryAdvice] = useState("");
  const [activityRestrictions, setActivityRestrictions] = useState("");
  const [warningSigns, setWarningSigns] = useState("");
  const [editing, setEditing] = useState(false);

  const summary = existing as IpdDischargeSummary | null;

  const createMutation = useMutation({
    mutationFn: (d: CreateDischargeSummaryRequest) =>
      ipdService.createDischargeSummary(admissionId, d),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-discharge-summary", admissionId] });
      setEditing(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (d: UpdateDischargeSummaryRequest) =>
      ipdService.updateDischargeSummary(admissionId, d),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-discharge-summary", admissionId] });
      setEditing(false);
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: () => ipdService.finalizeDischargeSummary(admissionId),
    onSuccess: (summary) => {
      emit("ipd.discharge.finalized", {
        admission_id: summary.admission_id,
        finalized_at: summary.finalized_at,
        patient_id: patientId,
        source_record_id: summary.id,
        status: summary.status,
        summary_id: summary.id,
      });
      void queryClient.invalidateQueries({ queryKey: ["ipd-discharge-summary", admissionId] });
      toast.success("Discharge summary finalized", { title: "Finalized" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Cannot finalize" }),
  });

  if (summary && !editing) {
    return (
      <Stack>
        <Group justify="space-between">
          <Badge size="lg" tone={summary.status === "finalized" ? "success" : "warning"}>
            {summary.status}
          </Badge>
          <Group>
            {summary.status === "draft" && canCreate && (
              <Button
                tone="secondary"
                size="xs"
                leftSection={<IconPencil size={14} />}
                onClick={() => {
                  setFinalDiagnosis(summary.final_diagnosis ?? "");
                  setConditionAtDischarge(summary.condition_at_discharge ?? "");
                  setCourseInHospital(summary.course_in_hospital ?? "");
                  setTreatmentGiven(summary.treatment_given ?? "");
                  setInvestigationSummary(summary.investigation_summary ?? "");
                  setFollowUpInstructions(summary.follow_up_instructions ?? "");
                  setFollowUpDate(summary.follow_up_date ?? "");
                  setDietaryAdvice(summary.dietary_advice ?? "");
                  setActivityRestrictions(summary.activity_restrictions ?? "");
                  setWarningSigns(summary.warning_signs ?? "");
                  setEditing(true);
                }}
              >
                Edit
              </Button>
            )}
            {summary.status === "draft" && canFinalize && (
              <Button
                tone="primary"
                size="xs"
                onClick={() => finalizeMutation.mutate()}
                loading={finalizeMutation.isPending}
              >
                Finalize
              </Button>
            )}
          </Group>
        </Group>
        {summary.final_diagnosis && (
          <Text size="sm">
            <b>Diagnosis:</b> {summary.final_diagnosis}
          </Text>
        )}
        {summary.condition_at_discharge && (
          <Text size="sm">
            <b>Condition:</b> {summary.condition_at_discharge}
          </Text>
        )}
        {summary.course_in_hospital && (
          <Text size="sm">
            <b>Course:</b> {summary.course_in_hospital}
          </Text>
        )}
        {summary.treatment_given && (
          <Text size="sm">
            <b>Treatment:</b> {summary.treatment_given}
          </Text>
        )}
        {summary.investigation_summary && (
          <Text size="sm">
            <b>Investigations:</b> {summary.investigation_summary}
          </Text>
        )}
        {summary.follow_up_instructions && (
          <Text size="sm">
            <b>Follow-up:</b> {summary.follow_up_instructions}
          </Text>
        )}
        {summary.follow_up_date && (
          <Text size="sm">
            <b>Follow-up Date:</b> {summary.follow_up_date}
          </Text>
        )}
        {summary.dietary_advice && (
          <Text size="sm">
            <b>Diet:</b> {summary.dietary_advice}
          </Text>
        )}
        {summary.activity_restrictions && (
          <Text size="sm">
            <b>Activity:</b> {summary.activity_restrictions}
          </Text>
        )}
        {summary.warning_signs && (
          <Text size="sm">
            <b>Warning Signs:</b> {summary.warning_signs}
          </Text>
        )}
        {summary.finalized_at && (
          <Text size="xs" c="dimmed">
            Finalized: {new Date(summary.finalized_at).toLocaleString()}
          </Text>
        )}
      </Stack>
    );
  }

  if (!canCreate) {
    return (
      <Text c="dimmed" size="sm">
        No discharge summary. You do not have permission to create one.
      </Text>
    );
  }

  const handleSave = () => {
    const payload = {
      final_diagnosis: finalDiagnosis || undefined,
      condition_at_discharge: conditionAtDischarge || undefined,
      course_in_hospital: courseInHospital || undefined,
      treatment_given: treatmentGiven || undefined,
      investigation_summary: investigationSummary || undefined,
      follow_up_instructions: followUpInstructions || undefined,
      follow_up_date: followUpDate || undefined,
      dietary_advice: dietaryAdvice || undefined,
      activity_restrictions: activityRestrictions || undefined,
      warning_signs: warningSigns || undefined,
    };
    if (summary) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <Stack>
      <Text fw={600} size="sm">
        {summary ? "Edit Discharge Summary" : "Create Discharge Summary"}
      </Text>
      <Textarea
        label="Final Diagnosis"
        value={finalDiagnosis}
        onChange={(e) => setFinalDiagnosis(e.currentTarget.value)}
        autosize
        minRows={2}
      />
      <Textarea
        label="Condition at Discharge"
        value={conditionAtDischarge}
        onChange={(e) => setConditionAtDischarge(e.currentTarget.value)}
      />
      <Textarea
        label="Course in Hospital"
        value={courseInHospital}
        onChange={(e) => setCourseInHospital(e.currentTarget.value)}
        autosize
        minRows={3}
      />
      <Textarea
        label="Treatment Given"
        value={treatmentGiven}
        onChange={(e) => setTreatmentGiven(e.currentTarget.value)}
        autosize
        minRows={2}
      />
      <Textarea
        label="Investigation Summary"
        value={investigationSummary}
        onChange={(e) => setInvestigationSummary(e.currentTarget.value)}
      />
      <Textarea
        label="Follow-up Instructions"
        value={followUpInstructions}
        onChange={(e) => setFollowUpInstructions(e.currentTarget.value)}
      />
      <TextInput
        label="Follow-up Date"
        type="date"
        value={followUpDate}
        onChange={(e) => setFollowUpDate(e.currentTarget.value)}
      />
      <Textarea
        label="Dietary Advice"
        value={dietaryAdvice}
        onChange={(e) => setDietaryAdvice(e.currentTarget.value)}
      />
      <Textarea
        label="Activity Restrictions"
        value={activityRestrictions}
        onChange={(e) => setActivityRestrictions(e.currentTarget.value)}
      />
      <Textarea
        label="Warning Signs"
        value={warningSigns}
        onChange={(e) => setWarningSigns(e.currentTarget.value)}
      />
      <Group>
        <Button
          tone="primary"
          onClick={handleSave}
          loading={createMutation.isPending || updateMutation.isPending}
        >
          Save
        </Button>
        {editing && (
          <Button tone="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        )}
      </Group>
    </Stack>
  );
}

// ── Transfer ───────────────────────────────────────────
