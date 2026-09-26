import { Stack, Tabs, Text } from "@mantine/core";
import type { SimulatedMessage } from "@medbrains/types";
import { IconBrandWhatsapp, IconMail, IconMessage } from "@tabler/icons-react";
import { useMemo } from "react";
import { Card } from "@/components/ui";
import { MessageBubble } from "./MessageBubble";
import classes from "./phone-view.module.scss";

interface PhoneViewProps {
  recipients: string[];
  messages: SimulatedMessage[];
}

const CHANNELS = [
  { value: "sms", label: "SMS", icon: IconMessage },
  { value: "whatsapp", label: "WhatsApp", icon: IconBrandWhatsapp },
  { value: "email", label: "Email", icon: IconMail },
] as const;

/** One person's phone: what they received, per channel, newest first. */
export function PhoneView({ recipients, messages }: PhoneViewProps) {
  const byChannel = useMemo(() => {
    const groups = new Map<string, SimulatedMessage[]>();
    for (const message of messages) {
      groups.set(message.channel, [...(groups.get(message.channel) ?? []), message]);
    }
    return groups;
  }, [messages]);

  return (
    <Card withBorder className={classes.phone} aria-label="Simulated phone">
      <Stack gap="xs">
        <Text size="sm" c="dimmed">
          {recipients.length > 0 ? recipients.join(" · ") : "No phone number or email on file"}
        </Text>
        <Tabs defaultValue="sms">
          <Tabs.List>
            {CHANNELS.map(({ value, label, icon: Icon }) => (
              <Tabs.Tab key={value} value={value} leftSection={<Icon size={16} />}>
                {label} ({byChannel.get(value)?.length ?? 0})
              </Tabs.Tab>
            ))}
          </Tabs.List>
          {CHANNELS.map(({ value, label }) => (
            <Tabs.Panel key={value} value={value} pt="sm">
              <Stack gap="sm" className={classes.thread}>
                {(byChannel.get(value) ?? []).map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
                {!byChannel.get(value)?.length && (
                  <Text size="sm" c="dimmed">
                    No {label} sent to this person yet.
                  </Text>
                )}
              </Stack>
            </Tabs.Panel>
          ))}
        </Tabs>
      </Stack>
    </Card>
  );
}
