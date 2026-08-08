// IPD AssessmentsTab — split from ipd.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Checkbox,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { IpdClinicalAssessmentFormInput } from "@medbrains/schemas";
import { ipdClinicalAssessmentFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { IpdClinicalAssessment } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconAlertTriangle, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Resolver } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import type { BadgeTone } from "@/components/ui";
import { Alert, Badge, Button, Table } from "@/components/ui";
import {
  bradenRiskLevel,
  calculateBradenTotal,
  DEFAULT_IPD_CLINICAL_ASSESSMENT_VALUES,
  IPD_ASSESSMENT_TYPE_OPTIONS,
  IPD_BRADEN_INJURY_ACQUIRED_OPTIONS,
  IPD_BRADEN_INJURY_STAGE_OPTIONS,
  IPD_RISK_LEVEL_OPTIONS,
  normalizeIpdAssessmentType,
  toCreateAssessmentRequest,
} from "@/forms/ipd.form";
import { ipdService } from "@/services/ipd.service";

export function AssessmentsTab({ admissionId }: { admissionId: string }) {
  const canCreate = useHasPermission(P.IPD.ASSESSMENTS_CREATE);
  const queryClient = useQueryClient();
  const [formOpened, formHandlers] = useDisclosure(false);
  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<IpdClinicalAssessmentFormInput>({
    resolver: zodResolver(
      ipdClinicalAssessmentFormSchema,
    ) as Resolver<IpdClinicalAssessmentFormInput>,
    defaultValues: DEFAULT_IPD_CLINICAL_ASSESSMENT_VALUES,
  });
  const assessmentValues = watch();
  const assessmentType = assessmentValues.assessment_type;
  const injuryPresent = assessmentValues.injury_present;

  const { data: assessments = [] } = useQuery<IpdClinicalAssessment[]>({
    queryKey: ["ipd-assessments", admissionId],
    queryFn: () => ipdService.listAssessments(admissionId),
  });

  const bradenTotal = calculateBradenTotal(assessmentValues);
  const bradenRisk = bradenRiskLevel(bradenTotal);

  const mutation = useMutation({
    mutationFn: (values: IpdClinicalAssessmentFormInput) =>
      ipdService.createAssessment(admissionId, toCreateAssessmentRequest(values)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipd-assessments", admissionId] });
      formHandlers.close();
      reset(DEFAULT_IPD_CLINICAL_ASSESSMENT_VALUES);
    },
  });

  const riskColors: Record<string, BadgeTone> = {
    "no risk": "success",
    low: "success",
    mild: "success",
    moderate: "warning",
    high: "warning",
    severe: "danger",
    critical: "danger",
  };

  return (
    <Stack>
      {canCreate && (
        <Button
          tone="primary"
          size="xs"
          leftSection={<IconPlus size={14} />}
          onClick={() => formHandlers.toggle()}
        >
          Add Assessment
        </Button>
      )}
      {formOpened && (
        <Stack
          component="form"
          gap="xs"
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
        >
          <Controller
            control={control}
            name="assessment_type"
            render={({ field }) => (
              <Select
                label="Assessment Type"
                data={IPD_ASSESSMENT_TYPE_OPTIONS}
                value={field.value}
                onChange={(value) => field.onChange(normalizeIpdAssessmentType(value))}
                error={errors.assessment_type?.message}
              />
            )}
          />
          {assessmentType === "braden_scale" ? (
            <>
              <Alert
                tone="warning"
                icon={<IconAlertTriangle size={16} />}
                title="Pressure injury prevention evidence"
              >
                Braden entries are mirrored automatically into the NABH pressure-ulcer evidence
                register. Record all six subscores and any observed injury here.
              </Alert>
              <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
                <Controller
                  control={control}
                  name="sensory_perception"
                  render={({ field }) => (
                    <NumberInput label="Sensory perception" min={1} max={4} {...field} />
                  )}
                />
                <Controller
                  control={control}
                  name="moisture"
                  render={({ field }) => (
                    <NumberInput label="Moisture" min={1} max={4} {...field} />
                  )}
                />
                <Controller
                  control={control}
                  name="activity"
                  render={({ field }) => (
                    <NumberInput label="Activity" min={1} max={4} {...field} />
                  )}
                />
                <Controller
                  control={control}
                  name="mobility"
                  render={({ field }) => (
                    <NumberInput label="Mobility" min={1} max={4} {...field} />
                  )}
                />
                <Controller
                  control={control}
                  name="nutrition"
                  render={({ field }) => (
                    <NumberInput label="Nutrition" min={1} max={4} {...field} />
                  )}
                />
                <Controller
                  control={control}
                  name="friction_shear"
                  render={({ field }) => (
                    <NumberInput label="Friction / shear" min={1} max={3} {...field} />
                  )}
                />
              </SimpleGrid>
              <Group>
                <Badge tone={riskColors[bradenRisk] ?? "neutral"} size="lg">
                  Braden {bradenTotal} · {bradenRisk}
                </Badge>
                <Text size="xs" c="dimmed">
                  Lower score means higher pressure-injury risk.
                </Text>
              </Group>
              <Controller
                control={control}
                name="injury_present"
                render={({ field }) => (
                  <Checkbox
                    label="Pressure injury observed during this assessment"
                    checked={field.value}
                    onChange={(event) => field.onChange(event.currentTarget.checked)}
                  />
                )}
              />
              {injuryPresent && (
                <SimpleGrid cols={{ base: 1, sm: 2 }}>
                  <Controller
                    control={control}
                    name="injury_stage"
                    render={({ field }) => (
                      <Select
                        label="Injury stage"
                        data={IPD_BRADEN_INJURY_STAGE_OPTIONS}
                        value={field.value}
                        onChange={(value) => field.onChange(value ?? "")}
                        clearable
                      />
                    )}
                  />
                  <Controller
                    control={control}
                    name="injury_location"
                    render={({ field }) => <TextInput label="Injury location" {...field} />}
                  />
                  <Controller
                    control={control}
                    name="injury_acquired"
                    render={({ field }) => (
                      <Select
                        label="Acquired"
                        data={IPD_BRADEN_INJURY_ACQUIRED_OPTIONS}
                        value={field.value}
                        onChange={(value) => field.onChange(value ?? "")}
                        clearable
                      />
                    )}
                  />
                  <Controller
                    control={control}
                    name="repositioning_plan"
                    render={({ field }) => <TextInput label="Repositioning plan" {...field} />}
                  />
                  <Controller
                    control={control}
                    name="nutritional_plan"
                    render={({ field }) => <TextInput label="Nutritional plan" {...field} />}
                  />
                  <Controller
                    control={control}
                    name="skin_care_plan"
                    render={({ field }) => <TextInput label="Skin care plan" {...field} />}
                  />
                </SimpleGrid>
              )}
              <Controller
                control={control}
                name="notes"
                render={({ field }) => <Textarea label="Assessment notes" minRows={2} {...field} />}
              />
            </>
          ) : (
            <>
              {assessmentType === "morse_fall_scale" && (
                <Alert
                  tone="warning"
                  icon={<IconAlertTriangle size={16} />}
                  title="Fall prevention source data"
                >
                  Morse scores are used when a fall incident is reported to show whether risk
                  assessment was completed before the fall.
                </Alert>
              )}
              <Controller
                control={control}
                name="score_value"
                render={({ field }) => (
                  <TextInput label="Score" error={errors.score_value?.message} {...field} />
                )}
              />
              <Controller
                control={control}
                name="risk_level"
                render={({ field }) => (
                  <Select
                    label="Risk Level"
                    data={IPD_RISK_LEVEL_OPTIONS}
                    value={field.value}
                    onChange={(value) => field.onChange(value ?? "")}
                    clearable
                  />
                )}
              />
            </>
          )}
          <Button tone="primary" size="xs" type="submit" loading={mutation.isPending}>
            Save
          </Button>
        </Stack>
      )}
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Type</Table.Th>
            <Table.Th>Score</Table.Th>
            <Table.Th>Risk</Table.Th>
            <Table.Th>Date</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {assessments.map((a) => (
            <Table.Tr key={a.id}>
              <Table.Td>
                <Badge size="sm">{a.assessment_type}</Badge>
              </Table.Td>
              <Table.Td>{a.score_value ?? "—"}</Table.Td>
              <Table.Td>
                {a.risk_level ? (
                  <Badge tone={riskColors[a.risk_level] ?? "neutral"} size="sm">
                    {a.risk_level}
                  </Badge>
                ) : (
                  "—"
                )}
              </Table.Td>
              <Table.Td>
                <Text size="xs">{new Date(a.assessed_at).toLocaleString()}</Text>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}

// ── MAR ────────────────────────────────────────────────
