import { Card, Divider, Group, Loader, Stack, Switch, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { ComplianceSettings as ComplianceFlags, TenantSettingsRow } from "@medbrains/types";
import { IconAlertTriangle, IconShieldCheck } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Alert } from "@/components/ui";
import { tenantSettingsService } from "@/services/tenantSettings.service";

const DEFAULT_COMPLIANCE: ComplianceFlags = {
  enforce_drug_scheduling: false,
  enforce_ndps_tracking: false,
  enforce_formulary: false,
  enforce_drug_interactions: false,
  enforce_antibiotic_stewardship: false,
  enforce_lasa_warnings: false,
  enforce_max_dose_check: false,
  enforce_batch_tracking: false,
  show_schedule_badges: true,
  show_controlled_warnings: true,
  show_formulary_status: true,
  show_aware_category: true,
};

interface ToggleItem {
  key: keyof ComplianceFlags;
  label: string;
  description: string;
}

const DISPLAY_TOGGLES: ToggleItem[] = [
  {
    key: "show_schedule_badges",
    label: "Drug Schedule Badges",
    description: "Show Schedule H/H1/X/OTC badges on drugs in catalog and prescription",
  },
  {
    key: "show_controlled_warnings",
    label: "Controlled Substance Warnings",
    description: "Show CTRL badge and warnings for NDPS/controlled drugs",
  },
  {
    key: "show_formulary_status",
    label: "Formulary Status",
    description: "Show Approved/Restricted/Non-Formulary status on drugs",
  },
  {
    key: "show_aware_category",
    label: "AWaRe Category",
    description: "Show WHO Access/Watch/Reserve classification for antibiotics",
  },
];

const ENFORCEMENT_TOGGLES: ToggleItem[] = [
  {
    key: "enforce_drug_scheduling",
    label: "Drug Scheduling Enforcement",
    description:
      "Require valid drug schedule for all catalog entries. Warn on Schedule X prescriptions.",
  },
  {
    key: "enforce_ndps_tracking",
    label: "NDPS Act Compliance",
    description:
      "Require narcotic register entries for controlled substance dispensing (NDPS Act 1985)",
  },
  {
    key: "enforce_formulary",
    label: "Formulary Enforcement",
    description:
      "Block or warn when prescribing non-formulary drugs. Require DTC approval workflow.",
  },
  {
    key: "enforce_drug_interactions",
    label: "Drug Interaction Checks",
    description:
      "Check drug-drug interactions before prescribing/dispensing (requires interaction database)",
  },
  {
    key: "enforce_antibiotic_stewardship",
    label: "Antibiotic Stewardship",
    description: "Enforce WHO AWaRe classification. Require approval for Reserve antibiotics.",
  },
  {
    key: "enforce_lasa_warnings",
    label: "LASA Warnings",
    description: "Show Look-Alike Sound-Alike drug warnings during prescription and dispensing",
  },
  {
    key: "enforce_max_dose_check",
    label: "Max Dose Validation",
    description: "Validate prescribed dose against maximum daily dose limits",
  },
  {
    key: "enforce_batch_tracking",
    label: "Batch Tracking",
    description: "Require batch/lot number and expiry date during dispensing",
  },
];

function isComplianceKey(key: string): key is keyof ComplianceFlags {
  return key in DEFAULT_COMPLIANCE;
}

export function ComplianceSettingsTab() {
  const queryClient = useQueryClient();

  const { data: raw = [], isLoading } = useQuery({
    queryKey: ["tenant-settings", "compliance"],
    queryFn: () => tenantSettingsService.getTenantSettings("compliance"),
    staleTime: 300_000,
  });

  const settings = useMemo(() => {
    const result = { ...DEFAULT_COMPLIANCE };
    for (const row of raw) {
      if (isComplianceKey(row.key)) {
        result[row.key] = row.value === true || row.value === "true";
      }
    }
    return result;
  }, [raw]);

  const updateMutation = useMutation({
    mutationFn: (data: { key: string; value: boolean }) =>
      tenantSettingsService.updateTenantSetting({
        category: "compliance",
        key: data.key,
        value: data.value,
      }),
    onSuccess: (_data, variables) => {
      queryClient.setQueryData<TenantSettingsRow[]>(["tenant-settings", "compliance"], (old) => {
        if (!old) return old;
        const exists = old.find((r) => r.key === variables.key);
        if (exists) {
          return old.map((r) => (r.key === variables.key ? { ...r, value: variables.value } : r));
        }
        return [
          ...old,
          {
            id: "",
            tenant_id: "",
            category: "compliance",
            key: variables.key,
            value: variables.value,
            created_at: "",
            updated_at: "",
          },
        ];
      });
      notifications.show({
        title: "Updated",
        message: `${variables.key} updated`,
        color: "success",
      });
    },
  });

  const handleToggle = (key: keyof ComplianceFlags, checked: boolean) => {
    updateMutation.mutate({ key, value: checked });
  };

  if (isLoading) {
    return <Loader size="sm" />;
  }

  return (
    <Stack gap="lg">
      <Alert icon={<IconShieldCheck size={20} />} tone="info">
        <Text size="sm">
          Configure which regulatory compliance features are active for your hospital. Display
          settings control visibility of badges and labels. Enforcement settings add validation
          rules that must be satisfied before prescribing or dispensing.
        </Text>
      </Alert>

      <Card padding="md" radius="md" withBorder>
        <Title order={5} mb="sm">
          Display Settings
        </Title>
        <Text size="xs" c="dimmed" mb="md">
          Control which regulatory indicators are shown in the drug catalog, prescription writer,
          and pharmacy module.
        </Text>
        <Stack gap="sm">
          {DISPLAY_TOGGLES.map((item) => (
            <Group key={item.key} justify="space-between" wrap="nowrap">
              <div>
                <Text size="sm" fw={500}>
                  {item.label}
                </Text>
                <Text size="xs" c="dimmed">
                  {item.description}
                </Text>
              </div>
              <Switch
                checked={settings[item.key]}
                onChange={(e) => handleToggle(item.key, e.currentTarget.checked)}
                disabled={updateMutation.isPending}
              />
            </Group>
          ))}
        </Stack>
      </Card>

      <Divider />

      <Card padding="md" radius="md" withBorder>
        <Group gap="xs" mb="sm">
          <IconAlertTriangle size={18} color="var(--mantine-color-orange-6)" />
          <Title order={5}>Enforcement Settings</Title>
        </Group>
        <Text size="xs" c="dimmed" mb="md">
          When enabled, these rules will block or warn on non-compliant actions. Enable only after
          ensuring your drug catalog has the required regulatory data populated.
        </Text>
        <Stack gap="sm">
          {ENFORCEMENT_TOGGLES.map((item) => (
            <Group key={item.key} justify="space-between" wrap="nowrap">
              <div>
                <Text size="sm" fw={500}>
                  {item.label}
                </Text>
                <Text size="xs" c="dimmed">
                  {item.description}
                </Text>
              </div>
              <Switch
                checked={settings[item.key]}
                onChange={(e) => handleToggle(item.key, e.currentTarget.checked)}
                disabled={updateMutation.isPending}
                color="orange"
              />
            </Group>
          ))}
        </Stack>
      </Card>
    </Stack>
  );
}
