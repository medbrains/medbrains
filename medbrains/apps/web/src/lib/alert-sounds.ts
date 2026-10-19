/**
 * Which alert sound a notification makes (issue #4862). The rules live in
 * `packages/alert-sounds/alert-sounds.json`, shared with the iOS and Android
 * apps; this file only reads them.
 */
import rules from "../../../../packages/alert-sounds/alert-sounds.json";

export type AlertSound = "calm" | "attention" | "urgent";
export type AlertSoundChoice = AlertSound | "none";

/** Who is listening: patient-facing surfaces never hear attention or urgent. */
export type AlertAudience = "staff" | "patient";

/** The parts of a notification the mapping reads. */
export interface SoundableEvent {
  kind: string;
  entity_type?: string | null;
  scope?: string | null;
}

export const ALERT_SOUNDS: readonly AlertSound[] = rules.sounds as AlertSound[];
export const ALERT_THROTTLE_MS: number = rules.throttle_ms;
/** Urgent can be turned down, never off. */
export const URGENT_VOLUME_FLOOR: number = rules.urgent_volume_floor;

const silentScopes = new Set(rules.silent_scopes);
const urgentKinds = new Set(rules.urgent_kinds);
const calmKinds = new Set(rules.calm_kinds);
const urgentEntities = new Set(rules.urgent_entity_types);
const attentionEntities = new Set(rules.attention_entity_types);

/** First matching rule wins; the order is documented in the JSON. */
export function alertSoundFor(event: SoundableEvent, audience: AlertAudience): AlertSoundChoice {
  if (event.scope && silentScopes.has(event.scope)) return "none";
  if (audience === "patient") return rules.patient_sound as AlertSound;
  if (urgentKinds.has(event.kind)) return "urgent";
  const entity = event.entity_type ?? "";
  if (urgentEntities.has(entity) && !calmKinds.has(event.kind)) return "urgent";
  if (attentionEntities.has(entity)) return "attention";
  if (calmKinds.has(event.kind)) return "calm";
  return rules.default_sound as AlertSound;
}

/**
 * A burst of notifications plays one sound per category per window: ten
 * results landing together ring once, not ten times. Bounded by the three
 * categories, so it never grows.
 */
export function createSoundThrottle(windowMs = ALERT_THROTTLE_MS) {
  const lastPlayed = new Map<AlertSound, number>();
  return (sound: AlertSound, now: number): boolean => {
    const last = lastPlayed.get(sound);
    if (last !== undefined && now - last < windowMs) return false;
    lastPlayed.set(sound, now);
    return true;
  };
}

/** The volume a sound plays at: urgent is clamped to its floor, others to 0–1. */
export function effectiveVolume(sound: AlertSound, volume: number): number {
  const clamped = Math.min(1, Math.max(0, volume));
  return sound === "urgent" ? Math.max(URGENT_VOLUME_FLOOR, clamped) : clamped;
}
