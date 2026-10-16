// Lab settings: how reports reach patients. Editing needs `lab.report_delivery.manage`
// (SMS/WhatsApp/email spend and channel choice are a hospital decision, not bench work);
// the server re-checks and refuses a default channel that is switched off.

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, SimpleGrid, Stack, Text } from "@mantine/core";
import type { LabReportDeliveryConfig } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, Card, Select, Switch, toast } from "@/components/ui";
import { labService } from "@/services/lab.service";
import { LAB_DISPATCH_METHOD_OPTIONS } from "./shared";

const CHANNEL_SWITCH = {
  sms: "sms_enabled",
  whatsapp: "whatsapp_enabled",
  email: "email_enabled",
} as const;

const schema = z
  .object({
    sms_enabled: z.boolean(),
    whatsapp_enabled: z.boolean(),
    email_enabled: z.boolean(),
    auto_dispatch: z.boolean(),
    default_method: z.string().min(1, "Choose a default"),
  })
  .refine(
    (v) => {
      const key = CHANNEL_SWITCH[v.default_method as keyof typeof CHANNEL_SWITCH];
      return key === undefined || v[key];
    },
    {
      path: ["default_method"],
      message: "That channel is switched off — turn it on or pick another",
    },
  );

const SWITCHES: { name: keyof LabReportDeliveryConfig; label: string }[] = [
  { name: "sms_enabled", label: "SMS" },
  { name: "whatsapp_enabled", label: "WhatsApp" },
  { name: "email_enabled", label: "Email" },
  { name: "auto_dispatch", label: "Send automatically when a report is verified" },
];

export function ReportDeliverySettings() {
  const qc = useQueryClient();
  const config = useQuery({
    queryKey: ["lab-report-delivery-config"],
    queryFn: () => labService.getLabReportDeliveryConfig(),
  });
  const form = useForm<LabReportDeliveryConfig>({
    resolver: zodResolver(schema),
    values: config.data,
  });
  const save = useMutation({
    mutationFn: (v: LabReportDeliveryConfig) => labService.updateLabReportDeliveryConfig(v),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["lab-report-delivery-config"] });
      toast.success("Report delivery settings saved", { title: "Saved" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Not saved" }),
  });

  if (config.isError) {
    return (
      <Alert tone="danger" title="Delivery settings could not be loaded">
        {config.error.message}
      </Alert>
    );
  }
  return (
    <Card withBorder padding="lg">
      <Text fw={600} mb="xs">
        Report delivery
      </Text>
      <Text size="sm" c="dimmed" mb="md">
        Which channels lab and imaging reports may be sent on, and the default for new dispatches.
        With automatic sending on, the patient is told the moment a report is verified — that it is
        ready, never what it says.
      </Text>
      <form onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate>
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            {SWITCHES.map(({ name, label }) => (
              <Controller
                key={name}
                control={form.control}
                name={name}
                render={({ field }) => (
                  <Switch
                    label={label}
                    checked={field.value === true}
                    onChange={(e) => field.onChange(e.currentTarget.checked)}
                    disabled={config.isLoading}
                  />
                )}
              />
            ))}
          </SimpleGrid>
          <Controller
            control={form.control}
            name="default_method"
            render={({ field, fieldState }) => (
              <Select
                label="Default delivery method"
                data={LAB_DISPATCH_METHOD_OPTIONS}
                value={field.value}
                onChange={(v) => field.onChange(v ?? "")}
                error={fieldState.error?.message}
                disabled={config.isLoading}
              />
            )}
          />
          <Group justify="flex-end">
            <Button
              type="submit"
              tone="primary"
              loading={save.isPending}
              disabled={config.isLoading}
            >
              Save delivery settings
            </Button>
          </Group>
        </Stack>
      </form>
    </Card>
  );
}
