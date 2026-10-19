import { useAuthStore } from "@medbrains/stores";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** One person's alert-sound choices. Urgent has a volume, never a mute. */
export interface AlertSoundPrefs {
  muteCalm: boolean;
  muteAttention: boolean;
  /** 0–1; played no quieter than URGENT_VOLUME_FLOOR. */
  urgentVolume: number;
}

export const DEFAULT_ALERT_SOUND_PREFS: AlertSoundPrefs = {
  muteCalm: false,
  muteAttention: false,
  urgentVolume: 1,
};

interface AlertSoundPrefsState {
  /** By user id, so a shared nursing-station browser keeps each person's choice. */
  byUser: Record<string, AlertSoundPrefs>;
  setPrefs: (userId: string, patch: Partial<AlertSoundPrefs>) => void;
}

/**
 * Kept in this browser, like the theme: a sound is a property of the device
 * that rings. ponytail: one entry per person who signs in here; move to a
 * server-side preference if people want it to follow them across devices.
 */
export const useAlertSoundPrefsStore = create<AlertSoundPrefsState>()(
  persist(
    (set) => ({
      byUser: {},
      setPrefs: (userId, patch) =>
        set((state) => ({
          byUser: {
            ...state.byUser,
            [userId]: { ...DEFAULT_ALERT_SOUND_PREFS, ...state.byUser[userId], ...patch },
          },
        })),
    }),
    { name: "mb.alert-sounds", storage: createJSONStorage(() => localStorage) },
  ),
);

/** The signed-in person's choices, or the defaults (everything on). */
export function currentAlertSoundPrefs(): AlertSoundPrefs {
  const userId = useAuthStore.getState().user?.id;
  const saved = userId ? useAlertSoundPrefsStore.getState().byUser[userId] : undefined;
  return { ...DEFAULT_ALERT_SOUND_PREFS, ...saved };
}
