// Billing BillingSettingsTab — split from billing.tsx (pure move).

import { Group, Select, Stack, Switch, Text, TextInput } from "@mantine/core";
import { useHasAnyPermission, useHasPermission } from "@medbrains/stores";
import type { TenantSettingsRow, UpdateBillingPaymentSettings } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QueryError } from "@/components/QueryError";
import { Alert, toast } from "@/components/ui";
import { billingService } from "@/services/billing.service";
import { ExchangeRatesSection } from "./exchange-rates-section";
import { BillingLanesSettings } from "./lanes-settings";
import { NonPayablesCard } from "./NonPayablesCard";
import { PaymentLinkSettingsCard } from "./PaymentLinkSettingsCard";
import { PreauthAlertThresholdCard } from "./PreauthAlertThresholdCard";
import { RevisitWindowCard } from "./RevisitWindowCard";

const AUTO_BILLING_KEYS = [
  {
    key: "auto_charge_opd",
    label: "OPD Consultation",
    description: "Auto-charge when an OPD visit is completed",
  },
  {
    key: "auto_charge_lab",
    label: "Lab Tests",
    description: "Auto-charge when a lab order is completed",
  },
  {
    key: "auto_charge_pharmacy",
    label: "Pharmacy Dispensing",
    description: "Auto-charge when a pharmacy order is dispensed",
  },
  {
    key: "auto_charge_radiology",
    label: "Radiology Exams",
    description: "Auto-charge when a radiology order is completed",
  },
  {
    key: "auto_charge_ipd_room",
    label: "IPD Room Charges",
    description: "Auto-charge room/bed fees on patient discharge",
  },
] as const;

export function BillingSettingsTab() {
  return (
    <Stack gap="xl">
      <BillingLanesSettings />
      <BillingTenantSettings />
      <ExchangeRatesSection />
    </Stack>
  );
}

function BillingTenantSettings() {
  const queryClient = useQueryClient();
  // This tab had no gate of its own and rides in on the billing page's
  // invoice-list permission, while both its calls are tenant settings. A
  // refused read leaves settingsMap empty, so every auto-charge switch shows
  // off and the GSTIN field renders blank — and the GSTIN is a defaultValue
  // written back onBlur, so tabbing through the empty field would have
  // overwritten the hospital's real GST number with "".
  const canRead = useHasAnyPermission([P.ADMIN.SETTINGS_READ, P.ADMIN.SETTINGS_GENERAL_MANAGE]);
  const canManage = useHasPermission(P.ADMIN.SETTINGS_GENERAL_MANAGE);

  const {
    data: settings = [],
    isLoading,
    error: settingsError,
    refetch: refetchSettings,
  } = useQuery({
    queryKey: ["tenant-settings", "billing"],
    queryFn: () => billingService.getTenantSettings("billing"),
    enabled: canRead,
  });

  const settingsMap = new Map(settings.map((s: TenantSettingsRow) => [s.key, s.value]));
  // The UPI ID and link terms have their own endpoint and permission: the
  // `payments` category also holds provider keys, which this screen never reads.
  const canViewPayments = useHasPermission(P.BILLING.PAYMENT_SETTINGS.VIEW);
  const canManagePayments = useHasPermission(P.BILLING.PAYMENT_SETTINGS.MANAGE);
  const {
    data: paymentSettings,
    isLoading: paymentsLoading,
    error: paymentsError,
    refetch: refetchPayments,
  } = useQuery({
    queryKey: ["billing-payment-settings"],
    queryFn: () => billingService.getBillingPaymentSettings(),
    enabled: canViewPayments,
  });
  const upiVpa = paymentSettings?.upi_vpa ?? "";

  const paymentsMutation = useMutation({
    mutationFn: (data: UpdateBillingPaymentSettings) =>
      billingService.updateBillingPaymentSettings(data),
    onSuccess: (saved) => queryClient.setQueryData(["billing-payment-settings"], saved),
    onError: (err: Error) => toast.error(err.message, { title: "Payment settings not saved" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: { category: string; key: string; value: unknown }) =>
      billingService.updateTenantSetting(data),
    onSuccess: (_, data) => {
      void queryClient.invalidateQueries({ queryKey: ["tenant-settings", data.category] });
    },
    onError: (err: Error) => toast.error(err.message, { title: "Setting not saved" }),
  });

  const isEnabled = (key: string) =>
    settingsMap.get(key) === true || settingsMap.get(key) === "true";

  const toggle = (key: string) => {
    const current = isEnabled(key);
    updateMutation.mutate({ category: "billing", key, value: !current });
  };

  const getStrVal = (key: string) => {
    const v = settingsMap.get(key);
    return typeof v === "string" ? v : "";
  };

  const updateStr = (key: string, value: string) => {
    updateMutation.mutate({ category: "billing", key, value });
  };

  if (!canRead) {
    return (
      <Alert tone="warning">
        <Text size="sm">
          You do not have permission to read billing settings. Nothing is shown here rather than a
          set of blank defaults, which would misstate this hospital&apos;s GST configuration.
        </Text>
      </Alert>
    );
  }

  if (isLoading || (canViewPayments && paymentsLoading)) {
    return <Text c="dimmed">Loading settings...</Text>;
  }

  // A failed read must not render as blank defaults: the GSTIN is written back
  // on blur, so tabbing through an empty field would erase the real number,
  // and every auto-charge switch would read "off".
  if (settingsError) {
    return (
      <QueryError
        title="Billing settings did not load"
        error={settingsError}
        onRetry={() => void refetchSettings()}
      />
    );
  }
  const paymentsReady = canViewPayments && !paymentsError;

  return (
    <Stack>
      <Text fw={600}>GST Configuration</Text>
      <Text size="sm" c="dimmed">
        Configure GST details for tax computation on invoices. CGST/SGST applies for intra-state
        transactions, IGST for inter-state.
      </Text>
      <Group grow>
        <TextInput
          label="GSTIN"
          placeholder="e.g. 33AABCU9603R1ZM"
          defaultValue={getStrVal("gst_number")}
          disabled={!canManage}
          onBlur={(e) => updateStr("gst_number", e.currentTarget.value)}
        />
        <TextInput
          label="State Code"
          placeholder="e.g. 33 (Tamil Nadu)"
          defaultValue={getStrVal("gst_state_code")}
          disabled={!canManage}
          onBlur={(e) => updateStr("gst_state_code", e.currentTarget.value)}
        />
        <Select
          label="Default GST Type"
          data={[
            { value: "cgst_sgst", label: "CGST + SGST (Intra-State)" },
            { value: "igst", label: "IGST (Inter-State)" },
            { value: "exempt", label: "Exempt" },
          ]}
          value={getStrVal("default_gst_type") || "exempt"}
          disabled={!canManage}
          onChange={(v) => {
            if (v) updateStr("default_gst_type", v);
          }}
        />
      </Group>

      <Text fw={600} mt="lg">
        Bill details
      </Text>
      <Text size="sm" c="dimmed">
        Printed on every bill. The drug licence numbers appear on pharmacy bills; the UPI ID puts a
        scan-to-pay QR for the balance on the bill and at the payment counter.
      </Text>
      <TextInput
        label="Address on bills"
        placeholder="e.g. 1 Hospital Road, Karaikudi 630001"
        defaultValue={getStrVal("bill_address")}
        disabled={!canManage}
        onBlur={(e) => updateStr("bill_address", e.currentTarget.value.trim())}
      />
      <Group grow>
        <TextInput
          label="Drug licence numbers"
          description="Form 20 / Form 21, as on the licence"
          placeholder="e.g. TN-20B-1234 / TN-21B-1235"
          defaultValue={getStrVal("drug_licence")}
          disabled={!canManage}
          onBlur={(e) => updateStr("drug_licence", e.currentTarget.value.trim())}
        />
        {paymentsReady && (
          <TextInput
            label="UPI ID"
            description="Payments to this ID go to the hospital's account. Management is told of every change."
            placeholder="e.g. hospital@okaxis"
            defaultValue={upiVpa}
            disabled={!canManagePayments}
            onBlur={(e) => {
              const next = e.currentTarget.value.trim();
              if (next === upiVpa) return;
              paymentsMutation.mutate(
                { upi_vpa: next },
                {
                  onSuccess: () =>
                    toast.success("Management has been told of the change.", {
                      title: "UPI ID saved",
                    }),
                },
              );
            }}
          />
        )}
      </Group>

      {canViewPayments && paymentsError && (
        <QueryError
          title="The UPI ID and payment link terms did not load"
          error={paymentsError}
          onRetry={() => void refetchPayments()}
        />
      )}
      {paymentsReady && (
        <PaymentLinkSettingsCard
          value={paymentSettings?.balance_link}
          canManage={canManagePayments}
          saving={paymentsMutation.isPending}
          onSave={(value) =>
            paymentsMutation.mutate(
              { balance_link: value },
              { onSuccess: () => toast.success("Payment link terms saved", { title: "Billing" }) },
            )
          }
        />
      )}

      <Text fw={600} mt="lg">
        Advance Settings
      </Text>
      <Switch
        label="Auto-adjust advance on invoice payment"
        description="Automatically apply available patient advance deposits when recording payments"
        checked={isEnabled("auto_adjust_advance")}
        onChange={() => toggle("auto_adjust_advance")}
        disabled={!canManage || updateMutation.isPending}
      />

      <RevisitWindowCard
        value={settingsMap.get("opd_revisit")}
        canManage={canManage}
        saving={updateMutation.isPending}
        onSave={(policy) =>
          updateMutation.mutate({ category: "billing", key: "opd_revisit", value: policy })
        }
      />

      <NonPayablesCard
        canManage={canManage}
        saving={updateMutation.isPending}
        onSave={(rules) =>
          updateMutation.mutate(
            { category: "billing", key: "non_payables", value: rules },
            {
              onSuccess: () => {
                void queryClient.invalidateQueries({ queryKey: ["non-payables"] });
                toast.success("Non-payables list saved", { title: "Billing" });
              },
            },
          )
        }
      />

      <Text fw={600} mt="lg">
        Auto-Billing
      </Text>
      <Text size="sm" c="dimmed">
        When enabled, invoices are automatically created or updated when services are completed.
        Charges use the Charge Master and Rate Plans for pricing.
      </Text>
      {AUTO_BILLING_KEYS.map(({ key, label, description }) => (
        <Switch
          key={key}
          label={label}
          description={description}
          checked={isEnabled(key)}
          onChange={() => toggle(key)}
          disabled={!canManage || updateMutation.isPending}
        />
      ))}

      <Text fw={600} mt="lg">
        Room-category pricing
      </Text>
      <Switch
        label="Charges differ by room category (differential billing)"
        description="On (the default): an insurer may cut room-linked charges in proportion when a patient takes a room above the policy limit, and the desk warns before allocating. Off: this hospital charges the same in every room, so IRDAI allows no such cut."
        checked={
          settingsMap.get("differential_billing") !== false &&
          settingsMap.get("differential_billing") !== "false"
        }
        onChange={(e) =>
          updateMutation.mutate({
            category: "billing",
            key: "differential_billing",
            value: e.currentTarget.checked,
          })
        }
        disabled={!canManage || updateMutation.isPending}
      />

      <PreauthAlertThresholdCard />
    </Stack>
  );
}

// ── Advances Tab ────────────────────────────────────────
