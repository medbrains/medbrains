// Create or revise a nursing care plan. The diagnosis is fixed once written;
// goals, interventions and the evaluation are what a shift revises.

import { zodResolver } from "@hookform/resolvers/zod";
import { Stack } from "@mantine/core";
import type { IpdCarePlan } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Resolver } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import { Alert, Input, Modal, TextArea } from "@/components/ui";
import { ipdService } from "@/services/ipd.service";
import {
  CARE_PLAN_DEFAULTS,
  type CarePlanValues,
  carePlanSchema,
  interventionLines,
  toCarePlanRequest,
} from "./nursing-forms";

interface CarePlanFormModalProps {
  admissionId: string;
  /** The plan being revised; absent when writing a new one. */
  plan: IpdCarePlan | null;
  opened: boolean;
  onClose: () => void;
}

function valuesFrom(plan: IpdCarePlan | null): CarePlanValues {
  if (!plan) return CARE_PLAN_DEFAULTS;
  return {
    nursing_diagnosis: plan.nursing_diagnosis,
    goals: plan.goals ?? "",
    interventions: interventionLines(plan.interventions).join("\n"),
    evaluation: plan.evaluation ?? "",
  };
}

export function CarePlanFormModal({ admissionId, plan, opened, onClose }: CarePlanFormModalProps) {
  const queryClient = useQueryClient();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CarePlanValues>({
    resolver: zodResolver(carePlanSchema) as Resolver<CarePlanValues>,
    values: valuesFrom(plan),
  });

  const save = useMutation({
    mutationFn: (values: CarePlanValues) => {
      const request = toCarePlanRequest(values);
      return plan
        ? ipdService.updateCarePlan(admissionId, plan.id, {
            goals: request.goals,
            interventions: request.interventions,
            evaluation: request.evaluation,
          })
        : ipdService.createCarePlan(admissionId, request);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-care-plans", admissionId] });
      onClose();
    },
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={plan ? "Revise care plan" : "New care plan"}
      size="lg"
      primaryAction={{
        label: "Save care plan",
        onClick: () => void handleSubmit((values) => save.mutate(values))(),
        loading: save.isPending,
      }}
      secondaryAction={{ label: "Cancel", onClick: onClose }}
    >
      <Stack gap="sm">
        <Controller
          control={control}
          name="nursing_diagnosis"
          render={({ field }) => (
            <Input
              {...field}
              label="Nursing diagnosis"
              placeholder="e.g. Acute pain related to surgical incision"
              required
              disabled={plan !== null}
              error={errors.nursing_diagnosis?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="goals"
          render={({ field }) => (
            <TextArea {...field} label="Goals" placeholder="What the patient should achieve" />
          )}
        />
        <Controller
          control={control}
          name="interventions"
          render={({ field }) => (
            <TextArea
              {...field}
              label="Interventions"
              description="One per line"
              minRows={4}
              autosize
            />
          )}
        />
        <Controller
          control={control}
          name="evaluation"
          render={({ field }) => (
            <TextArea {...field} label="Evaluation" placeholder="Progress against the goals" />
          )}
        />
        {save.isError && <Alert tone="danger">{save.error.message}</Alert>}
      </Stack>
    </Modal>
  );
}
