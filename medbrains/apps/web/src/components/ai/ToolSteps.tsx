import { Collapse, Stack } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { useId } from "react";
import { Button } from "@/components/ui";
import { ToolView } from "./ToolView";
import type { ChatToolCall } from "./transport/types";

export interface ToolStepsProps {
  /** Routine lookups only: blocked or unchecked calls are shown by the caller. */
  calls: ChatToolCall[];
}

/** The assistant's routine lookups, folded into one row the user can open. */
export function ToolSteps({ calls }: ToolStepsProps) {
  const [open, { toggle }] = useDisclosure(false);
  const id = useId();
  const running = calls.some((c) => c.status === "running" || c.status === "pending");
  const count = `${calls.length} ${calls.length === 1 ? "step" : "steps"}`;
  const Chevron = open ? IconChevronDown : IconChevronRight;
  return (
    <Stack gap={4}>
      <Button
        tone="tertiary"
        size="compact-xs"
        justify="flex-start"
        leftSection={<Chevron size={16} aria-hidden />}
        aria-expanded={open}
        aria-controls={id}
        onClick={toggle}
        w="fit-content"
      >
        {running ? `Looking things up · ${count}` : `Looked up ${count}`}
      </Button>
      <Collapse expanded={open} id={id}>
        <Stack gap={4}>
          {calls.map((call) => (
            <ToolView key={call.id} toolCall={call} />
          ))}
        </Stack>
      </Collapse>
    </Stack>
  );
}
