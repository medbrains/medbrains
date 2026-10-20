import { zodResolver } from "@hookform/resolvers/zod";
import { Grid, Group, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { PayoutRateCard, PayoutRule } from "@medbrains/types";
import { IconCopy, IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { DataTable } from "@/components";
import { Alert, Badge, Button, IconButton, Input, Modal, toast } from "@/components/ui";
import { doctorPayoutsService } from "@/services/doctor-payouts.service";
import { RateCalculator } from "./rate-calculator";
import { RuleDrawer } from "./rule-drawer";
import { errorText, rupees } from "./shared";

const KEY = ["doctor-payouts", "rate-cards"];

export const rateCardSchema = z.object({
  plan_name: z.string().trim().min(2, "Name the card"),
  plan_code: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{2,20}$/, "Letters, digits and dashes"),
  effective_from: z.string().min(1, "When does it start?"),
});

/** Versioned rate cards, their rules, and a calculator to test them. */
export function RateCardsTab() {
  const [selected, setSelected] = useState<PayoutRateCard | null>(null);
  const [ruleOpen, ruleDrawer] = useDisclosure(false);
  const [cardOpen, cardModal] = useDisclosure(false);
  const queryClient = useQueryClient();
  const cards = useQuery({
    queryKey: KEY,
    queryFn: () => doctorPayoutsService.listPayoutRateCards(),
  });
  const rules = useQuery({
    queryKey: [...KEY, selected?.id, "rules"],
    queryFn: () => doctorPayoutsService.listPayoutRules(selected?.id ?? ""),
    enabled: Boolean(selected),
  });
  const [versionFrom, setVersionFrom] = useState("");
  const version = useMutation({
    mutationFn: () =>
      doctorPayoutsService.newPayoutRateCardVersion(selected?.id ?? "", versionFrom),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: KEY });
      setSelected(null);
      toast.success("The old version ends the day before.", { title: "New version created" });
    },
  });
  const remove = useMutation({
    mutationFn: (ruleId: string) =>
      doctorPayoutsService.removePayoutRule(selected?.id ?? "", ruleId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: KEY }),
    onError: (e: Error) => toast.error(e.message, { title: "Rule not removed" }),
  });
  const frozen = Boolean(selected?.frozen_at);

  const cardColumns = [
    {
      key: "name",
      label: "Card",
      render: (c: PayoutRateCard) => (
        <Stack gap={0}>
          <Text fw={500}>{c.plan_name}</Text>
          <Text size="xs" c="dimmed">
            {c.plan_code} · v{c.version} · from {c.effective_from}
            {c.effective_to ? ` to ${c.effective_to}` : ""}
          </Text>
        </Stack>
      ),
    },
    {
      key: "state",
      label: "State",
      render: (c: PayoutRateCard) => (
        <Badge tone={c.frozen_at ? "neutral" : "info"}>
          {c.frozen_at ? "In use (frozen)" : `${c.rule_count} rules`}
        </Badge>
      ),
    },
  ];
  const ruleColumns = [
    { key: "name", label: "Rule", render: (r: PayoutRule) => r.rule_name },
    {
      key: "match",
      label: "Matches",
      render: (r: PayoutRule) =>
        [r.match_charge_code, r.service_type, r.payer_class, r.visit_kind]
          .filter(Boolean)
          .join(" · ") || "Anything",
    },
    { key: "role", label: "Role", render: (r: PayoutRule) => r.role },
    {
      key: "rate",
      label: "Pays",
      render: (r: PayoutRule) =>
        r.calc_kind === "fixed" ? rupees(r.fixed_amount) : `${r.percentage}%`,
    },
    {
      key: "remove",
      label: "",
      render: (r: PayoutRule) =>
        frozen ? null : (
          <IconButton
            aria-label={`Remove ${r.rule_name}`}
            tone="danger"
            onClick={() => remove.mutate(r.id)}
          >
            <IconTrash size={16} />
          </IconButton>
        ),
    },
  ];

  return (
    <Grid>
      <Grid.Col span={{ base: 12, md: 5 }}>
        <Stack gap="sm">
          <Group justify="space-between">
            <Text fw={600}>Rate cards</Text>
            <Button size="xs" leftSection={<IconPlus size={14} />} onClick={cardModal.open}>
              New card
            </Button>
          </Group>
          {cards.isError ? (
            <Alert tone="danger" title="Rate cards could not be loaded">
              {errorText(cards.error)}
            </Alert>
          ) : (
            <DataTable
              columns={cardColumns}
              data={cards.data ?? []}
              loading={cards.isLoading}
              rowKey={(c) => c.id}
              onRowClick={setSelected}
              emptyTitle="No rate cards"
              emptyDescription="Create a card, then add its rules."
            />
          )}
        </Stack>
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 7 }}>
        {selected ? (
          <Stack gap="sm">
            <Group justify="space-between">
              <Text fw={600}>
                {selected.plan_name} v{selected.version}
              </Text>
              {!frozen && (
                <Button size="xs" leftSection={<IconPlus size={14} />} onClick={ruleDrawer.open}>
                  Add rule
                </Button>
              )}
            </Group>
            {frozen && (
              <Alert tone="info" title="This version has paid doctors">
                It cannot change. Start a new version from a date; earnings before it keep this
                one's rates.
              </Alert>
            )}
            {rules.isError ? (
              <Alert tone="danger" title="Rules could not be loaded">
                {errorText(rules.error)}
              </Alert>
            ) : (
              <DataTable
                columns={ruleColumns}
                data={rules.data ?? []}
                loading={rules.isLoading}
                rowKey={(r) => r.id}
                emptyTitle="No rules"
                emptyDescription="A card with no rules pays nothing."
              />
            )}
            <Group align="flex-end">
              <Input
                type="date"
                label="New version from"
                value={versionFrom}
                onChange={(e) => setVersionFrom(e.currentTarget.value)}
              />
              <Button
                tone="secondary"
                leftSection={<IconCopy size={14} />}
                disabled={!versionFrom}
                loading={version.isPending}
                onClick={() => version.mutate()}
              >
                Start new version
              </Button>
            </Group>
            {version.isError && <Alert tone="danger">{errorText(version.error)}</Alert>}
            <RateCalculator cardId={selected.id} />
            <RuleDrawer opened={ruleOpen} onClose={ruleDrawer.close} cardId={selected.id} />
          </Stack>
        ) : (
          <Alert tone="info">Pick a rate card to see its rules and test it.</Alert>
        )}
      </Grid.Col>
      <NewCardModal opened={cardOpen} onClose={cardModal.close} />
    </Grid>
  );
}

function NewCardModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { control, handleSubmit, reset } = useForm<z.infer<typeof rateCardSchema>>({
    resolver: zodResolver(rateCardSchema),
    defaultValues: { plan_name: "", plan_code: "", effective_from: "" },
  });
  const create = useMutation({
    mutationFn: (v: z.infer<typeof rateCardSchema>) => doctorPayoutsService.createPayoutRateCard(v),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: KEY });
      reset();
      onClose();
    },
  });
  return (
    <Modal opened={opened} onClose={onClose} title="New rate card">
      <Stack gap="sm" component="form" onSubmit={handleSubmit((v) => create.mutate(v))}>
        {(["plan_name", "plan_code", "effective_from"] as const).map((name) => (
          <Controller
            key={name}
            control={control}
            name={name}
            render={({ field, fieldState }) => (
              <Input
                label={{ plan_name: "Name", plan_code: "Code", effective_from: "From" }[name]}
                type={name === "effective_from" ? "date" : undefined}
                {...field}
                error={fieldState.error?.message}
              />
            )}
          />
        ))}
        {create.isError && <Alert tone="danger">{errorText(create.error)}</Alert>}
        <Group justify="flex-end">
          <Button type="submit" loading={create.isPending}>
            Create
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
