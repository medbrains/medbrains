import { Code, Group, Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import type { TokenCallSmsStatus } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Card, Switch, toast } from "@/components/ui";

const STATUS_KEY = ["tokens", "call-sms-status"];

/** What the DLT template line says, and in which tone. */
function TemplateState({ status }: { status: TokenCallSmsStatus }) {
  if (status.template) {
    const { template_id, template_name, language, expires_at } = status.template;
    return (
      <Group gap="xs">
        <Badge tone="success">DLT template registered</Badge>
        <Text size="sm">
          {template_name} ({template_id}, {language}
          {expires_at ? `, expires ${expires_at}` : ""})
        </Text>
      </Group>
    );
  }
  return (
    <Alert tone="warning" title="No approved DLT template for token calls">
      <Stack gap={4}>
        <Text size="sm">
          In India the SMS provider refuses texts without a registered DLT template. Register this
          wording with your DLT operator, then add it under Communications → DLT with the event
          scope <Code>{status.template_scope}</Code>:
        </Text>
        <Code block>{status.suggested_pattern}</Code>
      </Stack>
    </Alert>
  );
}

/** The token-call SMS switch, the template it sends under, and sends refused for want of one. */
export function TokenCallSmsCard() {
  const queryClient = useQueryClient();
  const status = useQuery({ queryKey: STATUS_KEY, queryFn: () => api.getTokenCallSmsStatus() });
  // The sender reads this as a bare JSON boolean, so it is stored as one.
  const update = useMutation({
    mutationFn: (enabled: boolean) =>
      api.updateTenantSetting({ category: "notifications", key: "token_call_sms", value: enabled }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: STATUS_KEY }),
    onError: (error: Error) => toast.error(error.message, { title: "Setting not saved" }),
  });

  return (
    <Card withBorder>
      <Stack gap="sm">
        <Group justify="space-between" align="center" wrap="nowrap">
          <Stack gap={2}>
            <Text fw={600}>Text the patient when their token is called</Text>
            <Text size="sm" c="dimmed">
              Sends the token number, the room to go to and the hospital name — nothing else. Every
              queue that calls a registered patient, only to a mobile number on file, and never to a
              patient who has withdrawn SMS. Needs the SMS provider set up.
            </Text>
          </Stack>
          <Switch
            checked={status.data?.enabled ?? false}
            disabled={!status.data || update.isPending}
            onChange={(event) => update.mutate(event.currentTarget.checked)}
            aria-label="Text the patient when their token is called"
          />
        </Group>
        {status.isError && (
          <Alert tone="danger">Could not check the token-call SMS. Reload to try again.</Alert>
        )}
        {status.data && <TemplateState status={status.data} />}
        {status.data && status.data.refused_last_7_days > 0 && (
          <Alert tone="danger" title={`${status.data.refused_last_7_days} texts refused this week`}>
            <Text size="sm">
              Last refused{" "}
              {status.data.last_refused_at
                ? new Date(status.data.last_refused_at).toLocaleString()
                : ""}
              : {status.data.last_refusal_reason}
            </Text>
          </Alert>
        )}
      </Stack>
    </Card>
  );
}
