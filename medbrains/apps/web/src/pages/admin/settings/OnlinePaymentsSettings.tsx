/**
 * Online payments (#4884): which provider the hospital takes online money
 * through, the fallback offered when it is down, a counter's own provider,
 * each provider's keys (write-only) and a test that they work.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { OnlineSettings, PaymentCapabilities, ProviderSetup } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconCheck, IconKey, IconPlugConnected } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Badge, Button, Select, Table, toast } from "@/components/ui";
import { paymentsService } from "@/services/payments.service";
import { ONLINE_SETTINGS_KEY, ProviderKeysModal } from "./ProviderKeysModal";
import { StationProvidersTable } from "./StationProvidersTable";

const CAPABILITY_LABEL: Record<keyof PaymentCapabilities, string> = {
  checkout: "Checkout",
  dynamic_qr: "Dynamic UPI QR",
  payment_links: "Payment links",
  partial_refund: "Partial refund",
  multiple_refunds: "Several refunds",
  payouts: "Payouts",
  upi_collect: "UPI collect",
  emi: "EMI",
};

const choiceSchema = z
  .object({
    active_provider: z.string().min(1, "Choose a provider"),
    fallback_provider: z.string(),
  })
  .refine((v) => v.fallback_provider !== v.active_provider, {
    path: ["fallback_provider"],
    message: "The fallback must be a different provider",
  });
type ChoiceForm = z.infer<typeof choiceSchema>;

function ProviderChoice({ settings }: { settings: OnlineSettings }) {
  const queryClient = useQueryClient();
  const { control, handleSubmit } = useForm<ChoiceForm>({
    resolver: zodResolver(choiceSchema),
    defaultValues: {
      active_provider: settings.active_provider,
      fallback_provider: settings.fallback_provider ?? "",
    },
  });
  const options = settings.providers.map((p) => ({
    value: p.provider,
    label: p.configured ? p.label : `${p.label} (keys not set)`,
    disabled: !p.configured,
  }));
  const save = useMutation({
    mutationFn: (v: ChoiceForm) =>
      paymentsService.updateOnlineSettings({
        active_provider: v.active_provider,
        fallback_provider: v.fallback_provider || null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ONLINE_SETTINGS_KEY });
      void queryClient.invalidateQueries({ queryKey: ["payment-capabilities"] });
      toast.success("Online payment provider saved.");
    },
  });
  return (
    <Stack gap="sm" component="form" onSubmit={handleSubmit((v) => save.mutate(v))}>
      <Group grow align="flex-start">
        <Controller
          control={control}
          name="active_provider"
          render={({ field, fieldState }) => (
            <Select
              label="Online payment provider"
              description="Checkout, live UPI QR and payment links go through it"
              data={options}
              value={field.value || null}
              onChange={(v) => field.onChange(v ?? "")}
              allowDeselect={false}
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="fallback_provider"
          render={({ field, fieldState }) => (
            <Select
              label="Fallback provider"
              description="Offered to the cashier when the first does not answer — never switched to on its own"
              data={options}
              value={field.value || null}
              onChange={(v) => field.onChange(v ?? "")}
              clearable
              placeholder="No fallback"
              error={fieldState.error?.message}
            />
          )}
        />
      </Group>
      {save.isError && <Alert tone="danger">{save.error.message}</Alert>}
      <Group>
        <Button
          type="submit"
          tone="primary"
          loading={save.isPending}
          leftSection={<IconCheck size={16} />}
        >
          Save provider
        </Button>
      </Group>
    </Stack>
  );
}

function capabilityBadges(c: PaymentCapabilities) {
  return (Object.keys(CAPABILITY_LABEL) as (keyof PaymentCapabilities)[])
    .filter((k) => c[k])
    .map((k) => (
      <Badge key={k} tone="neutral">
        {CAPABILITY_LABEL[k]}
      </Badge>
    ));
}

function keysStatus(p: ProviderSetup) {
  if (p.configured) {
    return <Badge tone="success">{p.mode === "live" ? "Live keys set" : "Test keys set"}</Badge>;
  }
  return <Badge tone="warning">Missing: {p.missing.join(", ")}</Badge>;
}

function ProvidersTable({
  settings,
  onKeys,
}: {
  settings: OnlineSettings;
  onKeys: (p: ProviderSetup) => void;
}) {
  const test = useMutation({
    mutationFn: paymentsService.testPaymentProvider,
    onSuccess: (r) => (r.ok ? toast.success(r.message) : toast.error(r.message)),
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Table striped withTableBorder>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Provider</Table.Th>
          <Table.Th>Keys</Table.Th>
          <Table.Th>Can do</Table.Th>
          <Table.Th>Actions</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {settings.providers.map((p) => (
          <Table.Tr key={p.provider} data-testid={`provider-row-${p.provider}`}>
            <Table.Td>
              <Text size="sm" fw={500}>
                {p.label}
              </Text>
              {p.provider === settings.active_provider && <Badge tone="info">In use</Badge>}
              {p.provider === settings.fallback_provider && <Badge tone="neutral">Fallback</Badge>}
              {p.stand_in && <Badge tone="warning">Stand-in</Badge>}
            </Table.Td>
            <Table.Td>{keysStatus(p)}</Table.Td>
            <Table.Td>
              <Group gap={4}>{capabilityBadges(p.capabilities)}</Group>
            </Table.Td>
            <Table.Td>
              <Group gap="xs" wrap="nowrap">
                <Button
                  tone="secondary"
                  size="xs"
                  leftSection={<IconKey size={14} />}
                  aria-label={`Set ${p.label} keys`}
                  onClick={() => onKeys(p)}
                >
                  Keys
                </Button>
                <Button
                  tone="tertiary"
                  size="xs"
                  leftSection={<IconPlugConnected size={14} />}
                  aria-label={`Test ${p.label}`}
                  disabled={!p.configured}
                  loading={test.isPending && test.variables === p.provider}
                  onClick={() => test.mutate(p.provider)}
                >
                  Test
                </Button>
              </Group>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

export function OnlinePaymentsSettings() {
  const canConfigure = useHasPermission(P.BILLING.PAYMENTS_CONFIGURE);
  const [editing, setEditing] = useState<ProviderSetup | null>(null);
  const settings = useQuery({
    queryKey: ONLINE_SETTINGS_KEY,
    queryFn: paymentsService.getOnlineSettings,
    enabled: canConfigure,
  });
  if (!canConfigure) {
    return (
      <Alert tone="warning">
        Online payment settings need the "Configure online payment providers" permission.
      </Alert>
    );
  }
  if (settings.isLoading) return <Text c="dimmed">Loading online payment settings…</Text>;
  if (settings.isError || !settings.data) {
    return (
      <Alert tone="danger" title="Online payment settings could not be loaded">
        {settings.error?.message ?? "No answer from the server."}
      </Alert>
    );
  }
  return (
    <Stack gap="lg">
      <Stack gap={2}>
        <Text fw={600} size="lg">
          Online payments
        </Text>
        <Text size="sm" c="dimmed">
          MedBrains takes online payments through any of these providers. Money posts to bills the
          same way whichever one is used.
        </Text>
      </Stack>
      <ProviderChoice
        key={`${settings.data.active_provider}:${settings.data.fallback_provider}`}
        settings={settings.data}
      />
      <ProvidersTable settings={settings.data} onKeys={setEditing} />
      <StationProvidersTable settings={settings.data} />
      {editing && <ProviderKeysModal setup={editing} onClose={() => setEditing(null)} />}
    </Stack>
  );
}
