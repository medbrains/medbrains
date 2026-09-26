import { Group, Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, Switch, toast } from "@/components/ui";

const MODULES: { value: string; label: string }[] = [
  { value: "registration", label: "Registration" },
  { value: "opd", label: "OPD" },
  { value: "pharmacy", label: "Pharmacy" },
  { value: "billing", label: "Billing" },
  { value: "lab", label: "Laboratory" },
  { value: "radiology", label: "Radiology" },
  { value: "dispatch", label: "Dispatch" },
];

/** Per-module token enable/disable — drives the issuance gate ("some days off"). */
export function TokensSettings() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["tenant-settings", "tokens"],
    queryFn: () => api.getTenantSettings("tokens"),
  });

  const update = useMutation({
    mutationFn: (input: { module: string; enabled: boolean }) =>
      api.updateTenantSetting({
        category: "tokens",
        key: `${input.module}_enabled`,
        value: { enabled: input.enabled },
      }),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["tenant-settings", "tokens"] }),
    onError: (error: Error) => toast.error(error.message, { title: "Setting not saved" }),
  });

  // The pipeline reads this as a bare JSON boolean, so it is stored as one.
  const { data: notifications } = useQuery({
    queryKey: ["tenant-settings", "notifications"],
    queryFn: () => api.getTenantSettings("notifications"),
  });
  const isCallSmsOn =
    notifications?.find((entry) => entry.key === "token_call_sms")?.value === true;
  const updateCallSms = useMutation({
    mutationFn: (enabled: boolean) =>
      api.updateTenantSetting({ category: "notifications", key: "token_call_sms", value: enabled }),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["tenant-settings", "notifications"] }),
    onError: (error: Error) => toast.error(error.message, { title: "Setting not saved" }),
  });

  const isEnabled = (module: string): boolean => {
    const row = data?.find((entry) => entry.key === `${module}_enabled`);
    return (row?.value as { enabled?: boolean } | undefined)?.enabled !== false;
  };

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        Enable or disable token issuance per module. When a module is off, no new tokens are issued
        (existing tokens still work) — so on days you don't need a queue, switch it off.
      </Text>
      {MODULES.map((module) => (
        <Card key={module.value} withBorder>
          <Group justify="space-between" align="center">
            <Text fw={600}>{module.label}</Text>
            <Switch
              checked={isEnabled(module.value)}
              onChange={(event) =>
                update.mutate({ module: module.value, enabled: event.currentTarget.checked })
              }
              aria-label={`${module.label} tokens enabled`}
            />
          </Group>
        </Card>
      ))}
      <Card withBorder>
        <Group justify="space-between" align="center" wrap="nowrap">
          <Stack gap={2}>
            <Text fw={600}>Text the patient when their token is called</Text>
            <Text size="sm" c="dimmed">
              Sends an SMS with the token number and the room to go to. Only OPD visit tokens, and
              only to patients with a mobile number on file. Needs the SMS provider set up.
            </Text>
          </Stack>
          <Switch
            checked={isCallSmsOn}
            disabled={updateCallSms.isPending}
            onChange={(event) => updateCallSms.mutate(event.currentTarget.checked)}
            aria-label="Text the patient when their token is called"
          />
        </Group>
      </Card>
    </Stack>
  );
}
