import { create } from "zustand";

export type ActivityTone = "info" | "alert" | "code";

export interface ActivityAction {
  label: string;
  primary?: boolean;
  onClick: () => void;
}

/**
 * A live activity contributed to the island. ANY feature can push one — this is the
 * plugin seam: the island renders the highest-priority activity and knows nothing
 * about who produced it. Add a live activity = call setActivity from anywhere.
 */
export interface Activity {
  /** Unique per contributor (e.g. "whisper", "shift", "ot-timer"). */
  source: string;
  /** Higher wins when several are active. Suggested: code 100, alert 70, info 30. */
  priority: number;
  tone: ActivityTone;
  /** 'code_blue' etc. → escalates to the fixed safety colour. */
  kind?: string;
  title: string;
  message?: string;
  actions?: ActivityAction[];
  dismissible?: boolean;
}

/** Emergency codes get the loud, fixed safety colours. */
export const CODE_KINDS = new Set([
  "code_blue",
  "code_red",
  "code_pink",
  "code_black",
  "code_yellow",
  "code_orange",
]);

interface LiveActivityState {
  activities: Record<string, Activity>;
  /** Contribute (or clear, with null) an activity for a source. */
  setActivity: (source: string, activity: Omit<Activity, "source"> | null) => void;
}

export const useLiveActivityStore = create<LiveActivityState>((set) => ({
  activities: {},
  setActivity: (source, activity) =>
    set((state) => {
      const next = { ...state.activities };
      if (activity) {
        next[source] = { ...activity, source };
      } else {
        delete next[source];
      }
      return { activities: next };
    }),
}));
