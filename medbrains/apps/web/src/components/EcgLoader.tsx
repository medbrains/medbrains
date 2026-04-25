import { forwardRef } from "react";
import type { MantineLoaderComponent } from "@mantine/core";
import styles from "./EcgLoader.module.scss";

/**
 * ECG Loader — Forest + Copper design system.
 *
 * One forest stroke travels the P-QRS-T trace; one copper beacon rides
 * the QRS peak. No gradient, no mask sweep, no drop-shadow glow.
 *
 * Size variants: sm (56×20), md (96×28), lg (160×40)
 * On buttons: stroke flips to white, beacon omitted.
 * On dark: stroke shifts to --primary-2 (#c4d5cc), copper beacon stays.
 */
export const EcgLoader: MantineLoaderComponent = forwardRef(
  ({ style, ...others }, ref) => {
    return (
      <svg
        ref={ref}
        className={styles.ecgLoader}
        viewBox="0 0 120 24"
        preserveAspectRatio="none"
        fill="none"
        style={{
          width: "var(--loader-size, 96px)",
          height: "calc(var(--loader-size, 96px) * 0.29)",
          ...style,
        }}
        {...others}
      >
        {/* Baseline rule */}
        <line
          className={styles.baseline}
          x1="0" y1="12" x2="120" y2="12"
        />
        {/* PQRST trace — single stroke, dash-travel animation */}
        <polyline
          className={styles.trace}
          points="0,12 20,12 36,12 42,10 48,6 54,10 58,12 62,14 64,19 66,3 68,21 70,8 72,12 80,12 88,10 94,8 100,10 104,12 118,12"
        />
        {/* Copper beacon at QRS peak */}
        <circle
          className={styles.beacon}
          cx="67" cy="12" r="2.5"
        />
      </svg>
    );
  },
);

EcgLoader.displayName = "EcgLoader";
