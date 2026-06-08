import type { ComponentType, ReactNode } from "react";
import styles from "./operational-signal.module.scss";

export type OperationalSignalTone =
  | "active"
  | "blocked"
  | "complete"
  | "neutral"
  | "ready"
  | "risk";
export type OperationalSignalShape = "bed" | "diamond" | "pill" | "token";

interface OperationalSignalProps {
  icon?: ComponentType<{ className?: string; size?: number; stroke?: number }>;
  label: ReactNode;
  shape?: OperationalSignalShape;
  size?: "xs" | "sm";
  tone?: OperationalSignalTone;
  value?: ReactNode;
}

export function OperationalSignal({
  icon: Icon,
  label,
  shape = "pill",
  size = "sm",
  tone = "neutral",
  value,
}: OperationalSignalProps) {
  return (
    <span className={styles.signal} data-shape={shape} data-size={size} data-tone={tone}>
      <span className={styles.marker} aria-hidden="true">
        {Icon && <Icon className={styles.icon} size={size === "xs" ? 10 : 12} stroke={2.4} />}
      </span>
      {value && <span className={styles.value}>{value}</span>}
      <span className={styles.label}>{label}</span>
    </span>
  );
}
