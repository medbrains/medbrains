/**
 * The tombstone for mental-health content this user may not see (MHCA 2017
 * s.23). The server has already withheld the content — this only says an
 * entry exists and offers the emergency route into it. Never colour alone:
 * the lock icon and the words carry the meaning.
 */
import { Flex, Group, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { IconLock } from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "@/components/ui";
import { BreakGlassModal } from "./BreakGlassModal";

/** The module a break-glass session must name to open psychiatric content. */
export const PSYCHIATRY_MODULE = "psychiatry";

interface RestrictedEntryProps {
  patientId: string;
  /** Short, for dense rows. */
  compact?: boolean;
}

export function RestrictedEntry({ patientId, compact }: RestrictedEntryProps) {
  const canBreakGlass = useHasPermission(P.AUDIT.BREAK_GLASS_START);
  const [open, setOpen] = useState(false);
  return (
    <Flex gap="xs" direction={compact ? "column" : "row"} align={compact ? "flex-start" : "center"}>
      <Group gap="xs" wrap="nowrap">
        <IconLock size={16} aria-hidden />
        <Text size="sm" c="dimmed">
          {compact ? "Restricted entry" : "Restricted entry — visible to the treating team"}
        </Text>
      </Group>
      {canBreakGlass && (
        <>
          <Button tone="ghost" size="compact-xs" onClick={() => setOpen(true)}>
            Emergency access
          </Button>
          <BreakGlassModal
            patientId={patientId}
            opened={open}
            onClose={() => setOpen(false)}
            title="Emergency access to restricted entries"
            requestedModules={[PSYCHIATRY_MODULE]}
          />
        </>
      )}
    </Flex>
  );
}
