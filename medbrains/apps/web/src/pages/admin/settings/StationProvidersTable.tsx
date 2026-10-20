/**
 * A counter's own online payment provider — a pharmacy counter on the
 * pharmacy's merchant account, say. Empty follows the hospital's.
 */
import { Stack, Text } from "@mantine/core";
import type { OnlineSettings } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Select, Table, toast } from "@/components/ui";
import { paymentsService } from "@/services/payments.service";
import { ONLINE_SETTINGS_KEY } from "./ProviderKeysModal";

/** Station types that take money. */
const COUNTER_TYPES = new Set([
  "billing_counter",
  "pharmacy_counter",
  "reception",
  "opd_counter",
  "lab_counter",
]);

export function StationProvidersTable({ settings }: { settings: OnlineSettings }) {
  const queryClient = useQueryClient();
  const choose = useMutation({
    mutationFn: ({ id, provider }: { id: string; provider: string | null }) =>
      paymentsService.setStationProvider(id, provider),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ONLINE_SETTINGS_KEY });
      void queryClient.invalidateQueries({ queryKey: ["payment-capabilities"] });
      toast.success("Counter's provider saved.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const counters = settings.stations.filter((s) => COUNTER_TYPES.has(s.station_type));
  const options = settings.providers
    .filter((p) => p.configured)
    .map((p) => ({ value: p.provider, label: p.label }));
  const hospital =
    settings.providers.find((p) => p.provider === settings.active_provider)?.label ??
    settings.active_provider;

  return (
    <Stack gap="xs">
      <Text fw={600}>Counters with their own provider</Text>
      {counters.length === 0 ? (
        <Text size="sm" c="dimmed">
          No billing or pharmacy counters are set up yet; every payment uses {hospital}.
        </Text>
      ) : (
        <Table striped withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Counter</Table.Th>
              <Table.Th>Online provider</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {counters.map((s) => (
              <Table.Tr key={s.id}>
                <Table.Td>
                  <Text size="sm">{s.name}</Text>
                  <Text size="xs" c="dimmed">
                    {s.code}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Select
                    aria-label={`Online provider for ${s.name}`}
                    data={options}
                    value={s.payment_provider}
                    placeholder={`The hospital's (${hospital})`}
                    clearable
                    disabled={choose.isPending}
                    onChange={(v) => choose.mutate({ id: s.id, provider: v })}
                  />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}
