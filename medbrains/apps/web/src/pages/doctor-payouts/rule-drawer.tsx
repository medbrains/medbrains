import { zodResolver } from "@hookform/resolvers/zod";
import { Group, SimpleGrid, Stack, Text } from "@mantine/core";
import type { PayoutRuleInput } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, Input, Modal, Select, toast } from "@/components/ui";
import { doctorPayoutsService } from "@/services/doctor-payouts.service";
import { errorText } from "./shared";

const amount = z.union([
  z.string().regex(/^\d+(\.\d{1,2})?$/, "An amount like 300 or 12.5"),
  z.literal(""),
]);

export const ruleSchema = z
  .object({
    rule_name: z.string().trim().min(2, "Name the rule"),
    charge_code: z.string(),
    category: z.string(),
    payer_class: z.string(),
    visit_kind: z.string(),
    role: z.enum(["primary", "assistant", "anaesthetist"]),
    calc_kind: z.enum(["percent", "fixed"]),
    percentage: amount,
    fixed_amount: amount,
    cap_min: amount,
    cap_max: amount,
  })
  .refine(
    (v) => v.calc_kind !== "percent" || (v.percentage !== "" && Number(v.percentage) <= 100),
    {
      path: ["percentage"],
      message: "A percentage between 0 and 100",
    },
  )
  .refine((v) => v.calc_kind !== "fixed" || v.fixed_amount !== "", {
    path: ["fixed_amount"],
    message: "Enter the fixed amount",
  });

type RuleForm = z.infer<typeof ruleSchema>;

const ANY = { value: "", label: "Any" };
const PAYERS = [
  ANY,
  ...["cash", "tpa", "cghs", "echs", "pmjay", "esis", "state_scheme"].map((v) => ({
    value: v,
    label: v.toUpperCase(),
  })),
];
const TEXT_FIELDS: { name: keyof RuleForm; label: string }[] = [
  { name: "rule_name", label: "Rule name" },
  { name: "charge_code", label: "Charge or package code (blank = any)" },
  { name: "category", label: "Category, e.g. consultation, package (blank = any)" },
];

const blank = (v: string) => (v === "" ? null : v);

/** Add a line to a rate card: what it matches and what it pays. */
export function RuleDrawer({
  opened,
  onClose,
  cardId,
}: {
  opened: boolean;
  onClose: () => void;
  cardId: string;
}) {
  const queryClient = useQueryClient();
  const { control, handleSubmit, watch, reset } = useForm<RuleForm>({
    resolver: zodResolver(ruleSchema),
    defaultValues: {
      rule_name: "",
      charge_code: "",
      category: "",
      payer_class: "",
      visit_kind: "",
      role: "primary",
      calc_kind: "percent",
      percentage: "",
      fixed_amount: "",
      cap_min: "",
      cap_max: "",
    },
  });
  const kind = watch("calc_kind");
  const add = useMutation({
    mutationFn: (v: RuleForm) => {
      const input: PayoutRuleInput = {
        rule_name: v.rule_name,
        charge_code: blank(v.charge_code),
        category: blank(v.category),
        payer_class: blank(v.payer_class),
        visit_kind: blank(v.visit_kind),
        role: v.role,
        calc_kind: v.calc_kind,
        percentage: v.calc_kind === "percent" ? v.percentage : null,
        fixed_amount: v.calc_kind === "fixed" ? v.fixed_amount : null,
        cap_min: blank(v.cap_min),
        cap_max: blank(v.cap_max),
      };
      return doctorPayoutsService.addPayoutRule(cardId, input);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["doctor-payouts", "rate-cards"] });
      toast.success("Rule added");
      reset();
      onClose();
    },
  });
  const select = (
    name: keyof RuleForm,
    label: string,
    data: { value: string; label: string }[],
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Select
          label={label}
          data={data}
          allowDeselect={false}
          value={field.value}
          onChange={(v) => field.onChange(v ?? "")}
          error={fieldState.error?.message}
        />
      )}
    />
  );
  const text = (name: keyof RuleForm, label: string) => (
    <Controller
      key={name}
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Input label={label} {...field} error={fieldState.error?.message} />
      )}
    />
  );
  return (
    <Modal opened={opened} onClose={onClose} title="Add rule" size="md">
      <Stack gap="sm" component="form" onSubmit={handleSubmit((v) => add.mutate(v))}>
        {TEXT_FIELDS.map((f) => text(f.name, f.label))}
        <SimpleGrid cols={2}>
          {select("payer_class", "Payer", PAYERS)}
          {select("visit_kind", "Visit", [
            ANY,
            { value: "first", label: "First visit" },
            { value: "follow_up", label: "Follow-up" },
          ])}
          {select("role", "Role", [
            { value: "primary", label: "Performing doctor / surgeon" },
            { value: "assistant", label: "Assistant surgeon" },
            { value: "anaesthetist", label: "Anaesthetist" },
          ])}
          {select("calc_kind", "Pays", [
            { value: "percent", label: "A percentage" },
            { value: "fixed", label: "A fixed amount per unit" },
          ])}
          {kind === "percent"
            ? text("percentage", "Percentage")
            : text("fixed_amount", "Amount (Rs)")}
          {text("cap_min", "At least (Rs, optional)")}
          {text("cap_max", "At most (Rs, optional)")}
        </SimpleGrid>
        <Text size="xs" c="dimmed">
          Implants, consumables and pharmacy are never shared unless a rule names their exact code.
          Roles sharing the same lines may not add up to more than 100%.
        </Text>
        {add.isError && (
          <Alert tone="danger" title="Rule not added">
            {errorText(add.error)}
          </Alert>
        )}
        <Group justify="flex-end">
          <Button type="submit" loading={add.isPending}>
            Add rule
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
