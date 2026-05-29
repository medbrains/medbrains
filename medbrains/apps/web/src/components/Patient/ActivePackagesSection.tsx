/**
 * Active Packages section for the patient detail page.
 * Lists subscriptions with per-inclusion balance bars + consume action.
 *
 * Per RFCs/sprints/SPRINT-doctor-activities.md §5.4.
 */

import { zodResolver } from "@hookform/resolvers/zod";
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
import type { SubscribePackageFormInput } from "@medbrains/schemas";
import { subscribePackageFormSchema } from "@medbrains/schemas";
import { useFieldAccess, useHasPermission } from "@medbrains/stores";
import type { FieldAccessLevel, InclusionBalance, SubscriptionWithBalance } from "@medbrains/types";
import { P } from "@medbrains/types";
import { fieldAccessText } from "@medbrains/utils";
import { IconPackage, IconPlus, IconRefresh, IconShoppingBag } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { patientPackagesService } from "@/services/patientPackages.service";

interface ActivePackagesSectionProps {
  patientId: string;
}

function canEditBillingAmount(access: FieldAccessLevel): boolean {
  return access === "edit";
}

function packageAmountText(
  access: FieldAccessLevel,
  value: number | string | null | undefined,
): string {
  const parsed = Number(value ?? 0);
  const amount = Number.isFinite(parsed) ? parsed : 0;
  return fieldAccessText(
    access,
    `₹${amount.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
    "amount",
  );
}

export function ActivePackagesSection({ patientId }: ActivePackagesSectionProps) {
  const queryClient = useQueryClient();
  const [subscribeOpen, subscribeHandlers] = useDisclosure(false);
  const billingAmountAccess = useFieldAccess("billing.amount");
  const canViewPackages = useHasPermission(P.PATIENT_PACKAGES.VIEW);
  const canSubscribePackages =
    useHasPermission(P.PATIENT_PACKAGES.SUBSCRIBE) && canEditBillingAmount(billingAmountAccess);
  const canConsumePackages = useHasPermission(P.PATIENT_PACKAGES.CONSUME);
  const canRefundPackages =
    useHasPermission(P.PATIENT_PACKAGES.REFUND) && canEditBillingAmount(billingAmountAccess);
  const canViewPackageMasters = useHasPermission(P.ADMIN.DOCTOR_PACKAGES.LIST);

  const { data: subs = [], isLoading } = useQuery({
    queryKey: ["patient-packages", patientId],
    queryFn: () => patientPackagesService.listPatientPackages(patientId),
    enabled: canViewPackages,
  });

  const refund = useMutation({
    mutationFn: (subId: string) => patientPackagesService.refundPackage(subId),
    onSuccess: () => {
      notifications.show({
        title: "Refunded",
        message: "Subscription marked refunded.",
        color: "success",
      });
      void queryClient.invalidateQueries({ queryKey: ["patient-packages", patientId] });
    },
    onError: (err: Error) =>
      notifications.show({ title: "Refund failed", message: err.message, color: "danger" }),
  });

  const active = subs.filter((s) => s.status === "active");
  const others = subs.filter((s) => s.status !== "active");
  const canOpenSubscribe = canSubscribePackages && canViewPackageMasters;

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Text fw={600} size="sm">
            Active subscriptions ({active.length})
          </Text>
          <Text size="xs" c="dimmed">
            Bundle pricing — chronic care plans, follow-up packs, etc.
          </Text>
        </div>
        {canOpenSubscribe && (
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={subscribeHandlers.open}>
            Subscribe to package
          </Button>
        )}
      </Group>

      {isLoading && (
        <Text size="sm" c="dimmed">
          Loading…
        </Text>
      )}

      {!canViewPackages ? (
        <Card padding="md" withBorder>
          <Text size="sm" c="dimmed" ta="center">
            Package subscriptions are restricted for this role.
          </Text>
        </Card>
      ) : (
        <Stack gap="sm">
          {active.map((s) => (
            <SubscriptionCard
              key={s.id}
              sub={s}
              amountAccess={billingAmountAccess}
              canConsume={canConsumePackages}
              canRefund={canRefundPackages}
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

          {active.length === 0 && !isLoading && others.length > 0 && (
            <Card padding="md" withBorder>
              <Text size="sm" c="dimmed" ta="center">
                No active package subscriptions for this patient.
              </Text>
            </Card>
          )}
        </Stack>
      )}

      {canViewPackages && others.length > 0 && (
        <>
          <Divider label={`Past subscriptions (${others.length})`} />
          <Stack gap="xs">
            {others.map((s) => (
              <Card key={s.id} padding="sm" withBorder>
                <Group justify="space-between">
                  <Stack gap={2}>
                    <Group gap="xs">
                      <Badge size="xs" color={statusColor(s.status)}>
                        {s.status}
                      </Badge>
                      <Text size="sm" fw={500}>
                        {s.package_name ?? s.package_id.slice(0, 8)}
                      </Text>
                    </Group>
                    <Text size="xs" c="dimmed">
                      Purchased {new Date(s.purchased_at).toLocaleDateString()} •{" "}
                      {packageAmountText(billingAmountAccess, s.total_paid)}
                    </Text>
                  </Stack>
                </Group>
              </Card>
            ))}
          </Stack>
        </>
      )}

      {canViewPackages && active.length === 0 && !isLoading && others.length === 0 && (
        <Card padding="md" withBorder>
          <Text size="sm" c="dimmed" ta="center">
            No package subscriptions for this patient.
          </Text>
        </Card>
      )}

      {subscribeOpen && canOpenSubscribe && (
        <SubscribeModal
          patientId={patientId}
          amountAccess={billingAmountAccess}
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
  amountAccess,
  canConsume,
  canRefund,
  onConsumed,
  onRefund,
}: {
  sub: SubscriptionWithBalance;
  amountAccess: FieldAccessLevel;
  canConsume: boolean;
  canRefund: boolean;
  onConsumed: () => void;
  onRefund: () => void;
}) {
  const [consuming, setConsuming] = useState<string | null>(null);

  const consume = useMutation({
    mutationFn: ({ inclusion_type }: { inclusion_type: string }) =>
      patientPackagesService.consumePackage(sub.id, { inclusion_type, consumed_quantity: 1 }),
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
            <Badge size="xs" color="primary">
              Active
            </Badge>
          </Group>
          <Text size="xs" c="dimmed">
            {packageAmountText(amountAccess, sub.total_paid)} • Valid until{" "}
            {validUntil.toLocaleDateString()} ({daysLeft}d left)
          </Text>
        </Stack>
        {canRefund && (
          <Tooltip label="Mark as refunded">
            <ActionIcon variant="subtle" color="orange" onClick={onRefund}>
              <IconRefresh size={16} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>

      <Stack gap="xs">
        {sub.balances.map((b) => (
          <BalanceBar
            key={b.inclusion_id}
            balance={b}
            canConsume={canConsume}
            isConsuming={consuming === b.inclusion_id && consume.isPending}
            onConsume={() => {
              setConsuming(b.inclusion_id);
              consume.mutate({ inclusion_type: b.inclusion_type });
            }}
          />
        ))}
        {sub.balances.length === 0 && (
          <Text size="xs" c="dimmed">
            No inclusions defined for this package.
          </Text>
        )}
      </Stack>
    </Card>
  );
}

function BalanceBar({
  balance,
  canConsume,
  isConsuming,
  onConsume,
}: {
  balance: InclusionBalance;
  canConsume: boolean;
  isConsuming: boolean;
  onConsume: () => void;
}) {
  const pct =
    balance.included_quantity > 0
      ? Math.round((balance.consumed_quantity / balance.included_quantity) * 100)
      : 0;
  const exhausted = balance.remaining <= 0;
  return (
    <div>
      <Group justify="space-between" mb={4}>
        <Group gap="xs">
          <Badge size="xs" variant="light">
            {balance.inclusion_type}
          </Badge>
          <Text size="xs">
            {balance.consumed_quantity}/{balance.included_quantity} used
          </Text>
        </Group>
        <Group gap="xs">
          <Text size="xs" fw={500} c={exhausted ? "dimmed" : undefined}>
            {balance.remaining} left
          </Text>
          {canConsume && (
            <Button
              size="compact-xs"
              variant="light"
              disabled={exhausted}
              loading={isConsuming}
              onClick={onConsume}
            >
              Use 1
            </Button>
          )}
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
  amountAccess,
  onClose,
  onSubscribed,
}: {
  patientId: string;
  amountAccess: FieldAccessLevel;
  onClose: () => void;
  onSubscribed: () => void;
}) {
  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SubscribePackageFormInput>({
    resolver: zodResolver(subscribePackageFormSchema),
    defaultValues: {
      package_id: null,
      total_paid: "",
      notes: "",
    },
    mode: "onTouched",
  });
  const values = watch();

  const { data: packages = [] } = useQuery({
    queryKey: ["doctor-packages-active"],
    queryFn: () => patientPackagesService.listActiveDoctorPackages(),
  });

  const subscribe = useMutation({
    mutationFn: (formValues: SubscribePackageFormInput) =>
      patientPackagesService.subscribeToPackage({
        package_id: formValues.package_id ?? "",
        patient_id: patientId,
        total_paid: String(formValues.total_paid || 0),
        notes: formValues.notes || null,
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

  const selectedPackage = packages.find((p) => p.id === values.package_id);
  const submitSubscription = handleSubmit((formValues) => subscribe.mutate(formValues));

  return (
    <Modal opened onClose={onClose} title="Subscribe to package" size="md">
      <Stack gap="sm">
        <Controller
          control={control}
          name="package_id"
          render={({ field }) => (
            <Select
              label="Package"
              placeholder="Choose a package…"
              data={packages.map((p) => ({
                value: p.id,
                label: `${p.name} — ${packageAmountText(amountAccess, p.total_price)} (${p.validity_days}d)`,
              }))}
              value={field.value}
              onChange={(v) => {
                field.onChange(v);
                const pkg = packages.find((p) => p.id === v);
                if (pkg) setValue("total_paid", pkg.total_price, { shouldValidate: true });
              }}
              error={errors.package_id?.message}
              searchable
              required
            />
          )}
        />
        <Controller
          control={control}
          name="total_paid"
          render={({ field }) => (
            <NumberInput
              label="Amount paid (₹)"
              value={field.value}
              onChange={field.onChange}
              error={errors.total_paid?.message}
              min={0}
              required
            />
          )}
        />
        {selectedPackage?.description && (
          <Text size="xs" c="dimmed">
            {selectedPackage.description}
          </Text>
        )}
        <Controller
          control={control}
          name="notes"
          render={({ field }) => (
            <TextInput label="Notes (optional)" value={field.value} onChange={field.onChange} />
          )}
        />
        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={subscribe.isPending}
            disabled={!values.package_id || values.total_paid === ""}
            leftSection={<IconShoppingBag size={14} />}
            onClick={() => void submitSubscription()}
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
    case "active":
      return "primary";
    case "exhausted":
      return "gray";
    case "expired":
      return "orange";
    case "refunded":
      return "red";
    case "suspended":
      return "yellow";
    default:
      return "gray";
  }
}
