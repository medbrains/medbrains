/**
 * One entry in the data processors register: who, what they do, what patient
 * data they receive, the country they keep it in, and the agreement.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { MultiSelect, Select, Stack, Textarea, TextInput } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import type { DataProcessor, DataProcessorInput } from "@medbrains/types";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button } from "@/components/ui";

const CATEGORIES = [
  { value: "identity", label: "Identity (name, IDs)" },
  { value: "contact", label: "Contact details" },
  { value: "clinical", label: "Clinical records" },
  { value: "billing", label: "Bills and payments" },
  { value: "images", label: "Images and scans" },
  { value: "staff", label: "Staff data" },
];
const COUNTRIES = [
  { value: "IN", label: "India" },
  { value: "US", label: "United States" },
  { value: "SG", label: "Singapore" },
  { value: "IE", label: "Ireland" },
  { value: "DE", label: "Germany" },
  { value: "GB", label: "United Kingdom" },
];

const isoDate = (d: unknown) => (d ? new Date(d as string).toISOString().slice(0, 10) : "");

const schema = z
  .object({
    name: z.string().trim().min(2, "Name the processor"),
    service: z.string().trim().min(2, "What does it do for the hospital?"),
    data_categories: z.array(
      z.enum(["identity", "contact", "clinical", "billing", "images", "staff"]),
    ),
    country: z.string().regex(/^[A-Z]{2}$/, "Where it keeps the data"),
    sub_processor_of: z.string(),
    dpa_reference: z.string(),
    dpa_signed_on: z.string(),
    dpa_expires_on: z.string(),
    status: z.enum(["active", "retired"]),
    notes: z.string(),
  })
  .refine((v) => !v.dpa_signed_on || !v.dpa_expires_on || v.dpa_expires_on >= v.dpa_signed_on, {
    path: ["dpa_expires_on"],
    message: "The agreement ends after it was signed",
  });
type Values = z.infer<typeof schema>;

interface ProcessorFormProps {
  processor: DataProcessor | null;
  others: DataProcessor[];
  saving: boolean;
  error: Error | null;
  onSave: (input: DataProcessorInput) => void;
}

export function ProcessorForm({ processor, others, saving, error, onSave }: ProcessorFormProps) {
  const { control, handleSubmit } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: processor?.name ?? "",
      service: processor?.service ?? "",
      data_categories: processor?.data_categories ?? [],
      country: processor?.country ?? "IN",
      sub_processor_of: processor?.sub_processor_of ?? "",
      dpa_reference: processor?.dpa_reference ?? "",
      dpa_signed_on: processor?.dpa_signed_on ?? "",
      dpa_expires_on: processor?.dpa_expires_on ?? "",
      status: processor?.status ?? "active",
      notes: processor?.notes ?? "",
    },
  });
  const save = (v: Values) =>
    onSave({
      ...v,
      sub_processor_of: v.sub_processor_of || undefined,
      dpa_reference: v.dpa_reference || undefined,
      dpa_signed_on: v.dpa_signed_on || undefined,
      dpa_expires_on: v.dpa_expires_on || undefined,
      notes: v.notes || undefined,
    });
  const text = (name: "name" | "service" | "dpa_reference", label: string, required = false) => (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextInput
          {...field}
          label={label}
          withAsterisk={required}
          error={fieldState.error?.message}
        />
      )}
    />
  );
  const date = (name: "dpa_signed_on" | "dpa_expires_on", label: string) => (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <DateInput
          label={label}
          clearable
          value={field.value ? new Date(field.value) : null}
          onChange={(d) => field.onChange(isoDate(d))}
          error={fieldState.error?.message}
        />
      )}
    />
  );
  return (
    <Stack component="form" gap="sm" aria-label="Data processor" onSubmit={handleSubmit(save)}>
      {text("name", "Processor", true)}
      {text("service", "What it does for the hospital", true)}
      <Controller
        control={control}
        name="data_categories"
        render={({ field }) => (
          <MultiSelect
            label="Patient data it receives"
            data={CATEGORIES}
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />
      <Controller
        control={control}
        name="country"
        render={({ field, fieldState }) => (
          <Select
            label="Country it keeps the data in"
            description="Outside India is a cross-border transfer (DPDP s.16)"
            data={COUNTRIES}
            searchable
            allowDeselect={false}
            value={field.value}
            onChange={(v) => field.onChange(v ?? "IN")}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="sub_processor_of"
        render={({ field }) => (
          <Select
            label="Sub-processor of"
            placeholder="None — the hospital engages it directly"
            clearable
            data={others
              .filter((o) => o.id !== processor?.id)
              .map((o) => ({ value: o.id, label: o.name }))}
            value={field.value || null}
            onChange={(v) => field.onChange(v ?? "")}
          />
        )}
      />
      {text("dpa_reference", "Agreement reference")}
      {date("dpa_signed_on", "Agreement signed")}
      {date("dpa_expires_on", "Agreement ends")}
      {processor && (
        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <Select
              label="Status"
              data={[
                { value: "active", label: "In use" },
                { value: "retired", label: "No longer used" },
              ]}
              allowDeselect={false}
              {...field}
            />
          )}
        />
      )}
      <Controller
        control={control}
        name="notes"
        render={({ field }) => <Textarea {...field} label="Notes" autosize minRows={2} />}
      />
      {error && <Alert tone="danger">{error.message}</Alert>}
      <Button tone="primary" type="submit" loading={saving}>
        Save
      </Button>
    </Stack>
  );
}
