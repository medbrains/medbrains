import { forwardRef } from "react";
import type { MantineLoaderComponent } from "@mantine/core";
import styles from "./EcgLoader.module.scss";

/**
 * Custom Mantine Loader: single PQRST heartbeat with scan-line reveal.
 * Emerald trace (#34d399) matching the TopProgressBar cardiac monitor.
 * Trinity: 2 beats visible — one completing, one beginning.
 */
export const EcgLoader: MantineLoaderComponent = forwardRef(
  ({ style, ...others }, ref) => {
    return (
      <svg
        ref={ref}
        className={styles.ecgLoader}
        viewBox="0 0 120 24"
        fill="none"
        style={{
          width: "var(--loader-size)",
          height: "calc(var(--loader-size) * 0.4)",
          ...style,
        }}
        {...others}
      >
        <defs>
          <mask id="ecgSweepMask">
            <rect
              className={styles.sweepRect}
              x="0"
              y="0"
              width="0"
              height="24"
              fill="white"
            />
          </mask>
        </defs>
        {/* Dim baseline */}
        <line
          x1="0" y1="12" x2="120" y2="12"
          stroke="#34d399"
          strokeWidth="1"
          opacity="0.12"
        />
        {/* Ghost trace — always visible, very faint */}
        <polyline
          className={styles.ghostTrace}
          stroke="#34d399"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points="
            0,12 8,12
            12,12 14,11 16,10 17,10 18,10 19,11 20,12
            22,12 25,12
            26,12.5 27,13 27.5,10 28,2 28.5,3
            29,19 29.5,21 30,17 30.5,14 31,12
            33,12 38,12
            40,12 42,11 44,10 45,9.5 46,10 48,11 50,12
            55,12 68,12
            72,12 74,11 76,10 77,10 78,10 79,11 80,12
            82,12 85,12
            86,12.5 87,13 87.5,10 88,2 88.5,3
            89,19 89.5,21 90,17 90.5,14 91,12
            93,12 98,12
            100,12 102,11 104,10 105,9.5 106,10 108,11 110,12
            115,12 120,12
          "
        />
        {/* Active bright trace — revealed by sweep mask */}
        <polyline
          className={styles.activeTrace}
          stroke="#34d399"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          mask="url(#ecgSweepMask)"
          points="
            0,12 8,12
            12,12 14,11 16,10 17,10 18,10 19,11 20,12
            22,12 25,12
            26,12.5 27,13 27.5,10 28,2 28.5,3
            29,19 29.5,21 30,17 30.5,14 31,12
            33,12 38,12
            40,12 42,11 44,10 45,9.5 46,10 48,11 50,12
            55,12 68,12
            72,12 74,11 76,10 77,10 78,10 79,11 80,12
            82,12 85,12
            86,12.5 87,13 87.5,10 88,2 88.5,3
            89,19 89.5,21 90,17 90.5,14 91,12
            93,12 98,12
            100,12 102,11 104,10 105,9.5 106,10 108,11 110,12
            115,12 120,12
          "
        />
      </svg>
    );
  },
);

EcgLoader.displayName = "EcgLoader";
