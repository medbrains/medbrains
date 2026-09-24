/**
 * The whole phone becomes the alarm.
 *
 * A code called on the floor must not live behind a menu tile. While any
 * emergency code is open, this overlay sits above every screen in the app,
 * blinking in that code's fixed colour with the code's name across it —
 * the six colours are patient-safety constants, identical on every device,
 * because staff respond to them from muscle memory.
 *
 * Rules that shape it:
 *
 * - **One blink a second.** WCAG 2.2 SC 2.3.1 forbids more than three flashes
 *   a second; a hospital full of phones strobing at 4 Hz is a seizure risk.
 * - **Reduced motion gets a solid banner**, not a blink. Same colour, same
 *   words, no animation (`docs/CARBON-MOTION-RULES.md`).
 * - **The word is always beside the colour** (SC 1.4.1). Code black on a
 *   black screen is still labelled "CODE BLACK".
 * - **Triple-tap silences.** It is deliberately *not* "I'm responding": a
 *   nurse on another ward quieting her phone must not become the code
 *   blue's first-on-scene and corrupt the NABH arrival time. Responding is
 *   its own button, and it says what it commits to.
 * - Silence is per device and per code. It is not sent anywhere: an
 *   acknowledgement the server never sees is not a fact about the response,
 *   only about this phone. What would make it durable is marking the paging
 *   notification read, which needs a notifications feed this app does not
 *   have yet.
 * - The poll and the animation are both torn down on unmount
 *   (`docs/DEVICE-CONSTRAINED-RULES.md`).
 */

import { useAuthStore } from "@medbrains/mobile-shell";
import { SPACING } from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import { Button, Text } from "react-native-paper";
import { listActiveCodeBlues, listOpenEmergencyCodes, respondToCodeBlue } from "../api/nursing.js";
import { useHasPermission } from "../lib/permissions.js";
import { useFetch } from "../lib/use-fetch.js";
import { type OpenCode, openCodes, registerTap } from "./emergency-flash-logic.js";

const POLL_MS = 10_000;
/** 1 Hz: half a second on, half a second off. */
const BLINK_HALF_MS = 500;
const TAP_TARGET = 44;

export function EmergencyFlash(): ReactNode {
  const canSeeCodeBlue = useHasPermission("nurse.code_blue.view");
  const canSeeCodes = useHasPermission("emergency.codes.list");
  const canRespond = useHasPermission("nurse.code_blue.respond");
  const signedIn = useAuthStore((s) => s.identity !== null);

  // Each feed is gated on its own permission: a phone without one still
  // gets the other. A failed poll leaves the last-good list in place rather
  // than clearing the alarm — an outage must not read as "all clear".
  const codeBlues = useFetch(
    () => (signedIn && canSeeCodeBlue ? listActiveCodeBlues() : Promise.resolve([])),
    [signedIn, canSeeCodeBlue],
    { intervalMs: signedIn ? POLL_MS : undefined },
  );
  const erCodes = useFetch(
    () => (signedIn && canSeeCodes ? listOpenEmergencyCodes() : Promise.resolve([])),
    [signedIn, canSeeCodes],
    { intervalMs: signedIn ? POLL_MS : undefined },
  );

  const [silenced, setSilenced] = useState<ReadonlySet<string>>(() => new Set());

  const open = useMemo(
    () => openCodes(codeBlues.data ?? [], erCodes.data ?? [], silenced),
    [codeBlues.data, erCodes.data, silenced],
  );
  const current = open[0];
  if (!current) return null;

  return (
    <FlashBanner
      code={current}
      others={open.length - 1}
      canRespond={canRespond}
      onSilence={() => setSilenced((prev) => new Set(prev).add(current.key))}
    />
  );
}

function FlashBanner({
  code,
  others,
  canRespond,
  onSilence,
}: {
  code: OpenCode;
  others: number;
  canRespond: boolean;
  onSilence: () => void;
}): ReactNode {
  const opacity = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(false);
  const [responded, setResponded] = useState(false);
  const [busy, setBusy] = useState(false);
  const taps = useRef<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => {
        if (!cancelled) setReduceMotion(on);
      })
      .catch(() => {
        // Unknown preference: blink, the default the rest of the world uses.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.15,
          duration: BLINK_HALF_MS,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: BLINK_HALF_MS,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, reduceMotion]);

  const onTap = useCallback(() => {
    const next = registerTap(taps.current, Date.now());
    taps.current = next.taps;
    if (next.triple) onSilence();
  }, [onSilence]);

  const respond = useCallback(async () => {
    if (!code.codeBlueId) return;
    setBusy(true);
    try {
      await respondToCodeBlue(code.codeBlueId);
      setResponded(true);
    } finally {
      setBusy(false);
    }
  }, [code.codeBlueId]);

  return (
    <View
      pointerEvents="box-none"
      style={StyleSheet.absoluteFill}
      testID="emergency-flash"
      accessibilityLiveRegion="assertive"
    >
      <Pressable
        onPress={onTap}
        accessibilityRole="alert"
        accessibilityLabel={`${code.label} at ${code.location}. Triple-tap to silence this alarm on this phone.`}
        accessibilityHint="Silencing does not say you are responding."
        style={{ flex: 1 }}
      >
        <Animated.View
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: code.colour,
            opacity,
          }}
        />
        <View style={{ flex: 1, justifyContent: "center", padding: SPACING.lg, gap: SPACING.md }}>
          <Text
            variant="displayMedium"
            style={{ color: code.ink, fontWeight: "900", textAlign: "center", letterSpacing: 2 }}
          >
            {code.label}
          </Text>
          <Text variant="headlineSmall" style={{ color: code.ink, textAlign: "center" }}>
            {code.location}
          </Text>
          {others > 0 && (
            <Text style={{ color: code.ink, textAlign: "center" }}>
              +{others} more code{others === 1 ? "" : "s"} open
            </Text>
          )}
          <Text style={{ color: code.ink, textAlign: "center", opacity: 0.9 }}>
            Triple-tap to silence on this phone
          </Text>

          {code.codeBlueId && canRespond && (
            <Button
              accessibilityLabel={
                responded ? "You are responding to this code blue" : "Respond to this code blue"
              }
              testID="emergency-flash-respond"
              disabled={busy || responded}
              mode="contained"
              buttonColor="#FFFFFF"
              textColor={code.colour}
              onPress={respond}
              style={{ minHeight: TAP_TARGET, justifyContent: "center", alignSelf: "center" }}
            >
              {responded ? "You are responding" : "I'm responding"}
            </Button>
          )}
        </View>
      </Pressable>
    </View>
  );
}
