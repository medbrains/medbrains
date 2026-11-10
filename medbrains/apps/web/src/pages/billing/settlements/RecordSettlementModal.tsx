// Record what an insurer paid against a claim. It files a pending posting;
// the bill changes only when someone else approves it.

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { FormModal } from "@/components";
import { Button, IconButton, Input, NumberField, Select, TextArea, toast } from "@/components/ui";
import { billingService } from "@/services/billing.service";

const OPEN_CLAIM_STATUSES = new Set(["claim_submitted", "claim_approved", "partially_settled"]);

const schema = z
  .object({
    insurance_claim_id: z.string().min(1, "Choose the claim"),
    settled_amount: z
      .number({ message: "Enter the settled amount" })
      .positive("Must be above zero"),
    tds_amount: z.number().min(0, "Cannot be negative"),
    payment_reference: z.string().trim().min(1, "Enter the UTR or cheque number"),
    settlement_date: z.string().min(1, "Enter the settlement date"),
    deductions: z.array(
      z.object({
        reason: z.string().trim().min(3, "Say why it was deducted"),
        amount: z.number({ message: "Enter the amount" }).positive("Must be above zero"),
        treatment: z.enum(["patient", "write_off"]),
      }),
    ),
    notes: z.string(),
  })
  .refine((v) => v.tds_amount <= v.settled_amount, {
    path: ["tds_amount"],
    message: "TDS cannot be more than the settled amount",
  });

type FormValues = z.infer<typeof schema>;

const DEFAULTS: FormValues = {
  insurance_claim_id: "",
  settled_amount: 0,
  tds_amount: 0,
  payment_reference: "",
  settlement_date: new Date().toISOString().slice(0, 10),
  deductions: [],
  notes: "",
};

const TREATMENTS = [
  { value: "patient", label: "Patient" },
  { value: "write_off", label: "Hospital (write-off)" },
];

export function RecordSettlementModal({
  opened,
  onClose,
}: {
  opened: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const canListClaims = useHasPermission(P.BILLING.CORPORATE_LIST);
  const { control, handleSubmit, reset, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  });
  const deductions = useFieldArray({ control, name: "deductions" });

  const claimsQuery = useQuery({
    queryKey: ["billing", "insurance-claims"],
    queryFn: () => billingService.listInsuranceClaims(),
    enabled: opened && canListClaims,
  });
  const claimOptions = useMemo(
    () =>
      (claimsQuery.data ?? [])
        .filter((c) => OPEN_CLAIM_STATUSES.has(c.status))
        .map((c) => ({
          value: c.id,
          label: `${c.claim_number ?? "No number"} · ${c.tpa_name ?? c.insurance_provider} · approved ${c.approved_amount ?? "—"}`,
        })),
    [claimsQuery.data],
  );

  const close = () => {
    reset(DEFAULTS);
    onClose();
  };
  const mutation = useMutation({
    mutationFn: (v: FormValues) =>
      billingService.recordClaimSettlement({ ...v, notes: v.notes.trim() || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", "claim-settlements"] });
      toast.success("Settlement recorded — waiting for approval");
      close();
    },
  });

  return (
    <FormModal
      opened={opened}
      onClose={close}
      title="Record insurer settlement"
      size="lg"
      onSubmit={handleSubmit((v) => mutation.mutate(v))}
      submitLabel="Record for approval"
      submitting={mutation.isPending}
      error={mutation.error?.message ?? null}
    >
      <Controller
        control={control}
        name="insurance_claim_id"
        render={({ field, fieldState }) => (
          <Select
            label="Claim"
            required
            searchable
            data={claimOptions}
            value={field.value || null}
            onChange={(value) => field.onChange(value ?? "")}
            disabled={!canListClaims}
            description={
              canListClaims ? undefined : "You need access to the claims list to pick a claim"
            }
            error={fieldState.error?.message}
            nothingFoundMessage={
              claimsQuery.isError ? "Claims could not be loaded" : "No open claims"
            }
          />
        )}
      />
      <Group grow align="flex-start">
        <Controller
          control={control}
          name="settled_amount"
          render={({ field, fieldState }) => (
            <NumberField
              label="Settled amount (gross, incl. TDS)"
              required
              min={0}
              decimalScale={2}
              value={field.value}
              onChange={(value) => field.onChange(Number(value) || 0)}
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="tds_amount"
          render={({ field, fieldState }) => (
            <NumberField
              label="TDS withheld"
              min={0}
              decimalScale={2}
              value={field.value}
              onChange={(value) => field.onChange(Number(value) || 0)}
              error={fieldState.error?.message}
            />
          )}
        />
      </Group>
      <Group grow align="flex-start">
        <Controller
          control={control}
          name="payment_reference"
          render={({ field, fieldState }) => (
            <Input
              label="UTR / cheque number"
              required
              {...field}
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="settlement_date"
          render={({ field, fieldState }) => (
            <Input
              label="Settlement date"
              type="date"
              required
              {...field}
              error={fieldState.error?.message}
            />
          )}
        />
      </Group>
      <Stack gap="xs">
        <Group justify="space-between">
          <Text size="sm" fw={600}>
            Deductions
          </Text>
          <Button
            tone="ghost"
            leftSection={<IconPlus size={16} />}
            onClick={() => deductions.append({ reason: "", amount: 0, treatment: "patient" })}
          >
            Add deduction
          </Button>
        </Group>
        {deductions.fields.length === 0 && (
          <Text size="xs" c="dimmed">
            No deductions. What the insurer did not pay stays owing on the patient's bill.
          </Text>
        )}
        {deductions.fields.map((row, i) => (
          <Group key={row.id} align="flex-start" wrap="nowrap">
            <Controller
              control={control}
              name={`deductions.${i}.reason`}
              render={({ field, fieldState }) => (
                <Input label="Reason" {...field} error={fieldState.error?.message} flex={3} />
              )}
            />
            <Controller
              control={control}
              name={`deductions.${i}.amount`}
              render={({ field, fieldState }) => (
                <NumberField
                  label="Amount"
                  min={0}
                  decimalScale={2}
                  value={field.value}
                  onChange={(value) => field.onChange(Number(value) || 0)}
                  error={fieldState.error?.message}
                  flex={2}
                />
              )}
            />
            <Controller
              control={control}
              name={`deductions.${i}.treatment`}
              render={({ field }) => (
                <Select
                  label="Borne by"
                  data={TREATMENTS}
                  value={field.value}
                  onChange={(value) => field.onChange(value ?? "patient")}
                  allowDeselect={false}
                  flex={2}
                />
              )}
            />
            <IconButton
              aria-label={`Remove deduction ${i + 1}`}
              mt={24}
              onClick={() => deductions.remove(i)}
            >
              <IconTrash size={16} />
            </IconButton>
          </Group>
        ))}
      </Stack>
      <Controller
        control={control}
        name="notes"
        render={({ field }) => <TextArea label="Notes" minRows={2} {...field} />}
      />
      {formState.isSubmitted && !formState.isValid && (
        <Text size="xs" c="danger">
          Fix the highlighted fields to record the settlement.
        </Text>
      )}
    </FormModal>
  );
}
