import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack, Text } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import type { AbdmPurposeCode } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Modal, MultiSelect, Select, toast } from "@/components/ui";
import { abdmRecordsService } from "@/services/abdmRecords.service";
import { HI_TYPE_LABEL, PURPOSE_LABEL } from "./abdmStatus";

const PURPOSES = Object.keys(PURPOSE_LABEL) as [AbdmPurposeCode, ...AbdmPurposeCode[]];
const KEEP_OPTIONS = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "365", label: "1 year" },
];
const YEARS_BACK = 5;
const DAY_MS = 86_400_000;

const schema = z
  .object({
    purpose_code: z.enum(PURPOSES),
    hi_types: z.array(z.string()).min(1, "Choose at least one record type"),
    date_from: z.string().min(1, "Choose the earliest date"),
    date_to: z.string().min(1, "Choose the latest date"),
    keep_days: z.string().min(1, "Choose how long the copies may be kept"),
  })
  .refine((v) => v.date_from <= v.date_to, {
    path: ["date_to"],
    message: "The range ends before it starts",
  });
type RequestForm = z.infer<typeof schema>;

/** `YYYY-MM-DD` of today, `years` back. */
function day(yearsBack = 0): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - yearsBack);
  return d.toISOString().slice(0, 10);
}

function defaults(): RequestForm {
  return {
    purpose_code: "CAREMGT",
    hi_types: ["OPConsultation", "Prescription", "DiagnosticReport", "DischargeSummary"],
    date_from: day(YEARS_BACK),
    date_to: day(),
    keep_days: "30",
  };
}

interface Props {
  patientId: string;
  opened: boolean;
  onClose: () => void;
}

/**
 * Ask, through ABDM, for the patient's records held by other hospitals.
 * The patient approves it in their ABHA app; the request names the doctor.
 */
export function ConsentRequestModal({ patientId, opened, onClose }: Props) {
  const qc = useQueryClient();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RequestForm>({ resolver: zodResolver(schema), defaultValues: defaults() });

  const raise = useMutation({
    mutationFn: (v: RequestForm) =>
      abdmRecordsService.raiseConsentRequest(patientId, {
        purpose_code: v.purpose_code,
        hi_types: v.hi_types,
        date_from: new Date(`${v.date_from}T00:00:00`).toISOString(),
        date_to: new Date(`${v.date_to}T23:59:59`).toISOString(),
        data_erase_at: new Date(Date.now() + Number(v.keep_days) * DAY_MS).toISOString(),
      }),
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: ["abdm", "received-records", patientId] });
      if (row.status === "failed") {
        toast.error(row.error ?? "ABDM did not accept the request.", { title: "Not sent" });
      } else {
        toast.success("The patient approves it in their ABHA app.", { title: "Request sent" });
      }
      reset(defaults());
      onClose();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not request records" }),
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Request records from other hospitals"
      primaryAction={{
        label: "Send request",
        onClick: () => void handleSubmit((v) => raise.mutate(v))(),
        loading: raise.isPending,
      }}
      secondaryAction={{ label: "Cancel", onClick: onClose }}
    >
      <Stack gap="sm">
        <Text size="sm">
          ABDM asks the patient to approve this in their ABHA app, in your name and HPR ID.
        </Text>
        <Controller
          name="purpose_code"
          control={control}
          render={({ field }) => (
            <Select
              label="Purpose"
              required
              data={PURPOSES.map((p) => ({ value: p, label: PURPOSE_LABEL[p] }))}
              value={field.value}
              onChange={(v) => field.onChange(v ?? "CAREMGT")}
              error={errors.purpose_code?.message}
            />
          )}
        />
        <Controller
          name="hi_types"
          control={control}
          render={({ field }) => (
            <MultiSelect
              label="Record types"
              required
              data={Object.entries(HI_TYPE_LABEL).map(([value, label]) => ({ value, label }))}
              value={field.value}
              onChange={field.onChange}
              error={errors.hi_types?.message}
            />
          )}
        />
        <Group grow align="flex-start">
          <Controller
            name="date_from"
            control={control}
            render={({ field }) => (
              <DateInput
                label="Records from"
                required
                valueFormat="DD MMM YYYY"
                maxDate={day()}
                value={field.value || null}
                onChange={(v) => field.onChange(v ?? "")}
                error={errors.date_from?.message}
              />
            )}
          />
          <Controller
            name="date_to"
            control={control}
            render={({ field }) => (
              <DateInput
                label="Records to"
                required
                valueFormat="DD MMM YYYY"
                maxDate={day()}
                value={field.value || null}
                onChange={(v) => field.onChange(v ?? "")}
                error={errors.date_to?.message}
              />
            )}
          />
        </Group>
        <Controller
          name="keep_days"
          control={control}
          render={({ field }) => (
            <Select
              label="Keep the copies for"
              description="They are erased then, or as soon as the patient withdraws consent."
              required
              data={KEEP_OPTIONS}
              value={field.value}
              onChange={(v) => field.onChange(v ?? "")}
              error={errors.keep_days?.message}
            />
          )}
        />
      </Stack>
    </Modal>
  );
}
