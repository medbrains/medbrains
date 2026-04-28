/**
 * Active Packages section for the patient detail page.
 * Lists subscriptions with per-inclusion balance bars + consume action.
 *
 * Per RFCs/sprints/SPRINT-doctor-activities.md §5.4.
 */
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Modal,
  NumberInput,
  Progress,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import type { InclusionBalance, SubscriptionWithBalance } from "@medbrains/types";
import {
  IconPackage,
  IconPlus,
  IconRefresh,
  IconShoppingBag,
} from "@tabler/icons-react";
import { useState } from "react";

interface ActivePackagesSectionProps {
  patientId: string;
}

export function ActivePackagesSection({ patientId }: ActivePackagesSectionProps) {
  const queryClient = useQueryClient();
  const [subscribeOpen, subscribeHandlers] = useDisclosure(false);

  const { data: subs = [], isLoading } = useQuery({
    queryKey: ["patient-packages", patientId],
    queryFn: () => api.listPatientPackages(patientId),
  });

  const refund = useMutation({
    mutationFn: (subId: string) => api.refundPackage(subId),
    onSuccess: () => {
      notifications.show({ title: "Refunded", message: "Subscription marked refunded.", color: "success" });
      void queryClient.invalidateQueries({ queryKey: ["patient-packages", patientId] });
    },
    onError: (err: Error) =>
      notifications.show({ title: "Refund failed", message: err.message, color: "danger" }),
  });

  const active = subs.filter((s) => s.status === "active");
  const others = subs.filter((s) => s.status !== "active");

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Text fw={600} size="sm">Active subscriptions ({active.length})</Text>
          <Text size="xs" c="dimmed">
            Bundle pricing — chronic care plans, follow-up packs, etc.
          </Text>
        </div>
        <Button
          size="xs"
          leftSection={<IconPlus size={14} />}
          onClick={subscribeHandlers.open}
        >
          Subscribe to package
        </Button>
      </Group>

      {isLoading && <Text size="sm" c="dimmed">Loading…</Text>}

      <Stack gap="sm">
        {active.map((s) => (
          <SubscriptionCard
            key={s.id}
            sub={s}
            onConsumed={() =>
              queryClient.invalidateQueries({ queryKey: ["patient-packages", patientId] })
            }
            onRefund={() => {
              if (window.confirm("Refund this subscription? Cannot be undone.")) {
                refund.mutate(s.id);
              }
            }}
          />
        ))}

        {active.length === 0 && !isLoading && (
          <Card padding="md" withBorder>
            <Text size="sm" c="dimmed" ta="center">
              No active package subscriptions for this patient.
            </Text>
          </Card>
        )}
      </Stack>

      {others.length > 0 && (
        <>
          <Divider label={`Past subscriptions (${others.length})`} />
          <Stack gap="xs">
            {others.map((s) => (
              <Card key={s.id} padding="sm" withBorder>
                <Group justify="space-between">
                  <Stack gap={2}>
                    <Group gap="xs">
                      <Badge size="xs" color={statusColor(s.status)}>{s.status}</Badge>
                      <Text size="sm" fw={500}>{s.package_name ?? s.package_id.slice(0, 8)}</Text>
                    </Group>
                    <Text size="xs" c="dimmed">
                      Purchased {new Date(s.purchased_at).toLocaleDateString()} • ₹{s.total_paid}
                    </Text>
                  </Stack>
                </Group>
              </Card>
            ))}
          </Stack>
        </>
      )}

      {subscribeOpen && (
        <SubscribeModal
          patientId={patientId}
          onClose={subscribeHandlers.close}
          onSubscribed={() => {
            queryClient.invalidateQueries({ queryKey: ["patient-packages", patientId] });
            subscribeHandlers.close();
          }}
        />
      )}
    </Stack>
  );
}

function SubscriptionCard({
  sub,
  onConsumed,
  onRefund,
}: {
  sub: SubscriptionWithBalance;
  onConsumed: () => void;
  onRefund: () => void;
}) {
  const [consuming, setConsuming] = useState<string | null>(null);

  const consume = useMutation({
    mutationFn: ({ inclusion_type }: { inclusion_type: string }) =>
      api.consumePackage(sub.id, { inclusion_type, consumed_quantity: 1 }),
    onSuccess: (data) => {
      notifications.show({
        title: "Consumed",
        message: `Remaining: ${data.remaining_after}`,
        color: "success",
      });
      setConsuming(null);
      onConsumed();
    },
    onError: (err: Error) => {
      notifications.show({ title: "Consume failed", message: err.message, color: "danger" });
      setConsuming(null);
    },
  });

  const validUntil = new Date(sub.valid_until);
  const daysLeft = Math.ceil((validUntil.getTime() - Date.now()) / 86_400_000);

  return (
    <Card padding="md" withBorder>
      <Group justify="space-between" mb="sm">
        <Stack gap={2}>
          <Group gap="xs">
            <IconPackage size={16} />
            <Text fw={600} size="sm">
              {sub.package_name ?? sub.package_id.slice(0, 8)}
            </Text>
            <Badge size="xs" color="primary">Active</Badge>
          </Group>
          <Text size="xs" c="dimmed">
            ₹{sub.total_paid} • Valid until {validUntil.toLocaleDateString()} ({daysLeft}d left)
          </Text>
        </Stack>
        <Tooltip label="Mark as refunded">
          <ActionIcon variant="subtle" color="orange" onClick={onRefund}>
            <IconRefresh size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <Stack gap="xs">
        {sub.balances.map((b) => (
          <BalanceBar
            key={b.inclusion_id}
            balance={b}
            isConsuming={consuming === b.inclusion_id && consume.isPending}
            onConsume={() => {
              setConsuming(b.inclusion_id);
              consume.mutate({ inclusion_type: b.inclusion_type });
            }}
          />
        ))}
        {sub.balances.length === 0 && (
          <Text size="xs" c="dimmed">No inclusions defined for this package.</Text>
        )}
      </Stack>
    </Card>
  );
}

function BalanceBar({
  balance,
  isConsuming,
  onConsume,
}: {
  balance: InclusionBalance;
  isConsuming: boolean;
  onConsume: () => void;
}) {
  const pct = balance.included_quantity > 0
    ? Math.round((balance.consumed_quantity / balance.included_quantity) * 100)
    : 0;
  const exhausted = balance.remaining <= 0;
  return (
    <div>
      <Group justify="space-between" mb={4}>
        <Group gap="xs">
          <Badge size="xs" variant="light">{balance.inclusion_type}</Badge>
          <Text size="xs">
            {balance.consumed_quantity}/{balance.included_quantity} used
          </Text>
        </Group>
        <Group gap="xs">
          <Text size="xs" fw={500} c={exhausted ? "dimmed" : undefined}>
            {balance.remaining} left
          </Text>
          <Button
            size="compact-xs"
            variant="light"
            disabled={exhausted}
            loading={isConsuming}
            onClick={onConsume}
          >
            Use 1
          </Button>
        </Group>
      </Group>
      <Progress
        value={pct}
        size="sm"
        color={exhausted ? "gray" : pct > 80 ? "orange" : "primary"}
      />
    </div>
  );
}

function SubscribeModal({
  patientId,
  onClose,
  onSubscribed,
}: {
  patientId: string;
  onClose: () => void;
  onSubscribed: () => void;
}) {
  const [packageId, setPackageId] = useState<string | null>(null);
  const [totalPaid, setTotalPaid] = useState<number | string>("");
  const [notes, setNotes] = useState("");

  const { data: packages = [] } = useQuery({
    queryKey: ["doctor-packages-active"],
    queryFn: () => api.adminListDoctorPackages({ is_active: true }),
  });

  const subscribe = useMutation({
    mutationFn: () =>
      api.subscribeToPackage({
        package_id: packageId!,
        patient_id: patientId,
        total_paid: String(totalPaid || 0),
        notes: notes || null,
      }),
    onSuccess: () => {
      notifications.show({
        title: "Subscribed",
        message: "Package subscription created.",
        color: "success",
      });
      onSubscribed();
    },
    onError: (err: Error) =>
      notifications.show({ title: "Subscribe failed", message: err.message, color: "danger" }),
  });

  const selectedPackage = packages.find((p) => p.id === packageId);

  return (
    <Modal opened onClose={onClose} title="Subscribe to package" size="md">
      <Stack gap="sm">
        <Select
          label="Package"
          placeholder="Choose a package…"
          data={packages.map((p) => ({
            value: p.id,
            label: `${p.name} — ₹${p.total_price} (${p.validity_days}d)`,
          }))}
          value={packageId}
          onChange={(v) => {
            setPackageId(v);
            const pkg = packages.find((p) => p.id === v);
            if (pkg) setTotalPaid(pkg.total_price);
          }}
          searchable
          required
        />
        <NumberInput
          label="Amount paid (₹)"
          value={totalPaid}
          onChange={(v) => setTotalPaid(v)}
          min={0}
          required
        />
        {selectedPackage?.description && (
          <Text size="xs" c="dimmed">{selectedPackage.description}</Text>
        )}
        <TextInput
          label="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose}>Cancel</Button>
          <Button
            loading={subscribe.isPending}
            disabled={!packageId || totalPaid === ""}
            leftSection={<IconShoppingBag size={14} />}
            onClick={() => subscribe.mutate()}
          >
            Subscribe
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function statusColor(s: string): string {
  switch (s) {
    case "active": return "primary";
    case "exhausted": return "gray";
    case "expired": return "orange";
    case "refunded": return "red";
    case "suspended": return "yellow";
    default: return "gray";
  }
}
