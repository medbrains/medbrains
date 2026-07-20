// Insurance RulesTab — split from insurance.tsx (pure move).

import {
  Drawer,
  NumberInput,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type { CreatePaRuleRequest, PaRequirementRule } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, PageHeader } from "@/components";
import { Badge, Button, toast } from "@/components/ui";
import { insuranceService } from "@/services/insurance.service";

export function RulesTab() {
  const qc = useQueryClient();
  const canManage = useHasPermission(P.INSURANCE.RULES_MANAGE);
  const [opened, { open, close }] = useDisclosure(false);

  const { data = [], isLoading } = useQuery({
    queryKey: ["insurance-rules"],
    queryFn: () => insuranceService.listPaRules(),
  });

  const [form, setForm] = useState<CreatePaRuleRequest>({ rule_name: "" });

  const createMut = useMutation({
    mutationFn: (d: CreatePaRuleRequest) => insuranceService.createPaRule(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["insurance-rules"] });
      toast.success("Created", { title: "PA Rule" });
      close();
    },
    onError: () => toast.error("Creation failed", { title: "Error" }),
  });

  const toggleMut = useMutation({
    mutationFn: (d: { id: string; is_active: boolean }) =>
      insuranceService.updatePaRule(d.id, { is_active: d.is_active }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["insurance-rules"] }),
  });

  return (
    <Stack gap="md">
      <PageHeader
        title="PA Requirement Rules"
        subtitle="Configure when prior authorization is required"
        actions={
          canManage ? (
            <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={open}>
              Add Rule
            </Button>
          ) : undefined
        }
      />

      <DataTable
        data={data}
        loading={isLoading}
        rowKey={(r: PaRequirementRule) => r.id}
        columns={[
          {
            key: "rule_name",
            label: "Rule Name",
            render: (r: PaRequirementRule) => (
              <Text size="sm" fw={500}>
                {r.rule_name}
              </Text>
            ),
          },
          {
            key: "service_type",
            label: "Service Type",
            render: (r: PaRequirementRule) => <Text size="sm">{r.service_type ?? "Any"}</Text>,
          },
          {
            key: "insurance_provider",
            label: "Provider",
            render: (r: PaRequirementRule) => (
              <Text size="sm">{r.insurance_provider ?? "Any"}</Text>
            ),
          },
          {
            key: "charge_code",
            label: "Code / Pattern",
            render: (r: PaRequirementRule) => (
              <Text size="sm">{r.charge_code ?? r.charge_code_pattern ?? "—"}</Text>
            ),
          },
          {
            key: "thresholds",
            label: "Thresholds",
            render: (r: PaRequirementRule) => (
              <Text size="sm">
                {r.cost_threshold != null ? `₹${r.cost_threshold}` : ""}
                {r.cost_threshold != null && r.los_threshold != null ? " / " : ""}
                {r.los_threshold != null ? `${r.los_threshold}d LOS` : ""}
                {r.cost_threshold == null && r.los_threshold == null ? "—" : ""}
              </Text>
            ),
          },
          {
            key: "priority",
            label: "Priority",
            render: (r: PaRequirementRule) => (
              <Badge variant="outline" tone="neutral">
                {r.priority}
              </Badge>
            ),
          },
          {
            key: "is_active",
            label: "Active",
            render: (r: PaRequirementRule) =>
              canManage ? (
                <Switch
                  checked={r.is_active}
                  onChange={(e) =>
                    toggleMut.mutate({ id: r.id, is_active: e.currentTarget.checked })
                  }
                />
              ) : (
                <Badge tone={r.is_active ? "success" : "neutral"}>
                  {r.is_active ? "Yes" : "No"}
                </Badge>
              ),
          },
        ]}
      />

      {/* Create Rule Drawer */}
      <Drawer
        opened={opened}
        onClose={close}
        title="Add PA Requirement Rule"
        position="right"
        size="xl"
      >
        <Stack gap="sm">
          <TextInput
            label="Rule Name"
            required
            value={form.rule_name}
            onChange={(e) => setForm({ ...form, rule_name: e.currentTarget.value })}
          />
          <Textarea
            label="Description"
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.currentTarget.value || undefined })}
          />
          <TextInput
            label="Insurance Provider (blank = all)"
            value={form.insurance_provider ?? ""}
            onChange={(e) =>
              setForm({ ...form, insurance_provider: e.currentTarget.value || undefined })
            }
          />
          <Select
            label="Scheme Type"
            clearable
            data={["private", "cghs", "echs", "pmjay", "esis", "state_scheme"]}
            value={form.scheme_type ?? null}
            onChange={(v) => setForm({ ...form, scheme_type: v ?? undefined })}
          />
          <TextInput
            label="TPA Name"
            value={form.tpa_name ?? ""}
            onChange={(e) => setForm({ ...form, tpa_name: e.currentTarget.value || undefined })}
          />
          <TextInput
            label="Service Type"
            value={form.service_type ?? ""}
            onChange={(e) => setForm({ ...form, service_type: e.currentTarget.value || undefined })}
          />
          <TextInput
            label="Charge Code"
            value={form.charge_code ?? ""}
            onChange={(e) => setForm({ ...form, charge_code: e.currentTarget.value || undefined })}
          />
          <TextInput
            label="Charge Code Pattern (regex)"
            value={form.charge_code_pattern ?? ""}
            onChange={(e) =>
              setForm({ ...form, charge_code_pattern: e.currentTarget.value || undefined })
            }
          />
          <NumberInput
            label="Cost Threshold (₹)"
            min={0}
            decimalScale={2}
            value={form.cost_threshold ?? ""}
            onChange={(v) =>
              setForm({ ...form, cost_threshold: typeof v === "number" ? v : undefined })
            }
          />
          <NumberInput
            label="LOS Threshold (days)"
            min={0}
            value={form.los_threshold ?? ""}
            onChange={(v) =>
              setForm({ ...form, los_threshold: typeof v === "number" ? v : undefined })
            }
          />
          <NumberInput
            label="Priority"
            min={0}
            value={form.priority ?? 0}
            onChange={(v) => setForm({ ...form, priority: typeof v === "number" ? v : undefined })}
          />
          <Button
            tone="primary"
            loading={createMut.isPending}
            onClick={() => createMut.mutate(form)}
          >
            Create Rule
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ═══════════════════════════════════════════════════════
//  Tab 5 — Dashboard
// ═══════════════════════════════════════════════════════
