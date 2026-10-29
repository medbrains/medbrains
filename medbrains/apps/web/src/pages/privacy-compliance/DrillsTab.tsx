// Breach-response drills: when the plan was last rehearsed, what it found,
// and when the next one is due.

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import { type ComplianceDrill, P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { type Column, DataTable, FormModal } from "@/components";
import { Badge, Button, Input, Select, TextArea, toast } from "@/components/ui";
import { daysUntil } from "@/lib/privacy-compliance";
import { privacyComplianceService } from "@/services/privacyCompliance.service";

const today = () => new Date().toISOString().slice(0, 10);

const schema = z.object({
  held_on: z
    .string()
    .min(1, "When was it held?")
    .refine((d) => d <= today(), "A drill is recorded after it is held"),
  format: z.enum(["tabletop", "live"]),
  scenario: z.string().trim().min(3, "What was rehearsed?"),
  findings: z.string().trim().min(3, "What did it find?"),
  next_due_on: z.string(),
});

type FormValues = z.infer<typeof schema>;

export function DrillsTab() {
  const qc = useQueryClient();
  const canRecord = useHasPermission(P.REGULATORY.DPDP.DRILLS);
  const [opened, modal] = useDisclosure(false);
  const drills = useQuery({
    queryKey: ["privacy-compliance", "drills"],
    queryFn: () => privacyComplianceService.listDrills(),
  });
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      held_on: today(),
      format: "tabletop",
      scenario: "",
      findings: "",
      next_due_on: "",
    },
  });
  const record = useMutation({
    mutationFn: (v: FormValues) =>
      privacyComplianceService.recordDrill({ ...v, next_due_on: v.next_due_on || undefined }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["privacy-compliance"] });
      toast.success("Drill recorded");
      form.reset();
      modal.close();
    },
  });
  const columns: Column<ComplianceDrill>[] = [
    { key: "held_on", label: "Held", render: (d) => <Text size="sm">{d.held_on}</Text> },
    {
      key: "format",
      label: "Format",
      render: (d) => <Text size="sm">{d.format === "live" ? "Live drill" : "Tabletop"}</Text>,
    },
    { key: "scenario", label: "Scenario", render: (d) => <Text size="sm">{d.scenario}</Text> },
    { key: "findings", label: "Findings", render: (d) => <Text size="sm">{d.findings}</Text> },
    {
      key: "next",
      label: "Next due",
      render: (d) => {
        const days = daysUntil(d.next_due_on);
        return (
          <Group gap={4}>
            <Text size="sm">{d.next_due_on}</Text>
            {days < 0 && <Badge tone="danger">Overdue</Badge>}
          </Group>
        );
      },
    },
    {
      key: "by",
      label: "Led by",
      render: (d) => <Text size="sm">{d.conducted_by_name ?? "—"}</Text>,
    },
  ];
  return (
    <Stack>
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Rehearse the breach response plan at least once a year — the 6-hour CERT-In report and the
          72-hour Board report are not the time to learn it.
        </Text>
        {canRecord && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={modal.open}>
            Record a drill
          </Button>
        )}
      </Group>
      <DataTable
        columns={columns}
        data={drills.data ?? []}
        loading={drills.isLoading}
        error={drills.error}
        onRetry={() => drills.refetch()}
        rowKey={(d) => d.id}
        emptyTitle="No drill recorded yet"
        caption="Breach response drills"
        captionVisuallyHidden
      />
      <FormModal
        opened={opened}
        onClose={modal.close}
        title="Record a breach-response drill"
        onSubmit={form.handleSubmit((v) => record.mutate(v))}
        submitLabel="Record"
        submitting={record.isPending}
        error={record.error?.message ?? null}
      >
        <Controller
          control={form.control}
          name="held_on"
          render={({ field, fieldState }) => (
            <Input
              type="date"
              label="Held on"
              required
              {...field}
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          control={form.control}
          name="format"
          render={({ field }) => (
            <Select
              label="Format"
              data={[
                { value: "tabletop", label: "Tabletop exercise" },
                { value: "live", label: "Live drill" },
              ]}
              value={field.value}
              onChange={(v) => field.onChange(v ?? "tabletop")}
              allowDeselect={false}
            />
          )}
        />
        <Controller
          control={form.control}
          name="scenario"
          render={({ field, fieldState }) => (
            <TextArea
              label="Scenario rehearsed"
              required
              minRows={2}
              {...field}
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          control={form.control}
          name="findings"
          render={({ field, fieldState }) => (
            <TextArea
              label="Findings and actions"
              required
              minRows={3}
              {...field}
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          control={form.control}
          name="next_due_on"
          render={({ field }) => (
            <Input type="date" label="Next drill due (default: a year later)" {...field} />
          )}
        />
      </FormModal>
    </Stack>
  );
}
