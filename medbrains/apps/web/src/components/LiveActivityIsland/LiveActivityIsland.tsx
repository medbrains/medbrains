import { IconAlertTriangle, IconX } from "@tabler/icons-react";
import { Button, IconButton } from "@/components/ui";
import classes from "./LiveActivityIsland.module.scss";
import { useLiveActivityStore } from "./live-activity-store";

/**
 * Live Activity Island — a floating, bottom-centre morphing element for "what needs
 * me right now". It's a **plugin surface**: it renders the highest-priority activity
 * from the store and knows nothing about who produced it (whispers, shift, an OT
 * timer, an emergency code…). With nothing live it is not shown.
 * Carbon-flat, token-driven, reduced-motion aware, aria-live for alerts.
 */
export function LiveActivityIsland() {
  const activities = useLiveActivityStore((s) => s.activities);
  const setActivity = useLiveActivityStore((s) => s.setActivity);

  const active = Object.values(activities).sort((a, b) => b.priority - a.priority)[0];

  // Nothing live, nothing shown: the assistant has its own button, and an
  // idle pill only covered the page.
  if (!active) return null;

  return (
    <div
      className={classes.island}
      data-state={active.tone === "code" ? "code" : "alert"}
      data-kind={active.kind ?? undefined}
      role="alert"
      aria-live="assertive"
    >
      <div className={classes.alertBody}>
        <IconAlertTriangle size={18} className={classes.alertIcon} aria-hidden="true" />
        <div className={classes.alertText}>
          <span className={classes.alertTitle}>{active.title}</span>
          {active.message && <span className={classes.alertMessage}>{active.message}</span>}
        </div>
      </div>
      <div className={classes.alertActions}>
        {active.actions?.map((action) => (
          <Button
            key={action.label}
            tone={action.primary ? "primary" : "secondary"}
            size="xs"
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        ))}
        {active.dismissible && (
          <IconButton
            tone="default"
            aria-label="Dismiss"
            onClick={() => setActivity(active.source, null)}
          >
            <IconX size={16} />
          </IconButton>
        )}
      </div>
    </div>
  );
}
