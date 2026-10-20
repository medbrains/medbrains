/**
 * Add or change a payment device: what it is, the counter it sits at, and
 * how MedBrains reaches it — the provider's cloud, or the site bridge on the
 * counter PC it is wired to.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack } from "@mantine/core";
import { api } from "@medbrains/api";
import type {
  CreatePaymentTerminalRequest,
  PaymentTerminal,
  TerminalProviders,
} from "@medbrains/types";
import { IconCheck } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, Input, Modal, SegmentedControl, Select, toast } from "@/components/ui";
import { paymentsService } from "@/services/payments.service";

export const TERMINALS_KEY = ["payment-terminals"] as const;

/** Station types a payment device can sit at. */
const COUNTER_TYPES = new Set([
  "billing_counter",
  "pharmacy_counter",
  "reception",
  "opd_counter",
  "lab_counter",
]);

const KIND_OPTIONS = [
  { value: "pos", label: "Card machine" },
  { value: "qr", label: "Dynamic QR / soundbox" },
  { value: "online", label: "Online checkout" },
];

const schema = z
  .object({
    label: z.string().trim().min(1, "Give it a name the cashier will recognise"),
    kind: z.enum(["pos", "qr", "online"]),
    connection: z.enum(["cloud", "bridge"]),
    provider: z.string(),
    adapter: z.string(),
    device_address: z.string(),
    terminal_code: z.string(),
    acquiring_bank: z.string(),
    station_id: z.string().min(1, "Choose the counter it sits at"),
    mode: z.enum(["sandbox", "live"]),
  })
  .superRefine((v, ctx) => {
    const viaBridge = v.kind === "pos" && v.connection === "bridge";
    if (viaBridge && !v.adapter) {
      ctx.addIssue({
        code: "custom",
        path: ["adapter"],
        message: "Choose how the bridge drives it",
      });
    }
    if (!viaBridge && !v.provider) {
      ctx.addIssue({ code: "custom", path: ["provider"], message: "Choose the provider" });
    }
  });
type TerminalForm = z.infer<typeof schema>;

function defaults(t?: PaymentTerminal): TerminalForm {
  return {
    label: t?.label ?? "",
    kind: (t?.kind as TerminalForm["kind"]) ?? "pos",
    connection: t?.connection ?? "cloud",
    provider: t?.provider ?? "",
    adapter: t?.adapter ?? "",
    device_address: t?.device_address ?? "",
    terminal_code: t?.terminal_code ?? "",
    acquiring_bank: t?.acquiring_bank ?? "",
    station_id: t?.station_id ?? "",
    mode: t?.mode === "live" ? "live" : "sandbox",
  };
}

interface PaymentTerminalModalProps {
  terminal?: PaymentTerminal;
  providers: TerminalProviders | undefined;
  onClose: () => void;
}

export function PaymentTerminalModal({ terminal, providers, onClose }: PaymentTerminalModalProps) {
  const queryClient = useQueryClient();
  const { control, handleSubmit, watch } = useForm<TerminalForm>({
    resolver: zodResolver(schema),
    defaultValues: defaults(terminal),
  });
  const kind = watch("kind");
  const connection = watch("connection");
  const viaBridge = kind === "pos" && connection === "bridge";

  const stationsQuery = useQuery({ queryKey: ["stations"], queryFn: () => api.listStations() });
  const onlineQuery = useQuery({
    queryKey: ["payment-providers"],
    queryFn: paymentsService.listPaymentProviders,
    enabled: kind !== "pos",
  });
  const counters = (stationsQuery.data ?? [])
    .filter((s) => COUNTER_TYPES.has(s.station_type))
    .map((s) => ({ value: s.id, label: s.name }));
  const providerOptions =
    kind === "pos"
      ? (providers?.cloud ?? []).map((p) => ({ value: p.code, label: p.label }))
      : (onlineQuery.data?.providers ?? []).map((p) => ({ value: p.provider, label: p.label }));
  const adapterOptions = (providers?.bridge_adapters ?? []).map((a) => ({
    value: a.code,
    label: a.label,
  }));

  const save = useMutation({
    mutationFn: (form: TerminalForm) => {
      const body: CreatePaymentTerminalRequest = {
        label: form.label,
        kind: form.kind,
        connection: form.kind === "pos" ? form.connection : "cloud",
        provider: viaBridge ? form.provider || "bridge" : form.provider,
        adapter: viaBridge ? form.adapter : undefined,
        device_address: viaBridge ? form.device_address.trim() || undefined : undefined,
        terminal_code: form.terminal_code.trim() || undefined,
        acquiring_bank: form.acquiring_bank.trim() || undefined,
        station_id: form.station_id,
        mode: form.mode,
      };
      return terminal
        ? paymentsService.updatePaymentTerminal(terminal.id, body)
        : paymentsService.createPaymentTerminal(body);
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: TERMINALS_KEY });
      toast.success(`${saved.label} saved at ${saved.station_name ?? "its counter"}.`);
      onClose();
    },
  });

  return (
    <Modal
      opened
      onClose={onClose}
      title={terminal ? "Change payment device" : "Add payment device"}
    >
      <Stack gap="md" component="form" onSubmit={handleSubmit((v) => save.mutate(v))}>
        <Controller
          control={control}
          name="label"
          render={({ field, fieldState }) => (
            <Input
              label="Name"
              placeholder="e.g. Counter 1 card machine"
              required
              {...field}
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="station_id"
          render={({ field, fieldState }) => (
            <Select
              label="Counter"
              placeholder={stationsQuery.isError ? "Counters could not be loaded" : "Where it sits"}
              data={counters}
              searchable
              required
              value={field.value || null}
              onChange={(v) => field.onChange(v ?? "")}
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="kind"
          render={({ field }) => (
            <Select
              label="Kind"
              data={KIND_OPTIONS}
              value={field.value}
              onChange={(v) => field.onChange(v ?? "pos")}
              allowDeselect={false}
            />
          )}
        />
        {kind === "pos" && (
          <Controller
            control={control}
            name="connection"
            render={({ field }) => (
              <SegmentedControl
                aria-label="How it is reached"
                value={field.value}
                onChange={field.onChange}
                data={[
                  { value: "cloud", label: "Provider's cloud" },
                  { value: "bridge", label: "Wired to the counter PC" },
                ]}
              />
            )}
          />
        )}
        {viaBridge ? (
          <Group grow align="flex-start">
            <Controller
              control={control}
              name="adapter"
              render={({ field, fieldState }) => (
                <Select
                  label="Device adapter"
                  data={adapterOptions}
                  value={field.value || null}
                  onChange={(v) => field.onChange(v ?? "")}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="device_address"
              render={({ field }) => (
                <Input
                  label="Plugged in at"
                  placeholder="COM3, /dev/ttyUSB0, BT address"
                  {...field}
                />
              )}
            />
          </Group>
        ) : (
          <Controller
            control={control}
            name="provider"
            render={({ field, fieldState }) => (
              <Select
                label="Provider"
                data={providerOptions}
                value={field.value || null}
                onChange={(v) => field.onChange(v ?? "")}
                error={fieldState.error?.message}
              />
            )}
          />
        )}
        <Group grow align="flex-start">
          <Controller
            control={control}
            name="terminal_code"
            render={({ field }) => (
              <Input label="Device id" placeholder="Plutus IMEI / Ezetap device id" {...field} />
            )}
          />
          <Controller
            control={control}
            name="acquiring_bank"
            render={({ field }) => (
              <Input label="Acquiring bank" placeholder="SBI, Canara…" {...field} />
            )}
          />
        </Group>
        <Controller
          control={control}
          name="mode"
          render={({ field }) => (
            <SegmentedControl
              aria-label="Mode"
              value={field.value}
              onChange={field.onChange}
              data={[
                { value: "sandbox", label: "Sandbox (test)" },
                { value: "live", label: "Live" },
              ]}
            />
          )}
        />
        {save.isError && <Alert tone="danger">{save.error.message}</Alert>}
        <Group justify="flex-end">
          <Button tone="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            tone="primary"
            type="submit"
            loading={save.isPending}
            leftSection={<IconCheck size={16} />}
          >
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
