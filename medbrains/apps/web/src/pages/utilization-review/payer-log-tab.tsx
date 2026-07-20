// Utilization-review PayerLogTab — split from utilization-review.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Drawer, Group, Select, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { UrCommunicationFormInput } from "@medbrains/schemas";
import { urCommunicationFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { UrPayerCommunication } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, Button } from "@/components/ui";
import type { CreateUrCommunicationInput } from "@/services/utilizationReview.service";
import { utilizationReviewService } from "@/services/utilizationReview.service";
import { optionalTrimmed, statusColorTone } from "./shared";

const EMPTY_COMMUNICATION_FORM: UrCommunicationFormInput = {
  review_id: "",
  communication_type: "initial_auth",
  payer_name: "",
  reference_number: "",
  summary: "",
};

function formToCommunicationPayload(form: UrCommunicationFormInput): CreateUrCommunicationInput {
  return {
    review_id: form.review_id.trim(),
    communication_type: form.communication_type,
    payer_name: form.payer_name.trim(),
    reference_number: optionalTrimmed(form.reference_number),
    summary: optionalTrimmed(form.summary),
  };
}

export function PayerLogTab() {
  const qc = useQueryClient();
  const canCreate = useHasPermission(P.UR.COMMUNICATIONS_CREATE);
  const [opened, { open, close }] = useDisclosure(false);
  const [filterReviewId, setFilterReviewId] = useState("");
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<UrCommunicationFormInput>({
    resolver: zodResolver(urCommunicationFormSchema),
    defaultValues: EMPTY_COMMUNICATION_FORM,
  });

  const { data = [], isLoading } = useQuery({
    queryKey: ["ur-communications", filterReviewId],
    queryFn: () =>
      utilizationReviewService.listCommunications({ review_id: filterReviewId || undefined }),
  });

  const createMut = useMutation({
    mutationFn: (d: CreateUrCommunicationInput) => utilizationReviewService.createCommunication(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ur-communications"] });
      notifications.show({
        title: "Communication Logged",
        message: "Payer communication recorded",
        color: "success",
      });
      reset(EMPTY_COMMUNICATION_FORM);
      close();
    },
    onError: () =>
      notifications.show({
        title: "Error",
        message: "Failed to create communication",
        color: "danger",
      }),
  });

  const columns: Column<UrPayerCommunication>[] = [
    {
      key: "review_id",
      label: "Review ID",
      render: (r) => <Text size="sm">{r.review_id.slice(0, 8)}...</Text>,
    },
    {
      key: "communication_type",
      label: "Type",
      render: (r) => (
        <Badge tone={statusColorTone(r.communication_type)}>
          {r.communication_type.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "payer_name",
      label: "Payer",
      render: (r) => <Text size="sm">{r.payer_name}</Text>,
    },
    {
      key: "reference_number",
      label: "Reference #",
      render: (r) => <Text size="sm">{r.reference_number ?? "—"}</Text>,
    },
    {
      key: "communicated_at",
      label: "Date",
      render: (r) => <Text size="sm">{new Date(r.communicated_at).toLocaleDateString()}</Text>,
    },
    {
      key: "summary",
      label: "Summary",
      render: (r) => (
        <Text size="sm" lineClamp={1}>
          {r.summary ?? "—"}
        </Text>
      ),
    },
  ];

  const openCreateCommunication = () => {
    reset(EMPTY_COMMUNICATION_FORM);
    open();
  };

  const submitCommunication = handleSubmit((values) => {
    createMut.mutate(formToCommunicationPayload(values));
  });

  return (
    <Stack gap="md">
      <PageHeader
        title="Payer Communication Log"
        subtitle="Track communications with insurance payers"
        actions={
          canCreate ? (
            <Button
              tone="primary"
              leftSection={<IconPlus size={16} />}
              onClick={openCreateCommunication}
            >
              Log Communication
            </Button>
          ) : undefined
        }
      />

      <Group>
        <TextInput
          placeholder="Filter by Review ID"
          value={filterReviewId}
          onChange={(e) => setFilterReviewId(e.currentTarget.value)}
          w={300}
        />
      </Group>

      <DataTable<UrPayerCommunication>
        data={data}
        loading={isLoading}
        rowKey={(r) => r.id}
        columns={columns}
      />

      <Drawer
        opened={opened}
        onClose={close}
        title="Log Payer Communication"
        position="right"
        size="xl"
      >
        <Stack component="form" gap="sm" onSubmit={submitCommunication}>
          <TextInput
            label="Review ID"
            required
            error={errors.review_id?.message}
            {...register("review_id")}
          />
          <Controller
            name="communication_type"
            control={control}
            render={({ field }) => (
              <Select
                label="Communication Type"
                required
                data={[
                  { value: "initial_auth", label: "Initial Authorization" },
                  { value: "continued_stay", label: "Continued Stay" },
                  { value: "denial_appeal", label: "Denial Appeal" },
                  { value: "peer_review", label: "Peer Review" },
                  { value: "info_request", label: "Information Request" },
                  { value: "response", label: "Response" },
                ]}
                value={field.value}
                onChange={field.onChange}
                error={errors.communication_type?.message}
              />
            )}
          />
          <TextInput
            label="Payer Name"
            required
            error={errors.payer_name?.message}
            {...register("payer_name")}
          />
          <TextInput
            label="Reference Number"
            error={errors.reference_number?.message}
            {...register("reference_number")}
          />
          <Textarea
            label="Summary"
            autosize
            minRows={3}
            error={errors.summary?.message}
            {...register("summary")}
          />
          <Button tone="primary" loading={createMut.isPending} type="submit">
            Log Communication
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ═══════════════════════════════════════════════════════
//  Tab 4 — Status Tracking
// ═══════════════════════════════════════════════════════
