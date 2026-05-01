/**
 * ECG Loader — emerald cardiac monitor sweep, mirrors the web
 * EcgLoader. Uses RN's `Animated` value to translate a bright
 * "active trace" segment across a faint static trace path.
 *
 * Implementation note: RN doesn't ship SVG by default; we render
 * the trace as a flat row of spaced bars whose heights follow a
 * PQRST envelope. The active segment's bars get a bright fill and
 * subtle glow shadow. Hosts that already include `react-native-svg`
 * can swap in a richer drawing later — the contract is just that
 * this component fills its parent with a horizontal animation.
 */

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Animated, View } from "react-native";
import { COLORS } from "../tokens.js";

const ENVELOPE: ReadonlyArray<number> = [
  3, 3, 3, 4, 5, 4, 3, 3, 6, 18, 4, 3, 3, 4, 7, 9, 7, 4, 3, 3, 3, 3,
];
const BAR_WIDTH = 4;
const BAR_GAP = 2;
const TRACK_HEIGHT = 32;
const SCAN_WINDOW = 6;

export interface EcgLoaderProps {
  width?: number;
  loop?: boolean;
}

export function EcgLoader({ width = 240, loop = true }: EcgLoaderProps): ReactNode {
  const progress = useRef(new Animated.Value(0)).current;
  const totalBars = Math.max(ENVELOPE.length, Math.floor(width / (BAR_WIDTH + BAR_GAP)));

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 1800,
        useNativeDriver: true,
      }),
      { iterations: loop ? -1 : 1 },
    );
    animation.start();
    return () => animation.stop();
  }, [progress, loop]);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, totalBars * (BAR_WIDTH + BAR_GAP)],
  });

  return (
    <View
      style={{
        width,
        height: TRACK_HEIGHT,
        flexDirection: "row",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-end", height: TRACK_HEIGHT }}>
        {Array.from({ length: totalBars }, (_, i) => {
          const env = ENVELOPE[i % ENVELOPE.length] ?? 3;
          return (
            <View
              key={i}
              style={{
                width: BAR_WIDTH,
                height: env,
                backgroundColor: COLORS.emeraldDim,
                marginRight: BAR_GAP,
                borderRadius: 1,
              }}
            />
          );
        })}
      </View>
      <Animated.View
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: SCAN_WINDOW * (BAR_WIDTH + BAR_GAP),
          height: TRACK_HEIGHT,
          flexDirection: "row",
          alignItems: "flex-end",
          transform: [{ translateX }],
        }}
      >
        {Array.from({ length: SCAN_WINDOW }, (_, i) => {
          const env = ENVELOPE[i % ENVELOPE.length] ?? 3;
          return (
            <View
              key={i}
              style={{
                width: BAR_WIDTH,
                height: env,
                backgroundColor: COLORS.emerald,
                marginRight: BAR_GAP,
                borderRadius: 1,
                shadowColor: COLORS.emerald,
                shadowOpacity: 0.6,
                shadowRadius: 4,
              }}
            />
          );
        })}
      </Animated.View>
    </View>
  );
}
