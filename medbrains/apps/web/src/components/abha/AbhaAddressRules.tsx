import { List, Text } from "@mantine/core";
import { IconCircleCheck, IconCircleX } from "@tabler/icons-react";
import { addressChecklist } from "./abhaRules";

interface AbhaAddressRulesProps {
  /** The address as typed, without the `@` part. */
  name: string;
  /** `sbx` or `abdm`. */
  domain: string;
}

/**
 * NHA's ABHA address rules beside the field (CRT_ABHA_112): green when met,
 * red when not — and an icon and the words "met" / "not met", so colour is
 * never the only signal (WCAG 1.4.1).
 */
export function AbhaAddressRules({ name, domain }: AbhaAddressRulesProps) {
  return (
    <List spacing={4} size="sm" aria-label="ABHA address rules">
      {addressChecklist(name, domain).map((rule) => (
        <List.Item
          key={rule.label}
          icon={
            <Text component="span" c={rule.met ? "success" : "danger"} lh={0}>
              {rule.met ? (
                <IconCircleCheck size={16} aria-hidden />
              ) : (
                <IconCircleX size={16} aria-hidden />
              )}
            </Text>
          }
        >
          <Text size="sm" c={rule.met ? "success" : "danger"}>
            {rule.label} — {rule.met ? "met" : "not met"}
          </Text>
        </List.Item>
      ))}
    </List>
  );
}
