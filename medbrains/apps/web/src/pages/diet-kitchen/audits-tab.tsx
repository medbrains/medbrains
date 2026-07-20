// IPD AuditsTab — split from diet-kitchen.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  Drawer,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { KitchenAuditFormInput } from "@medbrains/schemas";
import { kitchenAuditFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { CreateKitchenAuditRequest, KitchenAudit } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { DataTable } from "@/components";
import type { BadgeTone } from "@/components/ui";
import { Badge, Button } from "@/components/ui";
import {
  dietOptionalNumber,
  dietOptionalText,
  kitchenAuditTypeOptions,
} from "@/forms/diet-kitchen.form";
import { dietKitchenService } from "@/services/diet-kitchen.service";
import { notifyMutationError, rowsOrEmpty } from "./shared";

export function AuditsTab() {
  const qc = useQueryClient();
  const canViewAudits = useHasPermission(P.DIET.AUDITS_LIST);
  const canCreate = useHasPermission(P.DIET.AUDITS_CREATE);
  const [opened, { open, close }] = useDisclosure(false);

  const { data: auditsData, isLoading } = useQuery({
    queryKey: ["kitchen-audits"],
    queryFn: dietKitchenService.listKitchenAudits,
    enabled: canViewAudits,
  });
  const audits = canViewAudits ? rowsOrEmpty(auditsData) : [];

  const auditForm = useForm<KitchenAuditFormInput>({
    resolver: zodResolver(kitchenAuditFormSchema),
    defaultValues: {
      auditor_name: "",
      audit_type: "routine",
      hygiene_score: "",
      findings: "",
      corrective_actions: "",
    },
  });
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = auditForm;

  const createMut = useMutation({
    mutationFn: (data: CreateKitchenAuditRequest) => dietKitchenService.createKitchenAudit(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["kitchen-audits"] });
      notifications.show({ title: "Success", message: "Audit recorded", color: "success" });
      close();
      reset();
    },
    onError: notifyMutationError("Could not record audit"),
  });

  const submitAudit = (values: KitchenAuditFormInput) => {
    createMut.mutate({
      auditor_name: values.auditor_name.trim(),
      audit_type: values.audit_type,
      hygiene_score: dietOptionalNumber(values.hygiene_score),
      findings: dietOptionalText(values.findings),
      corrective_actions: dietOptionalText(values.corrective_actions),
    });
  };

  const columns = [
    {
      key: "audit_date",
      label: "Date",
      render: (r: KitchenAudit) => <Text size="sm">{r.audit_date}</Text>,
    },
    {
      key: "auditor_name",
      label: "Auditor",
      render: (r: KitchenAudit) => <Text size="sm">{r.auditor_name}</Text>,
    },
    {
      key: "audit_type",
      label: "Type",
      render: (r: KitchenAudit) => <Badge>{r.audit_type}</Badge>,
    },
    {
      key: "hygiene_score",
      label: "Hygiene Score",
      render: (r: KitchenAudit) => {
        const score = r.hygiene_score;
        const tone: BadgeTone =
          score == null ? "neutral" : score >= 80 ? "success" : score >= 60 ? "warning" : "danger";
        return <Badge tone={tone}>{score ?? "-"}/100</Badge>;
      },
    },
    {
      key: "is_compliant",
      label: "Compliant",
      render: (r: KitchenAudit) => (
        <Badge tone={r.is_compliant ? "success" : "danger"}>{r.is_compliant ? "Yes" : "No"}</Badge>
      ),
    },
    {
      key: "findings",
      label: "Findings",
      render: (r: KitchenAudit) => (
        <Text size="sm" truncate>
          {r.findings ?? "-"}
        </Text>
      ),
    },
    {
      key: "next_audit_date",
      label: "Next Audit",
      render: (r: KitchenAudit) => <Text size="sm">{r.next_audit_date ?? "-"}</Text>,
    },
  ];

  return (
    <>
      <Group justify="flex-end" mb="md">
        {canCreate && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={open}>
            New Audit
          </Button>
        )}
      </Group>
      {canViewAudits ? (
        <DataTable
          columns={columns}
          data={audits}
          loading={isLoading}
          rowKey={(r) => r.id}
          emptyTitle="No audits recorded"
        />
      ) : (
        <Card withBorder p="md">
          <Text size="sm" c="dimmed">
            Audit history is not available for your role. You can still record an audit when audit
            creation is allowed.
          </Text>
        </Card>
      )}
      <Drawer opened={opened} onClose={close} title="Record FSSAI Audit" position="right" size="xl">
        <Stack component="form" onSubmit={handleSubmit(submitAudit)}>
          <Controller
            name="auditor_name"
            control={control}
            render={({ field }) => (
              <TextInput
                label="Auditor Name"
                required
                {...field}
                error={errors.auditor_name?.message}
              />
            )}
          />
          <Controller
            name="audit_type"
            control={control}
            render={({ field }) => (
              <Select
                label="Audit Type"
                data={kitchenAuditTypeOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "routine")}
                error={errors.audit_type?.message}
              />
            )}
          />
          <Controller
            name="hygiene_score"
            control={control}
            render={({ field }) => (
              <NumberInput
                label="Hygiene Score (0-100)"
                min={0}
                max={100}
                value={field.value}
                onChange={field.onChange}
                error={errors.hygiene_score?.message}
              />
            )}
          />
          <Controller
            name="findings"
            control={control}
            render={({ field }) => (
              <Textarea label="Findings" {...field} error={errors.findings?.message} />
            )}
          />
          <Controller
            name="corrective_actions"
            control={control}
            render={({ field }) => (
              <Textarea
                label="Corrective Actions"
                {...field}
                error={errors.corrective_actions?.message}
              />
            )}
          />
          <Button tone="primary" loading={createMut.isPending} type="submit">
            Record Audit
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Main Page
// ══════════════════════════════════════════════════════════
