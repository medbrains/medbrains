import { zodResolver } from "@hookform/resolvers/zod";
import { Card, Divider, Group, Stack, Text } from "@mantine/core";
import { refineBloodPressure } from "@medbrains/schemas";
import { useHasAnyPermission } from "@medbrains/stores";
import type { TransfusionObservation } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { BloodPressureField } from "@/components";
import {
  Alert,
  Badge,
  Button,
  Modal,
  NumberField,
  Select,
  Switch,
  TextArea,
  toast,
} from "@/components/ui";
import { bloodBankService } from "@/services/bloodBank.service";

const PHASE_OPTIONS = [
  { value: "baseline", label: "Baseline (pre-transfusion)" },
  { value: "fifteen_min", label: "15 minutes" },
  { value: "periodic", label: "Periodic" },
  { value: "completion", label: "Completion" },
];

const PHASE_LABEL: Record<string, string> = {
  baseline: "Baseline",
  fifteen_min: "15 min",
  periodic: "Periodic",
  completion: "Completion",
};

const observationSchema = z
  .object({
    phase: z.enum(["baseline", "fifteen_min", "periodic", "completion"]),
    temperature_c: z.number().min(30).max(45).optional(),
    pulse: z.number().int().min(0).max(300).optional(),
    systolic_bp: z.number().optional(),
    diastolic_bp: z.number().optional(),
    respiratory_rate: z.number().int().min(0).max(80).optional(),
    adverse_signs: z.boolean(),
    notes: z.string().optional(),
  })
  .superRefine(refineBloodPressure("systolic_bp", "diastolic_bp"));
type ObservationForm = z.infer<typeof observationSchema>;

function vitalsSummary(o: TransfusionObservation): string {
  const parts: string[] = [];
  if (o.temperature_c != null) parts.push(`T ${o.temperature_c} °C`);
  if (o.pulse != null) parts.push(`P ${o.pulse}`);
  if (o.systolic_bp != null && o.diastolic_bp != null)
    parts.push(`BP ${o.systolic_bp}/${o.diastolic_bp}`);
  if (o.respiratory_rate != null) parts.push(`RR ${o.respiratory_rate}`);
  return parts.length ? parts.join(" · ") : "No vitals recorded";
}

interface Props {
  transfusionId: string | null;
  onClose: () => void;
}

/** Bedside transfusion monitoring — record and review interval vitals (baseline / 15 min / periodic
 *  / completion). The server flags an observation that suggests an acute reaction (fever or adverse
 *  signs) so the transfusion is stopped and worked up. */
export function TransfusionMonitorDrawer({ transfusionId, onClose }: Props) {
  // Transfusion observations are the vital-sign trace taken DURING a transfusion.
  // An empty trace reads as "nobody monitored this patient".
  // Same either-side codes the server takes: the bank's, or the bedside nurse's.
  const canListTransfusions = useHasAnyPermission([
    P.NURSE.TRANSFUSION_VIEW,
    P.BLOOD_BANK.TRANSFUSION_LIST,
  ]);
  const canRecord = useHasAnyPermission([
    P.NURSE.TRANSFUSION_ADMINISTER,
    P.BLOOD_BANK.TRANSFUSION_CREATE,
  ]);

  const qc = useQueryClient();
  const opened = transfusionId !== null;

  const {
    data: observations,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["blood-bank", "transfusion-observations", transfusionId],
    queryFn: () => bloodBankService.listTransfusionObservations(transfusionId ?? ""),
    enabled: opened && canListTransfusions,
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ObservationForm>({
    resolver: zodResolver(observationSchema),
    defaultValues: { phase: "baseline", adverse_signs: false },
  });

  const recordMut = useMutation({
    mutationFn: (values: ObservationForm) =>
      bloodBankService.recordTransfusionObservation(transfusionId ?? "", values),
    onSuccess: (created) => {
      void qc.invalidateQueries({
        queryKey: ["blood-bank", "transfusion-observations", transfusionId],
      });
      reset({ phase: "periodic", adverse_signs: false });
      if (created.reaction_suspected) {
        toast.warning(
          "Possible transfusion reaction — stop the transfusion and assess the patient.",
          {
            title: "Reaction suspected",
          },
        );
      } else {
        toast.success("Observation recorded");
      }
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not record observation" }),
  });

  const anyReaction = observations?.some((o) => o.reaction_suspected) ?? false;

  return (
    <Modal opened={opened} onClose={onClose} title="Transfusion monitoring" fullScreen>
      <Stack gap="md">
        {anyReaction && (
          <Alert tone="danger" title="Reaction suspected">
            One or more observations show a fever or adverse signs. Confirm the transfusion was
            stopped and a reaction worked up.
          </Alert>
        )}

        <Stack gap="xs">
          <Text fw={600} size="sm">
            Observations
          </Text>
          {isLoading && <Text size="sm">Loading…</Text>}
          {isError && (
            <Alert tone="danger" title="Observations could not be loaded">
              This is a fault, not an unmonitored transfusion.
            </Alert>
          )}
          {!isLoading && !isError && (observations?.length ?? 0) === 0 && (
            <Text size="sm" c="dimmed">
              No observations recorded yet.
            </Text>
          )}
          {observations?.map((o) => (
            <Card key={o.id} withBorder padding="sm">
              <Group justify="space-between" wrap="nowrap">
                <Group gap="xs">
                  <Badge tone="neutral">{PHASE_LABEL[o.phase] ?? o.phase}</Badge>
                  {o.reaction_suspected && <Badge tone="danger">Reaction</Badge>}
                  {o.adverse_signs && <Badge tone="warning">Adverse signs</Badge>}
                </Group>
                <Text size="xs" c="dimmed">
                  {new Date(o.observed_at).toLocaleString()}
                </Text>
              </Group>
              <Text size="sm" mt={4}>
                {vitalsSummary(o)}
              </Text>
              {o.notes && (
                <Text size="xs" c="dimmed" mt={2}>
                  {o.notes}
                </Text>
              )}
            </Card>
          ))}
        </Stack>

        {canRecord && <Divider />}

        {canRecord && (
          <Stack component="form" gap="sm" onSubmit={handleSubmit((v) => recordMut.mutate(v))}>
            <Text fw={600} size="sm">
              Record observation
            </Text>
            <Controller
              name="phase"
              control={control}
              render={({ field }) => (
                <Select
                  label="Phase"
                  required
                  data={PHASE_OPTIONS}
                  value={field.value}
                  onChange={(v) => field.onChange(v ?? "periodic")}
                  error={errors.phase?.message}
                />
              )}
            />
            <Group grow>
              <Controller
                name="temperature_c"
                control={control}
                render={({ field }) => (
                  <NumberField
                    label="Temp (°C)"
                    value={field.value ?? ""}
                    onChange={(v) => field.onChange(v === "" ? undefined : Number(v))}
                    min={30}
                    max={45}
                    step={0.1}
                    decimalScale={1}
                    error={errors.temperature_c?.message}
                  />
                )}
              />
              <Controller
                name="pulse"
                control={control}
                render={({ field }) => (
                  <NumberField
                    label="Pulse"
                    value={field.value ?? ""}
                    onChange={(v) => field.onChange(v === "" ? undefined : Number(v))}
                    min={0}
                    max={300}
                  />
                )}
              />
            </Group>
            <BloodPressureField
              control={control}
              systolicName="systolic_bp"
              diastolicName="diastolic_bp"
              emptyValue={undefined}
            />
            <Group grow>
              <Controller
                name="respiratory_rate"
                control={control}
                render={({ field }) => (
                  <NumberField
                    label="Resp rate"
                    value={field.value ?? ""}
                    onChange={(v) => field.onChange(v === "" ? undefined : Number(v))}
                    min={0}
                    max={80}
                  />
                )}
              />
            </Group>
            <Controller
              name="adverse_signs"
              control={control}
              render={({ field }) => (
                <Switch
                  label="Adverse signs (rigors, urticaria, dyspnoea, loin/back pain)"
                  checked={field.value}
                  onChange={(e) => field.onChange(e.currentTarget.checked)}
                />
              )}
            />
            <Controller
              name="notes"
              control={control}
              render={({ field }) => (
                <TextArea
                  label="Notes"
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.currentTarget.value)}
                />
              )}
            />
            <Button type="submit" tone="primary" loading={recordMut.isPending} w="fit-content">
              Record observation
            </Button>
          </Stack>
        )}
      </Stack>
    </Modal>
  );
}
