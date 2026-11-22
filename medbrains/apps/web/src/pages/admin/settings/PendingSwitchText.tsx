import { Text } from "@mantine/core";
import type { ModuleConfig } from "@medbrains/types";
import { names } from "./module-bricks";

/**
 * A switch waiting on the operator's one confirm: turning `mod` on with the bricks it needs
 * (`on`), or off with the switched-on bricks that need it.
 */
export interface PendingSwitch {
  mod: ModuleConfig;
  others: ModuleConfig[];
  on: boolean;
}

/** The one question a blocked switch asks, naming the other bricks it would switch. */
export function PendingSwitchText({ mod, others, on }: PendingSwitch) {
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
    <Text size="sm">
      {names(others)} {several ? "are on and need" : "is on and needs"} {mod.name}. Switch{" "}
      {several ? "them" : "it"} off too? Their screens and API are switched off; records are kept.
    </Text>
  );
}
