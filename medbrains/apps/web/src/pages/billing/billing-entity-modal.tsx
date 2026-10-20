import { zodResolver } from "@hookform/resolvers/zod";
import { Stack } from "@mantine/core";
import type { BillingEntity, BillingEntityInput } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Input, Modal, Switch, TextArea, toast } from "@/components/ui";
import { billingService } from "@/services/billing.service";

/** GSTIN: 2-digit state, PAN, entity number, "Z", check character. */
const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const entitySchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9-]*[A-Z0-9]$/, "Letters, digits and dashes, e.g. PHARM"),
  name: z.string().trim().min(2, "Name the entity as on its GST registration"),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .refine((g) => g === "" || GSTIN.test(g), "A GSTIN is 15 characters, e.g. 33AABCU9603R1ZM"),
  drug_licence: z.string().trim(),
  address: z.string().trim(),
  receipt_prefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{1,8}$/, "Up to 8 letters or digits, e.g. RCT"),
  is_default: z.boolean(),
  is_active: z.boolean(),
});
type EntityForm = z.infer<typeof entitySchema>;

interface BillingEntityModalProps {
  /** The entity to edit; `null` adds one. */
  entity: BillingEntity | null;
  opened: boolean;
  onClose: () => void;
}

function defaultsOf(entity: BillingEntity | null): EntityForm {
  return {
    code: entity?.code ?? "",
    name: entity?.name ?? "",
    gstin: entity?.gstin ?? "",
    drug_licence: entity?.drug_licence ?? "",
    address: entity?.address ?? "",
    receipt_prefix: entity?.receipt_prefix ?? "",
    is_default: entity?.is_default ?? false,
    is_active: entity?.is_active ?? true,
  };
}

function inputOf(form: EntityForm): BillingEntityInput {
  return {
    ...form,
    gstin: form.gstin || null,
    drug_licence: form.drug_licence || null,
    address: form.address || null,
  };
}

/** Add or edit a legal billing entity: its GSTIN and receipt series. */
export function BillingEntityModal({ entity, opened, onClose }: BillingEntityModalProps) {
  const queryClient = useQueryClient();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<EntityForm>({
    resolver: zodResolver(entitySchema),
    values: defaultsOf(entity),
  });
  const save = useMutation({
    mutationFn: (form: EntityForm) =>
      entity
        ? billingService.updateBillingEntity(entity.id, inputOf(form))
        : billingService.createBillingEntity(inputOf(form)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["billing-entities"] });
      void queryClient.invalidateQueries({ queryKey: ["billing-lanes"] });
      toast.success("Billing entity saved");
      onClose();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save"),
  });
  const text = (
    name: "code" | "name" | "gstin" | "drug_licence" | "receipt_prefix",
    label: string,
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Input
          label={label}
          {...field}
          error={errors[name]?.message}
          data-testid={`entity-${name}`}
        />
      )}
    />
  );
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={entity ? `Edit ${entity.name}` : "Add billing entity"}
      primaryAction={{
        label: "Save",
        onClick: handleSubmit((form) => save.mutate(form)),
        loading: save.isPending,
      }}
      secondaryAction={{ label: "Cancel", onClick: onClose }}
    >
      <Stack gap="sm">
        {text("code", "Code")}
        {text("name", "Legal name")}
        {text("gstin", "GSTIN")}
        {text("drug_licence", "Drug licence (pharmacy entities)")}
        <Controller
          control={control}
          name="address"
          render={({ field }) => <TextArea label="Address on receipts" {...field} />}
        />
        {text("receipt_prefix", "Receipt prefix")}
        <Controller
          control={control}
          name="is_default"
          render={({ field }) => (
            <Switch
              label="Default entity (bills that name no other)"
              checked={field.value}
              onChange={(e) => field.onChange(e.currentTarget.checked)}
              disabled={entity?.is_default}
            />
          )}
        />
        <Controller
          control={control}
          name="is_active"
          render={({ field }) => (
            <Switch
              label="Active"
              checked={field.value}
              onChange={(e) => field.onChange(e.currentTarget.checked)}
            />
          )}
        />
      </Stack>
    </Modal>
  );
}
