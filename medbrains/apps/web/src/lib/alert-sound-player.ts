import { toast } from "@/components/ui";
import attentionUrl from "../../../../packages/alert-sounds/web/attention.mp3";
import calmUrl from "../../../../packages/alert-sounds/web/calm.mp3";
import urgentUrl from "../../../../packages/alert-sounds/web/urgent.mp3";
import { type AlertSoundPrefs, currentAlertSoundPrefs } from "./alert-sound-prefs";
import { type AlertSound, createSoundThrottle, effectiveVolume } from "./alert-sounds";

const SOUND_URLS: Record<AlertSound, string> = {
  calm: calmUrl,
  attention: attentionUrl,
  urgent: urgentUrl,
};

/** Longest a caller waits for a sound to end; the longest clip is 2 s. */
const MAX_WAIT_MS = 3000;

export type PlayOutcome = "played" | "muted" | "hidden" | "throttled" | "blocked";

export interface PlayOptions {
  /** A place's speaker (the token board) answers to its own mute, not a person's. */
  ignorePrefs?: boolean;
}

/** What the player needs from the browser; injected so tests can drive it. */
export interface AlertSoundDeps {
  makeAudio: (url: string) => HTMLAudioElement;
  now: () => number;
  isHidden: () => boolean;
  prefs: () => AlertSoundPrefs;
  /** Playback was refused (autoplay policy); `retry` must run inside a user gesture. */
  onBlocked: (sound: AlertSound, retry: () => void) => void;
}

function isMuted(sound: AlertSound, prefs: AlertSoundPrefs): boolean {
  if (sound === "calm") return prefs.muteCalm;
  if (sound === "attention") return prefs.muteAttention;
  return false; // urgent cannot be muted
}

/** Resolves when the clip ends, errors, or MAX_WAIT_MS passes — never hangs a caller. */
function untilEnded(audio: HTMLAudioElement): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      audio.removeEventListener("ended", done);
      audio.removeEventListener("error", done);
      resolve();
    };
    const timer = setTimeout(done, MAX_WAIT_MS);
    audio.addEventListener("ended", done);
    audio.addEventListener("error", done);
  });
}

export function createAlertSoundPlayer(deps: AlertSoundDeps) {
  // One element per sound, made on first use: three at most, reused forever.
  const elements = new Map<AlertSound, HTMLAudioElement>();
  const element = (sound: AlertSound) => {
    let audio = elements.get(sound);
    if (!audio) {
      audio = deps.makeAudio(SOUND_URLS[sound]);
      audio.preload = "auto";
      elements.set(sound, audio);
    }
    return audio;
  };
  const allow = createSoundThrottle();

  const start = async (sound: AlertSound, volume: number): Promise<PlayOutcome> => {
    const audio = element(sound);
    audio.muted = false; // a real alert outranks a priming play still in flight
    audio.volume = volume;
    audio.currentTime = 0;
    const ended = untilEnded(audio);
    try {
      await audio.play();
    } catch {
      return "blocked";
    }
    await ended;
    return "played";
  };

  const play = async (sound: AlertSound, options: PlayOptions = {}): Promise<PlayOutcome> => {
    const prefs = deps.prefs();
    if (!options.ignorePrefs && isMuted(sound, prefs)) return "muted";
    if (sound === "calm" && deps.isHidden()) return "hidden";
    if (!allow(sound, deps.now())) return "throttled";
    const volume = effectiveVolume(sound, sound === "urgent" ? prefs.urgentVolume : 1);
    const outcome = await start(sound, volume);
    if (outcome === "blocked") deps.onBlocked(sound, () => void start(sound, volume));
    return outcome;
  };

  /**
   * Browsers let a page play audio only after a gesture. Priming each element
   * silently inside that gesture keeps the next real alert from being refused.
   */
  const unlock = () => {
    for (const sound of Object.keys(SOUND_URLS) as AlertSound[]) {
      const audio = element(sound);
      if (!audio.paused) continue;
      audio.muted = true;
      // Older engines (and jsdom) return nothing from play(); wrap it.
      void Promise.resolve(audio.play())
        .then(() => {
          // Still muted means no real alert took this element over meanwhile.
          if (audio.muted) audio.pause();
        })
        .catch(() => undefined)
        .finally(() => {
          audio.muted = false;
        });
    }
  };

  return { play, unlock };
}

const PROMPT_ID = "alert-sounds-blocked";

/**
 * The "Turn on alert sounds" prompt. Shown once for calm or attention, but
 * every time an urgent sound is refused: a critical value that rang nowhere
 * must never pass silently. One toast id, so repeats replace rather than stack.
 */
export function createBlockedPrompt(show: typeof toast.warning) {
  let prompted = false;
  return (sound: AlertSound, retry: () => void) => {
    if (prompted && sound !== "urgent") return;
    prompted = true;
    const message =
      sound === "urgent"
        ? "An urgent alert could not play: this browser blocks sound until you allow it."
        : "This browser blocked an alert sound.";
    show(message, {
      id: PROMPT_ID,
      title: "Alert sounds are off",
      actions: [{ label: "Turn on alert sounds", primary: true, onClick: retry }],
    });
  };
}

const player = createAlertSoundPlayer({
  makeAudio: (url) => new Audio(url),
  now: () => Date.now(),
  isHidden: () => document.hidden,
  prefs: currentAlertSoundPrefs,
  onBlocked: createBlockedPrompt(toast.warning),
});

/** Play an alert sound for the signed-in person. Resolves when it has finished. */
export const playAlertSound = player.play;

// The first key or tap anywhere unlocks audio for the rest of the session.
if (typeof window !== "undefined") {
  const unlockOnce = () => {
    window.removeEventListener("pointerdown", unlockOnce);
    window.removeEventListener("keydown", unlockOnce);
    player.unlock();
  };
  window.addEventListener("pointerdown", unlockOnce);
  window.addEventListener("keydown", unlockOnce);
}
