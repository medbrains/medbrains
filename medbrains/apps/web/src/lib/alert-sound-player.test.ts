import { describe, expect, it, vi } from "vitest";
import {
  type AlertSoundDeps,
  createAlertSoundPlayer,
  createBlockedPrompt,
} from "./alert-sound-player";
import { DEFAULT_ALERT_SOUND_PREFS } from "./alert-sound-prefs";

/** An <audio> stand-in: `play` resolves (and later ends) or rejects like autoplay policy. */
function fakeAudio(blocked: () => boolean) {
  const target = new EventTarget();
  const audio = {
    paused: true,
    muted: false,
    volume: 1,
    currentTime: 0,
    preload: "",
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    pause: () => {
      audio.paused = true;
    },
    play: vi.fn(() => {
      if (blocked()) return Promise.reject(new DOMException("blocked", "NotAllowedError"));
      audio.paused = false;
      queueMicrotask(() => target.dispatchEvent(new Event("ended")));
      return Promise.resolve();
    }),
  };
  return audio;
}

function setup(overrides: Partial<AlertSoundDeps> = {}, blocked = false) {
  const audios: ReturnType<typeof fakeAudio>[] = [];
  let now = 0;
  const onBlocked = vi.fn();
  const player = createAlertSoundPlayer({
    makeAudio: () => {
      const audio = fakeAudio(() => blocked);
      audios.push(audio);
      return audio as unknown as HTMLAudioElement;
    },
    now: () => now,
    isHidden: () => false,
    prefs: () => DEFAULT_ALERT_SOUND_PREFS,
    onBlocked,
    ...overrides,
  });
  return { player, audios, onBlocked, tick: (ms: number) => (now += ms) };
}

describe("alert sound player", () => {
  it("resolves only after the sound has ended, so a board can speak afterwards", async () => {
    const { player, audios } = setup();
    expect(await player.play("calm")).toBe("played");
    expect(audios[0]?.play).toHaveBeenCalledTimes(1);
  });

  it("plays one sound per category in a burst", async () => {
    const { player, tick } = setup();
    expect(await player.play("attention")).toBe("played");
    tick(100);
    expect(await player.play("attention")).toBe("throttled");
  });

  it("honours the person's mute for calm and attention but never for urgent", async () => {
    const prefs = () => ({
      ...DEFAULT_ALERT_SOUND_PREFS,
      muteCalm: true,
      muteAttention: true,
      urgentVolume: 0,
    });
    const { player, audios } = setup({ prefs });
    expect(await player.play("calm")).toBe("muted");
    expect(await player.play("attention")).toBe("muted");
    expect(await player.play("urgent")).toBe("played");
    expect(audios[0]?.volume).toBeGreaterThan(0);
  });

  it("lets a place's speaker ignore a person's mute", async () => {
    const prefs = () => ({ ...DEFAULT_ALERT_SOUND_PREFS, muteCalm: true });
    const { player } = setup({ prefs });
    expect(await player.play("calm", { ignorePrefs: true })).toBe("played");
  });

  it("keeps calm quiet in a hidden tab but still sounds attention", async () => {
    const { player } = setup({ isHidden: () => true });
    expect(await player.play("calm")).toBe("hidden");
    expect(await player.play("attention")).toBe("played");
  });

  it("reports a refused play so the person can be asked to turn sounds on", async () => {
    const { player, onBlocked } = setup({}, true);
    expect(await player.play("urgent")).toBe("blocked");
    expect(onBlocked).toHaveBeenCalledWith("urgent", expect.any(Function));
  });
});

describe("blocked-sound prompt", () => {
  it("asks once for calm and attention", () => {
    const show = vi.fn();
    const prompt = createBlockedPrompt(show);
    prompt("attention", () => undefined);
    prompt("calm", () => undefined);
    expect(show).toHaveBeenCalledTimes(1);
  });

  it("asks every time urgent is refused, and its button retries the sound", () => {
    const show = vi.fn();
    const retry = vi.fn();
    const prompt = createBlockedPrompt(show);
    prompt("attention", () => undefined);
    prompt("urgent", retry);
    prompt("urgent", retry);
    expect(show).toHaveBeenCalledTimes(3);
    const options = show.mock.calls[2]?.[1];
    expect(options.actions[0].label).toBe("Turn on alert sounds");
    options.actions[0].onClick();
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
