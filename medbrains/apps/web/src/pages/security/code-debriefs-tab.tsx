// Security CodeDebriefsTab — split from security.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Drawer, Group, NumberInput, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { SecurityCodeDebriefFormInput } from "@medbrains/schemas";
import { securityCodeDebriefFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { SecurityCodeDebrief } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, Button } from "@/components/ui";
import {
  defaultSecurityCodeDebriefFormValues,
  securityCodeDebriefFormToRequest,
} from "@/forms/security.form";
import { securityService } from "@/services/security.service";

export function CodeDebriefsTab() {
  const canCreate = useHasPermission(P.SECURITY.DEBRIEFS_CREATE);
  const qc = useQueryClient();

  const { data: debriefs = [], isLoading } = useQuery({
    queryKey: ["sec-debriefs"],
    queryFn: () => securityService.listSecurityCodeDebriefs(),
  });
  const [opened, { open, close }] = useDisclosure(false);
  const debriefForm = useForm<SecurityCodeDebriefFormInput>({
    resolver: zodResolver(securityCodeDebriefFormSchema),
    defaultValues: defaultSecurityCodeDebriefFormValues,
  });
  const handleOpen = () => {
    debriefForm.reset(defaultSecurityCodeDebriefFormValues);
    open();
  };
  const createMut = useMutation({
    mutationFn: (values: SecurityCodeDebriefFormInput) =>
      securityService.createSecurityCodeDebrief(securityCodeDebriefFormToRequest(values)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["sec-debriefs"] });
      debriefForm.reset(defaultSecurityCodeDebriefFormValues);
      close();
      notifications.show({
        title: "Debrief Created",
        message: "Code debrief recorded",
        color: "success",
      });
    },
  });

  const columns: Column<SecurityCodeDebrief>[] = [
    {
      key: "code_activation_id",
      label: "Code Activation",
      render: (r) => <Text size="sm">{r.code_activation_id.slice(0, 8)}...</Text>,
    },
    { key: "debrief_date", label: "Date", render: (r) => <Text>{r.debrief_date}</Text> },
    {
      key: "response_time_seconds",
      label: "Response (sec)",
      render: (r) => <Text>{r.response_time_seconds ?? "—"}</Text>,
    },
    {
      key: "total_duration_minutes",
      label: "Duration (min)",
      render: (r) => <Text>{r.total_duration_minutes ?? "—"}</Text>,
    },
    {
      key: "action_items",
      label: "Actions",
      render: (r) => (
        <Badge tone="neutral">
          {Array.isArray(r.action_items) ? `${r.action_items.length} items` : "—"}
        </Badge>
      ),
    },
    {
      key: "created_at",
      label: "Created",
      render: (r) => <Text size="sm">{new Date(r.created_at).toLocaleString()}</Text>,
    },
  ];

  return (
    <Stack>
      {canCreate && (
        <Group>
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={handleOpen}>
            New Debrief
          </Button>
        </Group>
      )}
      <DataTable columns={columns} data={debriefs} loading={isLoading} rowKey={(r) => r.id} />

      <Drawer
        opened={opened}
        onClose={close}
        title="Create Code Debrief"
        position="right"
        size="lg"
      >
        <Stack
          component="form"
          onSubmit={debriefForm.handleSubmit((values) => createMut.mutate(values))}
        >
          <TextInput
            label="Code Activation ID"
            required
            {...debriefForm.register("code_activation_id")}
            error={debriefForm.formState.errors.code_activation_id?.message}
          />
          <Controller
            control={debriefForm.control}
            name="response_time_seconds"
            render={({ field, fieldState }) => (
              <NumberInput
                label="Response Time (seconds)"
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
                min={0}
              />
            )}
          />
          <Controller
            control={debriefForm.control}
            name="total_duration_minutes"
            render={({ field, fieldState }) => (
              <NumberInput
                label="Total Duration (minutes)"
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
                min={0}
              />
            )}
          />
          <Textarea
            label="What Went Well"
            minRows={2}
            {...debriefForm.register("what_went_well")}
            error={debriefForm.formState.errors.what_went_well?.message}
          />
          <Textarea
            label="What Went Wrong"
            minRows={2}
            {...debriefForm.register("what_went_wrong")}
            error={debriefForm.formState.errors.what_went_wrong?.message}
          />
          <Textarea
            label="Root Cause"
            minRows={2}
            {...debriefForm.register("root_cause")}
            error={debriefForm.formState.errors.root_cause?.message}
          />
          <Textarea
            label="Lessons Learned"
            minRows={2}
            {...debriefForm.register("lessons_learned")}
            error={debriefForm.formState.errors.lessons_learned?.message}
          />
          <Textarea
            label="Equipment Issues"
            {...debriefForm.register("equipment_issues")}
            error={debriefForm.formState.errors.equipment_issues?.message}
          />
          <Textarea
            label="Training Gaps"
            {...debriefForm.register("training_gaps")}
            error={debriefForm.formState.errors.training_gaps?.message}
          />
          <Textarea
            label="Protocol Changes Recommended"
            {...debriefForm.register("protocol_changes_recommended")}
            error={debriefForm.formState.errors.protocol_changes_recommended?.message}
          />
          <Button tone="primary" type="submit" loading={createMut.isPending}>
            Create Debrief
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Main Page
// ══════════════════════════════════════════════════════════
