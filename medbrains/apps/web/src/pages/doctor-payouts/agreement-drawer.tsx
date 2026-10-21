import { zodResolver } from "@hookform/resolvers/zod";
import { Group, SimpleGrid, Stack, Text } from "@mantine/core";
import type { DoctorAgreement, DoctorAgreementInput } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type Control, Controller, type FieldPath, useForm } from "react-hook-form";
import { z } from "zod";
import { DoctorSearchSelect } from "@/components/DoctorSearchSelect";
import { Alert, Button, Input, Modal, Select, Switch, TextArea, toast } from "@/components/ui";
import { doctorPayoutsService } from "@/services/doctor-payouts.service";
import { BASES, BEARERS, ENGAGEMENTS, errorText } from "./shared";

const money = z.string().regex(/^\d+(\.\d{1,2})?$/, "Enter an amount like 1500 or 1500.50");
const optionalMoney = z.union([money, z.literal("")]);

export const agreementSchema = z
  .object({
    doctor_id: z.string().min(1, "Choose the doctor"),
    plan_id: z.string().min(1, "Choose the rate card"),
    effective_from: z.string().min(1, "When does it start?"),
    effective_to: z.string(),
    is_active: z.boolean(),
    engagement_type: z.string(),
    accrual_basis: z.string(),
    share_on: z.string(),
    discount_bearer: z.string(),
    disallowance_bearer: z.string(),
    charity_rule: z.enum(["zero", "full", "fixed"]),
    charity_fixed_amount: optionalMoney,
    session_minimum: optionalMoney,
    settlement_cycle: z.enum(["same_day", "monthly"]),
    tds_section_code: z.string(),
    pan: z.union([
      z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "PAN looks like ABCDE1234F"),
      z.literal(""),
    ]),
    payout_mode: z.enum(["bank", "upi", "cash"]),
    bank_account_name: z.string(),
    bank_account_number: z.union([z.string().regex(/^\d{6,20}$/, "Digits only"), z.literal("")]),
    bank_ifsc: z.union([
      z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "IFSC looks like HDFC0001234"),
      z.literal(""),
    ]),
    upi_vpa: z.union([
      z.string().regex(/^[A-Za-z0-9._-]{2,}@[A-Za-z]{2,}$/, "UPI ID looks like name@bank"),
      z.literal(""),
    ]),
    notes: z.string(),
  })
  .refine((v) => v.payout_mode !== "bank" || (v.bank_account_number && v.bank_ifsc), {
    path: ["bank_account_number"],
    message: "A bank payout needs the account number and IFSC",
  })
  .refine((v) => v.payout_mode !== "upi" || v.upi_vpa, {
    path: ["upi_vpa"],
    message: "A UPI payout needs the UPI ID",
  })
  .refine((v) => v.charity_rule !== "fixed" || v.charity_fixed_amount, {
    path: ["charity_fixed_amount"],
    message: "Say how much a free case pays",
  });

type AgreementForm = z.infer<typeof agreementSchema>;

function toForm(a: DoctorAgreement | null): AgreementForm {
  return {
    doctor_id: a?.doctor_id ?? "",
    plan_id: a?.plan_id ?? "",
    effective_from: a?.effective_from ?? "",
    effective_to: a?.effective_to ?? "",
    is_active: a?.is_active ?? true,
    engagement_type: a?.engagement_type ?? "fee_for_service",
    accrual_basis: a?.accrual_basis ?? "",
    share_on: a?.share_on ?? "",
    discount_bearer: a?.discount_bearer ?? "",
    disallowance_bearer: a?.disallowance_bearer ?? "",
    charity_rule: a?.charity_rule ?? "zero",
    charity_fixed_amount: a?.charity_fixed_amount ?? "",
    session_minimum: a?.session_minimum ?? "",
    settlement_cycle: a?.settlement_cycle ?? "monthly",
    tds_section_code: a?.tds_section_code ?? "",
    pan: a?.pan ?? "",
    payout_mode: a?.payout_mode ?? "bank",
    bank_account_name: a?.bank_account_name ?? "",
    bank_account_number: a?.bank_account_number ?? "",
    bank_ifsc: a?.bank_ifsc ?? "",
    upi_vpa: a?.upi_vpa ?? "",
    notes: a?.notes ?? "",
  };
}

const blank = (v: string) => (v === "" ? null : v);

function toInput(v: AgreementForm): DoctorAgreementInput {
  return {
    ...v,
    engagement_type: v.engagement_type as DoctorAgreementInput["engagement_type"],
    effective_to: blank(v.effective_to),
    accrual_basis: blank(v.accrual_basis) as DoctorAgreementInput["accrual_basis"],
    share_on: blank(v.share_on) as DoctorAgreementInput["share_on"],
    discount_bearer: blank(v.discount_bearer) as DoctorAgreementInput["discount_bearer"],
    disallowance_bearer: blank(
      v.disallowance_bearer,
    ) as DoctorAgreementInput["disallowance_bearer"],
    charity_fixed_amount: blank(v.charity_fixed_amount),
    session_minimum: blank(v.session_minimum),
    tds_section_code: blank(v.tds_section_code),
    pan: blank(v.pan),
    bank_account_name: blank(v.bank_account_name),
    bank_account_number: blank(v.bank_account_number),
    bank_ifsc: blank(v.bank_ifsc),
    upi_vpa: blank(v.upi_vpa),
    notes: blank(v.notes),
  };
}

const DEFAULT = { value: "", label: "Hospital default" };

interface FieldProps {
  control: Control<AgreementForm>;
  name: FieldPath<AgreementForm>;
  label: string;
}

function TextField({ control, name, label, type }: FieldProps & { type?: string }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Input
          label={label}
          type={type}
          value={String(field.value ?? "")}
          onChange={(e) => field.onChange(e.currentTarget.value)}
          onBlur={field.onBlur}
          error={fieldState.error?.message}
        />
      )}
    />
  );
}

function SelectField({
  control,
  name,
  label,
  data,
}: FieldProps & { data: { value: string; label: string }[] }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Select
          label={label}
          data={data}
          allowDeselect={false}
          value={String(field.value ?? "")}
          onChange={(v) => field.onChange(v ?? "")}
          error={fieldState.error?.message}
        />
      )}
    />
  );
}

interface AgreementDrawerProps {
  opened: boolean;
  onClose: () => void;
  agreement: DoctorAgreement | null;
}

/** Create or change a doctor's agreement. */
export function AgreementDrawer({ opened, onClose, agreement }: AgreementDrawerProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={agreement ? `Agreement — ${agreement.doctor_name ?? ""}` : "New agreement"}
      fullScreen
    >
      {opened && (
        <AgreementForm key={agreement?.id ?? "new"} agreement={agreement} onDone={onClose} />
      )}
    </Modal>
  );
}

function AgreementForm({
  agreement,
  onDone,
}: {
  agreement: DoctorAgreement | null;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const cards = useQuery({
    queryKey: ["doctor-payouts", "rate-cards"],
    queryFn: () => doctorPayoutsService.listPayoutRateCards(),
  });
  const { control, handleSubmit, watch } = useForm<AgreementForm>({
    resolver: zodResolver(agreementSchema),
    defaultValues: toForm(agreement),
  });
  const save = useMutation({
    mutationFn: (v: AgreementForm) =>
      agreement
        ? doctorPayoutsService.updateDoctorAgreement(agreement.id, toInput(v))
        : doctorPayoutsService.createDoctorAgreement(toInput(v)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["doctor-payouts", "agreements"] });
      toast.success("New terms apply to earnings from now on.", { title: "Agreement saved" });
      onDone();
    },
  });
  const mode = watch("payout_mode");
  const charity = watch("charity_rule");
  const cardOptions = (cards.data ?? [])
    .filter((c) => c.is_active)
    .map((c) => ({ value: c.id, label: `${c.plan_name} (v${c.version})` }));

  return (
    <Stack gap="sm" component="form" onSubmit={handleSubmit((v) => save.mutate(v))}>
      <Controller
        control={control}
        name="doctor_id"
        render={({ field, fieldState }) => (
          <DoctorSearchSelect
            label="Doctor"
            value={field.value}
            onChange={field.onChange}
            required
            disabled={Boolean(agreement)}
            error={fieldState.error?.message}
          />
        )}
      />
      {cards.isError && (
        <Alert tone="danger" title="Rate cards could not be loaded">
          {errorText(cards.error)}
        </Alert>
      )}
      <SelectField control={control} name="plan_id" label="Rate card" data={cardOptions} />
      <SimpleGrid cols={2}>
        <TextField control={control} name="effective_from" label="From" type="date" />
        <TextField control={control} name="effective_to" label="To (optional)" type="date" />
        <SelectField
          control={control}
          name="engagement_type"
          label="Engagement"
          data={ENGAGEMENTS}
        />
        <SelectField
          control={control}
          name="settlement_cycle"
          label="Settled"
          data={[
            { value: "monthly", label: "Monthly statement" },
            { value: "same_day", label: "Same day, at session close" },
          ]}
        />
        <SelectField
          control={control}
          name="accrual_basis"
          label="Earns"
          data={[DEFAULT, ...BASES]}
        />
        <SelectField
          control={control}
          name="share_on"
          label="Percentage share is on"
          data={[
            DEFAULT,
            { value: "gross", label: "Gross (hospital absorbs discounts)" },
            { value: "net", label: "Net of discount" },
          ]}
        />
        <SelectField
          control={control}
          name="discount_bearer"
          label="Discount on a fixed fee"
          data={[DEFAULT, ...BEARERS]}
        />
        <SelectField
          control={control}
          name="disallowance_bearer"
          label="Insurer deductions"
          data={[DEFAULT, ...BEARERS]}
        />
        <SelectField
          control={control}
          name="charity_rule"
          label="Free / charity cases"
          data={[
            { value: "zero", label: "Pay nothing" },
            { value: "full", label: "Pay as if charged" },
            { value: "fixed", label: "Pay a fixed honorarium" },
          ]}
        />
        {charity === "fixed" ? (
          <TextField control={control} name="charity_fixed_amount" label="Honorarium (Rs)" />
        ) : (
          <TextField
            control={control}
            name="session_minimum"
            label="Session minimum (Rs, optional)"
          />
        )}
      </SimpleGrid>
      {charity === "fixed" && (
        <TextField
          control={control}
          name="session_minimum"
          label="Session minimum (Rs, optional)"
        />
      )}
      <Text fw={600} size="sm">
        Tax and payment
      </Text>
      <SimpleGrid cols={2}>
        <TextField control={control} name="pan" label="PAN (without it, TDS is 20%)" />
        <TextField
          control={control}
          name="tds_section_code"
          label="TDS section (blank = hospital default)"
        />
        <SelectField
          control={control}
          name="payout_mode"
          label="Paid by"
          data={[
            { value: "bank", label: "Bank transfer" },
            { value: "upi", label: "UPI" },
            { value: "cash", label: "Cash" },
          ]}
        />
        {mode === "upi" && <TextField control={control} name="upi_vpa" label="UPI ID" />}
        {mode === "bank" && (
          <TextField control={control} name="bank_account_name" label="Account holder" />
        )}
        {mode === "bank" && (
          <TextField control={control} name="bank_account_number" label="Account number" />
        )}
        {mode === "bank" && <TextField control={control} name="bank_ifsc" label="IFSC" />}
      </SimpleGrid>
      <Controller
        control={control}
        name="notes"
        render={({ field }) => <TextArea label="Notes" {...field} />}
      />
      {agreement && (
        <Controller
          control={control}
          name="is_active"
          render={({ field }) => (
            <Switch
              label="Agreement in force"
              checked={field.value}
              onChange={(e) => field.onChange(e.currentTarget.checked)}
            />
          )}
        />
      )}
      {save.isError && (
        <Alert tone="danger" title="Agreement not saved">
          {errorText(save.error)}
        </Alert>
      )}
      <Group justify="flex-end">
        <Button type="submit" loading={save.isPending}>
          Save agreement
        </Button>
      </Group>
    </Stack>
  );
}
