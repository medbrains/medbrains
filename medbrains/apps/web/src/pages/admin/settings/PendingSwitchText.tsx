import { Stack, Text } from "@mantine/core";
import type { ModuleConfig } from "@medbrains/types";
import { names } from "./module-bricks";

/**
 * A switch waiting on the operator's one confirm: turning `mod` on with the bricks it needs
 * (`others`), or off after the server refused, with its `refusal` naming every brick that is on
 * and needs it.
 */
export interface PendingSwitch {
  mod: ModuleConfig;
  others: ModuleConfig[];
  on: boolean;
  refusal?: string;
}

/** The one question a blocked switch asks, naming the other bricks it would switch. */
export function PendingSwitchText({ mod, others, on, refusal }: PendingSwitch) {
  const several = others.length > 1;
  if (on) {
    return (
      <Text size="sm">
        {mod.name} needs {names(others)}, which {several ? "are" : "is"} off. Switch{" "}
        {several ? "them" : "it"} on too?
      </Text>
    );
  }
  return (
    <Stack gap="xs">
      <Text size="sm">{refusal}</Text>
      <Text size="sm">
        An app marked "on, never set up" has been answering although nobody switched it on. Switch
        all of them off with {mod.name}? Their screens and API are switched off; records are kept.
      </Text>
    </Stack>
  );
}
