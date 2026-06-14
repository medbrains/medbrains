import type { MantineLoaderComponent } from "@mantine/core";
import { forwardRef } from "react";
import styles from "./EcgLoader.module.scss";

/**
 * ECG Loader — Signature Spectrum design system.
 *
 * One indigo stroke travels the P-QRS-T trace; one coral beacon
 * pulses at the R-wave apex. No gradient, no mask sweep, no glow.
 *
 * Geometry note: the polyline is normalised so the apex of the
 * R-wave sits exactly at x=64 (the beacon's cx). The dash length in the
 * SCSS (260) is the measured path length + slack, so the travel reads as
 * one continuous sweep with no stutter at the loop seam.
 *
 * Size: drive with `--loader-size` (width). Height = width * 0.20.
 *   sm 56px · md 96px (default) · lg 160px
 * On a Mantine Button: stroke flips to white, beacon + baseline hidden.
 * On dark scheme: stroke shifts to --primary-2; coral beacon stays.
 */
export const EcgLoader: MantineLoaderComponent = forwardRef(({ style, ...others }, ref) => {
  return (
    <svg
      ref={ref}
      className={styles.ecgLoader}
      viewBox="0 0 120 24"
      preserveAspectRatio="none"
      fill="none"
      role="status"
      aria-label="Loading"
      style={{
        width: "var(--loader-size, 96px)",
        height: "calc(var(--loader-size, 96px) * 0.20)",
        ...style,
      }}
      {...others}
    >
      <line className={styles.baseline} x1="0" y1="12" x2="120" y2="12" />
      <polyline
        className={styles.trace}
        points="0,12 22,12 34,12 39,10.5 44,7 49,10.5 53,12 58,13 61,16 64,2 67,20 70,9 74,12 84,12 90,10 95,7.5 100,10 105,12 120,12"
      />
      <circle className={styles.beacon} cx="64" cy="12" r="2.4" />
    </svg>
  );
});

EcgLoader.displayName = "EcgLoader";
