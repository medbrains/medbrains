import { Tooltip } from "@mantine/core";
import { AiOrb, Button, IconButton } from "@/components/ui";
import type { ChatContext } from "./transport/types";
import { useAiAssistant } from "./useAiAssistant";

export interface AskAiButtonProps {
  /** Question the assistant is seeded with when clicked. */
  prompt: string;
  /** Clinical/page context to hand the assistant (patient, encounter, result…). */
  context?: ChatContext;
  label?: string;
  /** Compact crab-icon-only trigger (e.g. next to a value in a table row). */
  iconOnly?: boolean;
  size?: string;
}

/**
 * The interfacing primitive for any surface: drop it beside data to open the
 * global crab assistant pre-loaded with a contextual question.
 *
 *   <AskAiButton prompt="Explain this lab result" context={{ patient_id, result_id }} />
 */
export function AskAiButton({
  prompt,
  context,
  label = "Ask AI",
  iconOnly = false,
  size = "xs",
}: AskAiButtonProps) {
  const assistant = useAiAssistant();
  const handleClick = () => assistant.ask(prompt, context);

  if (iconOnly) {
    return (
      <Tooltip label={label} withArrow>
        <IconButton tone="default" size="sm" aria-label={label} onClick={handleClick}>
          <AiOrb variant="halo" size={18} />
        </IconButton>
      </Tooltip>
    );
  }

  return (
    <Button
      tone="secondary"
      size={size}
      leftSection={<AiOrb variant="halo" size={16} />}
      onClick={handleClick}
    >
      {label}
    </Button>
  );
}
