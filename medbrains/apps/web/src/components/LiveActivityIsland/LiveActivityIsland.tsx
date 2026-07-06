import { IconAlertTriangle, IconX } from "@tabler/icons-react";
import { CrabMascot, useAiAssistantStore } from "@/components/ai";
import { Button, IconButton } from "@/components/ui";
import classes from "./LiveActivityIsland.module.scss";
import { useLiveActivityStore } from "./live-activity-store";

// Emergency codes get the loud, fixed safety colours (Carbon support tokens).
const CODE_KINDS = new Set([
  "code_blue",
  "code_red",
  "code_pink",
  "code_black",
  "code_yellow",
  "code_orange",
]);

/**
 * Live Activity Island — a floating, bottom-centre morphing element that surfaces
 * "what needs me right now". Idle: a compact pill that opens the AI assistant.
 * A critical whisper morphs it into a prominent alert; an emergency code escalates
 * it to the fixed code colour. Carbon-flat, token-driven, reduced-motion aware.
 */
export function LiveActivityIsland() {
  const whisper = useLiveActivityStore((s) => s.whisper);
  const dismiss = useLiveActivityStore((s) => s.dismiss);
  const openAssistant = useAiAssistantStore((s) => s.open);

  if (!whisper) {
    return (
      <div className={classes.island} data-state="idle">
        <button
          type="button"
          className={classes.idleBtn}
          onClick={() => openAssistant()}
          aria-label="Open MedBrains AI assistant"
        >
          <CrabMascot size={18} animate={false} />
          <span className={classes.idleLabel}>MedBrains</span>
          <span className={classes.pulseDot} aria-hidden="true" />
        </button>
      </div>
    );
  }

  const isCode = whisper.kind ? CODE_KINDS.has(whisper.kind) : false;

  return (
    <div
      className={classes.island}
      data-state={isCode ? "code" : "alert"}
      data-kind={whisper.kind ?? undefined}
      role="alert"
      aria-live="assertive"
    >
      <div className={classes.alertBody}>
        <IconAlertTriangle size={18} className={classes.alertIcon} aria-hidden="true" />
        <div className={classes.alertText}>
          <span className={classes.alertTitle}>{whisper.title}</span>
          <span className={classes.alertMessage}>{whisper.message}</span>
        </div>
      </div>
      <div className={classes.alertActions}>
        <Button
          tone="primary"
          size="xs"
          onClick={() =>
            openAssistant({
              query: `Explain this critical result and what to do next: ${whisper.message}`,
              context: whisper.patientId ? { patient_id: whisper.patientId } : undefined,
            })
          }
        >
          Ask AI
        </Button>
        <IconButton tone="default" aria-label="Dismiss alert" onClick={dismiss}>
          <IconX size={16} />
        </IconButton>
      </div>
    </div>
  );
}
