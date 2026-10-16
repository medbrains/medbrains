/**
 * The register of everyone who processes patient data for the hospital. The
 * entries that need the privacy officer first — no agreement, a lapsed one,
 * data kept abroad — say so.
 */
import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { type DataProcessor, P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { Badge, type BadgeTone, Button, Drawer, toast } from "@/components/ui";
import { auditService } from "@/services/audit.service";
import { ProcessorForm } from "./processor-form";

const DPA: Record<DataProcessor["dpa_state"], { tone: BadgeTone; label: string }> = {
  missing: { tone: "danger", label: "No agreement" },
  expired: { tone: "danger", label: "Agreement lapsed" },
  expiring: { tone: "warning", label: "Agreement ending" },
  in_force: { tone: "success", label: "Agreement in force" },
};

export function DataProcessorsTab() {
  const canManage = useHasPermission(P.AUDIT.PROCESSORS_MANAGE);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<DataProcessor | "new" | null>(null);
  const processors = useQuery({
    queryKey: ["data-processors"],
    queryFn: auditService.listDataProcessors,
  });
  const save = useMutation({
    mutationFn: (input: Parameters<typeof auditService.createDataProcessor>[0]) =>
      editing && editing !== "new"
        ? auditService.updateDataProcessor(editing.id, input)
        : auditService.createDataProcessor(input),
    onSuccess: () => {
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ["data-processors"] });
      toast.success("Register updated");
    },
  });
  const all = processors.data ?? [];
  return (
    <Stack gap="md">
      {canManage && (
        <Group justify="flex-end">
          <Button tone="primary" onClick={() => setEditing("new")}>
            Add processor
          </Button>
        </Group>
      )}
      <DataTable
        data={all}
        loading={processors.isLoading}
        error={processors.error}
        onRetry={() => void processors.refetch()}
        rowKey={(r) => r.id}
        emptyTitle="No processors on the register"
        emptyDescription="Add every outside service that handles patient data: hosting, SMS, payments, AI."
        columns={[
          {
            key: "name",
            label: "Processor",
            render: (r) => (
              <Stack gap={0}>
                <Text size="sm" fw={600} td={r.status === "retired" ? "line-through" : undefined}>
                  {r.name}
                </Text>
                <Text size="xs" c="dimmed">
                  {r.service}
                  {r.sub_processor_of_name ? ` · via ${r.sub_processor_of_name}` : ""}
                </Text>
              </Stack>
            ),
          },
          {
            key: "data",
            label: "Receives",
            render: (r) => <Text size="sm">{r.data_categories.join(", ") || "—"}</Text>,
          },
          {
            key: "country",
            label: "Kept in",
            render: (r) =>
              r.country === "IN" ? (
                <Text size="sm">India</Text>
              ) : (
                <Badge tone="warning">{r.country} · outside India</Badge>
              ),
          },
          {
            key: "dpa",
            label: "Agreement",
            render: (r) => <Badge tone={DPA[r.dpa_state].tone}>{DPA[r.dpa_state].label}</Badge>,
          },
          {
            key: "edit",
            label: "",
            render: (r) =>
              canManage ? (
                <Button tone="secondary" size="compact-xs" onClick={() => setEditing(r)}>
                  Edit
                </Button>
              ) : null,
          },
        ]}
      />
      <Drawer
        opened={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Add processor" : "Edit processor"}
        position="right"
        size="md"
      >
        {editing !== null && (
          <ProcessorForm
            key={editing === "new" ? "new" : editing.id}
            processor={editing === "new" ? null : editing}
            others={all}
            saving={save.isPending}
            error={save.error}
            onSave={(input) => save.mutate(input)}
          />
        )}
      </Drawer>
    </Stack>
  );
}
