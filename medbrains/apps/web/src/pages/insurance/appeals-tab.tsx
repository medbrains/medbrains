// Insurance AppealsTab — split from insurance.tsx (pure move).

import { Drawer, Group, Select, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type { CreateAppealRequest, PriorAuthAppeal, UpdateAppealRequest } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus, IconSend } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, PageHeader } from "@/components";
import { Badge, type BadgeTone, Button, IconButton, toast } from "@/components/ui";
import { insuranceService } from "@/services/insurance.service";

const appealStatusColors: Record<string, BadgeTone> = {
  draft: "neutral",
  submitted: "primary",
  in_review: "warning",
  upheld: "danger",
  overturned: "success",
  withdrawn: "neutral",
};

export function AppealsTab() {
  const qc = useQueryClient();
  const canCreate = useHasPermission(P.INSURANCE.APPEALS_CREATE);
  const [opened, { open, close }] = useDisclosure(false);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["insurance-appeals", filterStatus],
    queryFn: () => insuranceService.listAppeals({ status: filterStatus ?? undefined }),
  });

  const [form, setForm] = useState<CreateAppealRequest>({
    prior_auth_id: "",
  });

  const createMut = useMutation({
    mutationFn: (d: CreateAppealRequest) => insuranceService.createAppeal(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["insurance-appeals"] });
      toast.success("Created successfully", { title: "Appeal" });
      close();
    },
    onError: () => toast.error("Creation failed", { title: "Error" }),
  });

  const updateMut = useMutation({
    mutationFn: (d: { id: string; body: UpdateAppealRequest }) =>
      insuranceService.updateAppeal(d.id, d.body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["insurance-appeals"] });
      toast.success("Updated", { title: "Appeal" });
    },
    onError: () => toast.error("Update failed", { title: "Error" }),
  });

  return (
    <Stack gap="md">
      <PageHeader
        title="Denial Appeals"
        subtitle="Manage appeals for denied prior authorizations"
        actions={
          canCreate ? (
            <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={open}>
              New Appeal
            </Button>
          ) : undefined
        }
      />

      <Group>
        <Select
          placeholder="Filter by status"
          clearable
          data={["draft", "submitted", "in_review", "upheld", "overturned", "withdrawn"]}
          value={filterStatus}
          onChange={setFilterStatus}
          w={200}
        />
      </Group>

      <DataTable
        data={data}
        loading={isLoading}
        rowKey={(r: PriorAuthAppeal) => r.id}
        columns={[
          {
            key: "appeal_number",
            label: "Appeal #",
            render: (r: PriorAuthAppeal) => (
              <Text size="sm" fw={500}>
                {r.appeal_number}
              </Text>
            ),
          },
          {
            key: "prior_auth_id",
            label: "PA ID",
            render: (r: PriorAuthAppeal) => <Text size="sm">{r.prior_auth_id.slice(0, 8)}...</Text>,
          },
          {
            key: "level",
            label: "Level",
            render: (r: PriorAuthAppeal) => (
              <Badge variant="outline" tone="neutral">
                {r.level}
              </Badge>
            ),
          },
          {
            key: "status",
            label: "Status",
            render: (r: PriorAuthAppeal) => (
              <Badge tone={appealStatusColors[r.status] ?? "neutral"}>
                {r.status.replace(/_/g, " ")}
              </Badge>
            ),
          },
          {
            key: "deadline",
            label: "Deadline",
            render: (r: PriorAuthAppeal) => (
              <Text
                size="sm"
                c={r.deadline && new Date(r.deadline) < new Date() ? "danger" : undefined}
              >
                {r.deadline ?? "—"}
              </Text>
            ),
          },
          {
            key: "created_at",
            label: "Created",
            render: (r: PriorAuthAppeal) => (
              <Text size="sm">{new Date(r.created_at).toLocaleDateString()}</Text>
            ),
          },
          {
            key: "actions",
            label: "",
            render: (r: PriorAuthAppeal) => (
              <Group gap={4}>
                {canCreate && r.status === "draft" && (
                  <IconButton
                    tone="primary"
                    onClick={() => updateMut.mutate({ id: r.id, body: { status: "submitted" } })}
                    aria-label="Send"
                  >
                    <IconSend size={16} />
                  </IconButton>
                )}
              </Group>
            ),
          },
        ]}
      />

      {/* Create Appeal Drawer */}
      <Drawer opened={opened} onClose={close} title="New Appeal" position="right" size="xl">
        <Stack gap="sm">
          <TextInput
            label="Prior Auth ID (denied PA)"
            required
            value={form.prior_auth_id}
            onChange={(e) => setForm({ ...form, prior_auth_id: e.currentTarget.value })}
          />
          <Textarea
            label="Reason"
            value={form.reason ?? ""}
            onChange={(e) => setForm({ ...form, reason: e.currentTarget.value || undefined })}
          />
          <Textarea
            label="Clinical Rationale"
            minRows={3}
            value={form.clinical_rationale ?? ""}
            onChange={(e) =>
              setForm({ ...form, clinical_rationale: e.currentTarget.value || undefined })
            }
          />
          <Textarea
            label="Supporting Evidence"
            minRows={2}
            value={form.supporting_evidence ?? ""}
            onChange={(e) =>
              setForm({ ...form, supporting_evidence: e.currentTarget.value || undefined })
            }
          />
          <Textarea
            label="Appeal Letter Content"
            minRows={4}
            value={form.letter_content ?? ""}
            onChange={(e) =>
              setForm({ ...form, letter_content: e.currentTarget.value || undefined })
            }
          />
          <Button
            tone="primary"
            loading={createMut.isPending}
            onClick={() => createMut.mutate(form)}
          >
            Create Appeal
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ═══════════════════════════════════════════════════════
//  Tab 4 — PA Rules
// ═══════════════════════════════════════════════════════
