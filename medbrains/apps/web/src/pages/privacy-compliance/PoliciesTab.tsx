// The policy pack: each policy in each language, what is published, what is
// being drafted, and every past version.

import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { type CompliancePolicy, type CompliancePolicyKind, P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { type Column, DataTable } from "@/components";
import { Badge, Button, toast } from "@/components/ui";
import { LANGUAGE_LABEL, type PolicySlot, policySlots } from "@/lib/privacy-compliance";
import { privacyComplianceService } from "@/services/privacyCompliance.service";
import { CounselNotice } from "./CounselNotice";
import { PolicyEditorModal } from "./PolicyEditorModal";

export function PoliciesTab() {
  const qc = useQueryClient();
  const canDraft = useHasPermission(P.REGULATORY.DPDP.POLICY_DRAFT);
  const [open, setOpen] = useState<CompliancePolicy | null>(null);
  const templates = useQuery({
    queryKey: ["privacy-compliance", "templates"],
    queryFn: () => privacyComplianceService.listTemplates(),
  });
  const policies = useQuery({
    queryKey: ["privacy-compliance", "policies"],
    queryFn: () => privacyComplianceService.listPolicies(),
  });
  const slots = useMemo(() => policySlots(policies.data ?? []), [policies.data]);
  const titleOf = (kind: CompliancePolicyKind) =>
    templates.data?.find((t) => t.kind === kind)?.title ?? kind;
  const basisOf = (kind: CompliancePolicyKind) =>
    templates.data?.find((t) => t.kind === kind)?.legal_basis ?? "";
  const start = useMutation({
    mutationFn: (s: PolicySlot) =>
      privacyComplianceService.startDraft({ kind: s.kind, language: s.language }),
    onSuccess: (p) => {
      void qc.invalidateQueries({ queryKey: ["privacy-compliance"] });
      setOpen(p);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const columns: Column<PolicySlot>[] = [
    {
      key: "policy",
      label: "Policy",
      render: (s) => (
        <Stack gap={0}>
          <Text size="sm" fw={600}>
            {titleOf(s.kind)} · {LANGUAGE_LABEL[s.language]}
          </Text>
          <Text size="xs" c="dimmed">
            {basisOf(s.kind)}
          </Text>
        </Stack>
      ),
    },
    {
      key: "published",
      label: "Published",
      render: (s) =>
        s.published ? (
          <Button tone="ghost" size="xs" onClick={() => setOpen(s.published)}>
            Version {s.published.version} ·{" "}
            {new Date(s.published.published_at ?? "").toLocaleDateString()}
          </Button>
        ) : (
          <Badge tone="danger">Not published</Badge>
        ),
    },
    {
      key: "draft",
      label: "In progress",
      render: (s) =>
        s.open ? (
          <Button tone="secondary" size="xs" onClick={() => setOpen(s.open)}>
            Version {s.open.version} · {s.open.status.replace("_", " ")}
          </Button>
        ) : canDraft ? (
          <Button
            tone="primary"
            size="xs"
            onClick={() => start.mutate(s)}
            loading={start.isPending}
          >
            {s.published ? "Start new version" : "Start from template"}
          </Button>
        ) : (
          <Text size="sm">—</Text>
        ),
    },
  ];
  return (
    <Stack>
      <CounselNotice />
      <DataTable
        columns={columns}
        data={slots}
        loading={policies.isLoading}
        error={policies.error}
        onRetry={() => policies.refetch()}
        rowKey={(s) => `${s.kind}-${s.language}`}
        caption="Privacy policy pack"
        captionVisuallyHidden
      />
      {(policies.data ?? []).some((p) => p.status === "superseded") && (
        <Stack gap={4}>
          <Text size="sm" fw={600}>
            Earlier versions
          </Text>
          <Group gap="xs">
            {(policies.data ?? [])
              .filter((p) => p.status === "superseded")
              .map((p) => (
                <Button key={p.id} tone="ghost" size="xs" onClick={() => setOpen(p)}>
                  {titleOf(p.kind)} · {LANGUAGE_LABEL[p.language]} v{p.version}
                </Button>
              ))}
          </Group>
        </Stack>
      )}
      <Group>
        <Text size="xs" c="dimmed">
          A published policy is never edited: a change is a new version, approved by someone other
          than its drafter. Superseded versions stay on record.
        </Text>
      </Group>
      {open && <PolicyEditorModal policy={open} onClose={() => setOpen(null)} />}
    </Stack>
  );
}
