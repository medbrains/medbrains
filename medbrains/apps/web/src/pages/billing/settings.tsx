// Billing BillingSettingsTab — split from billing.tsx (pure move).

import { Group, Select, Stack, Switch, Text, TextInput } from "@mantine/core";
import { useHasAnyPermission, useHasPermission } from "@medbrains/stores";
import type { TenantSettingsRow } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, toast } from "@/components/ui";
import { billingService } from "@/services/billing.service";

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
  const queryClient = useQueryClient();
  // This tab had no gate of its own and rides in on the billing page's
  // invoice-list permission, while both its calls are tenant settings. A
  // refused read leaves settingsMap empty, so every auto-charge switch shows
  // off and the GSTIN field renders blank — and the GSTIN is a defaultValue
  // written back onBlur, so tabbing through the empty field would have
  // overwritten the hospital's real GST number with "".
  const canRead = useHasAnyPermission([P.ADMIN.SETTINGS_READ, P.ADMIN.SETTINGS_GENERAL_MANAGE]);
  const canManage = useHasPermission(P.ADMIN.SETTINGS_GENERAL_MANAGE);

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ["tenant-settings", "billing"],
    queryFn: () => billingService.getTenantSettings("billing"),
    enabled: canRead,
  });

  const settingsMap = new Map(settings.map((s: TenantSettingsRow) => [s.key, s.value]));

  const updateMutation = useMutation({
    mutationFn: (data: { category: string; key: string; value: unknown }) =>
      billingService.updateTenantSetting(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tenant-settings", "billing"] });
    },
    onError: () => {
      toast.error("Failed to update setting", { title: "Error" });
    },
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

  if (isLoading) return <Text c="dimmed">Loading settings...</Text>;

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
        Advance Settings
      </Text>
      <Switch
        label="Auto-adjust advance on invoice payment"
        description="Automatically apply available patient advance deposits when recording payments"
        checked={isEnabled("auto_adjust_advance")}
        onChange={() => toggle("auto_adjust_advance")}
        disabled={!canManage || updateMutation.isPending}
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
    </Stack>
  );
}

// ── Advances Tab ────────────────────────────────────────
