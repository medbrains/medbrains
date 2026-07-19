// IPD EnquiryDeskTab — split from front-office.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Drawer, Group, Select, Stack, Text, Textarea, TextInput, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { FrontOfficeEnquiryLog } from "@medbrains/types";
import { IconCheck, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { DataTable, TableValueBadge } from "@/components";
import { Button, IconButton } from "@/components/ui";
import type { FrontOfficeEnquiryFormInput } from "@/forms/front-office.form";
import {
  DEFAULT_ENQUIRY_FORM_VALUES,
  ENQUIRY_TYPE_OPTIONS,
  frontOfficeEnquiryFormSchema,
  toCreateEnquiryRequest,
} from "@/forms/front-office.form";
import { frontOfficeService } from "@/services/frontOffice.service";

export function EnquiryDeskTab({
  canCreate,
  canManage,
}: {
  canCreate: boolean;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const [drawer, drawerHandlers] = useDisclosure(false);

  const enquiryForm = useForm<FrontOfficeEnquiryFormInput>({
    resolver: zodResolver(frontOfficeEnquiryFormSchema),
    defaultValues: DEFAULT_ENQUIRY_FORM_VALUES,
  });

  const { data: enquiries, isLoading } = useQuery<FrontOfficeEnquiryLog[]>({
    queryKey: ["front-office", "enquiries"],
    queryFn: () => frontOfficeService.listEnquiries(),
  });

  const createEnquiry = useMutation({
    mutationFn: (data: FrontOfficeEnquiryFormInput) =>
      frontOfficeService.createEnquiry(toCreateEnquiryRequest(data)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["front-office", "enquiries"] });
      drawerHandlers.close();
      notifications.show({ message: "Enquiry logged", color: "success" });
      enquiryForm.reset(DEFAULT_ENQUIRY_FORM_VALUES);
    },
  });

  const resolveEnquiry = useMutation({
    mutationFn: (id: string) => frontOfficeService.resolveEnquiry(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["front-office", "enquiries"] });
      notifications.show({ message: "Enquiry resolved", color: "success" });
    },
  });

  const columns = [
    {
      key: "caller_name",
      label: "Caller",
      render: (r: FrontOfficeEnquiryLog) => r.caller_name ?? "—",
    },
    {
      key: "caller_phone",
      label: "Phone",
      render: (r: FrontOfficeEnquiryLog) => r.caller_phone ?? "—",
    },
    {
      key: "enquiry_type",
      label: "Type",
      render: (r: FrontOfficeEnquiryLog) => (
        <TableValueBadge value={r.enquiry_type} kind="source" />
      ),
    },
    {
      key: "response_text",
      label: "Response",
      render: (r: FrontOfficeEnquiryLog) => r.response_text ?? "—",
    },
    {
      key: "resolved",
      label: "Resolved",
      render: (r: FrontOfficeEnquiryLog) =>
        r.resolved ? (
          <TableValueBadge value="completed" label="Yes" color="success" variant="filled" />
        ) : (
          <TableValueBadge value="pending" label="No" color="orange" variant="filled" />
        ),
    },
    {
      key: "created_at",
      label: "Time",
      render: (r: FrontOfficeEnquiryLog) => new Date(r.created_at).toLocaleString(),
    },
    {
      key: "actions",
      label: "",
      render: (r: FrontOfficeEnquiryLog) =>
        !r.resolved && canManage ? (
          <Tooltip label="Mark Resolved">
            <IconButton
              tone="success"
              onClick={() => resolveEnquiry.mutate(r.id)}
              aria-label="Mark Resolved"
            >
              <IconCheck size={16} />
            </IconButton>
          </Tooltip>
        ) : null,
    },
  ];

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text fw={600}>Enquiry Log</Text>
        {canCreate && (
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={drawerHandlers.open}
          >
            Log Enquiry
          </Button>
        )}
      </Group>
      <DataTable
        columns={columns}
        data={enquiries ?? []}
        loading={isLoading}
        rowKey={(r: FrontOfficeEnquiryLog) => r.id}
      />

      <Drawer
        opened={drawer}
        onClose={drawerHandlers.close}
        title="Log Enquiry"
        position="right"
        size="xl"
      >
        <Stack
          component="form"
          gap="sm"
          onSubmit={enquiryForm.handleSubmit((values) => createEnquiry.mutate(values))}
        >
          <TextInput
            label="Caller Name"
            error={enquiryForm.formState.errors.caller_name?.message}
            {...enquiryForm.register("caller_name")}
          />
          <TextInput
            label="Caller Phone"
            error={enquiryForm.formState.errors.caller_phone?.message}
            {...enquiryForm.register("caller_phone")}
          />
          <Controller
            control={enquiryForm.control}
            name="enquiry_type"
            render={({ field, fieldState }) => (
              <Select
                label="Enquiry Type"
                data={ENQUIRY_TYPE_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
          <Textarea
            label="Response"
            error={enquiryForm.formState.errors.response_text?.message}
            rows={3}
            {...enquiryForm.register("response_text")}
          />
          <Button tone="primary" type="submit" loading={createEnquiry.isPending}>
            Log Enquiry
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 5 — Visitor Analytics
// ══════════════════════════════════════════════════════════
