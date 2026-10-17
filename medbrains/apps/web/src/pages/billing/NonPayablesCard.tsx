/**
 * The hospital's non-payables list (#294): bill lines insurers do not pay
 * for, which the payer split gives to the patient automatically. Starts from
 * IRDAI's standard list of non-medical items; the hospital edits its own.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack, Text } from "@mantine/core";
import type { NonPayableRule } from "@medbrains/types";
import { IconTrash } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Badge, Button, Card, IconButton, Input, Select, Table } from "@/components/ui";
import { billingService } from "@/services/billing.service";

const MATCH = [
  { value: "keyword", label: "Description contains" },
  { value: "category", label: "Category is" },
  { value: "charge_code", label: "Charge code is" },
] as const;

const ruleSchema = z.object({
  match_on: z.enum(["keyword", "category", "charge_code"]),
  value: z.string().trim().min(2, "At least two characters"),
  reason: z.string().trim().min(3, "Say why the insurer does not pay"),
});

interface NonPayablesCardProps {
  canManage: boolean;
  saving: boolean;
  onSave: (rules: NonPayableRule[]) => void;
}

interface EditorProps extends NonPayablesCardProps {
  initial: NonPayableRule[];
  isDefault: boolean;
}

function Editor({ initial, isDefault, canManage, saving, onSave }: EditorProps) {
  const [rules, setRules] = useState(initial);
  const form = useForm<NonPayableRule>({
    resolver: zodResolver(ruleSchema),
    defaultValues: { match_on: "keyword", value: "", reason: "" },
  });
  const add = form.handleSubmit((rule) => {
    setRules((r) => [...r, rule]);
    form.reset({ match_on: rule.match_on, value: "", reason: rule.reason });
  });
  return (
    <Stack gap="sm">
      <Group gap="xs">
        <Text fw={600}>Items insurers do not pay for</Text>
        {isDefault && <Badge tone="info">IRDAI default list</Badge>}
      </Group>
      <Text size="sm" c="dimmed">
        Bill lines that match go to the patient on the payer split automatically. The desk can still
        move a single line either way, with a reason.
      </Text>
      <Table aria-label="Non-payable items">
        <Table.Tbody>
          {rules.map((r, i) => (
            <Table.Tr key={`${r.match_on}:${r.value}`}>
              <Table.Td>{MATCH.find((m) => m.value === r.match_on)?.label}</Table.Td>
              <Table.Td>{r.value}</Table.Td>
              <Table.Td>{r.reason}</Table.Td>
              {canManage && (
                <Table.Td>
                  <IconButton
                    aria-label={`Remove ${r.value}`}
                    tone="danger"
                    onClick={() => setRules((all) => all.filter((_, j) => j !== i))}
                  >
                    <IconTrash size={16} />
                  </IconButton>
                </Table.Td>
              )}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {canManage && (
        <form aria-label="Add a non-payable item" noValidate onSubmit={add}>
          <Group align="flex-end" gap="sm">
            <Controller
              control={form.control}
              name="match_on"
              render={({ field }) => (
                <Select
                  label="Match"
                  data={[...MATCH]}
                  allowDeselect={false}
                  value={field.value}
                  onChange={(v) => field.onChange(v)}
                  w={200}
                />
              )}
            />
            <Controller
              control={form.control}
              name="value"
              render={({ field, fieldState }) => (
                <Input label="Value" {...field} error={fieldState.error?.message} />
              )}
            />
            <Controller
              control={form.control}
              name="reason"
              render={({ field, fieldState }) => (
                <Input label="Reason" {...field} error={fieldState.error?.message} />
              )}
            />
            <Button tone="secondary" type="submit">
              Add
            </Button>
            <Button tone="primary" loading={saving} onClick={() => onSave(rules)}>
              Save list
            </Button>
          </Group>
        </form>
      )}
    </Stack>
  );
}

export function NonPayablesCard(props: NonPayablesCardProps) {
  const { data } = useQuery({
    queryKey: ["non-payables"],
    queryFn: () => billingService.getNonPayables(),
  });
  if (!data) return null;
  return (
    <Card withBorder padding="md">
      <Editor
        // Re-seed the editor when the saved list changes.
        key={JSON.stringify(data.rules)}
        initial={data.rules}
        isDefault={data.is_default}
        {...props}
      />
    </Card>
  );
}
