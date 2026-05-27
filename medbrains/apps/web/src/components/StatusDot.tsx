import { Text } from "@mantine/core";
import type { ComponentType } from "react";
import styles from "./status-dot.module.scss";
import { tableValueIcon } from "./TableValueBadge";

interface StatusDotProps {
  color: string;
  label: string;
  size?: "sm" | "md";
  icon?: ComponentType<{ className?: string; size?: number; stroke?: number }>;
}

export function StatusDot({ color, label, size = "md", icon: Icon }: StatusDotProps) {
  const statusColor = `var(--mb-indicator-${color}, var(--mb-${color}-accent, var(--mb-indicator-neutral)))`;
  const iconSize = size === "sm" ? 12 : 14;
  const InferredIcon = Icon ?? tableValueIcon(label);

  return (
    <span className={`${styles.wrapper} ${styles[size]}`} style={{ color: statusColor }}>
      {!InferredIcon && (
        <span
          className={styles.dot}
          style={{
            backgroundColor: "currentColor",
            boxShadow: "0 0 0 3px color-mix(in srgb, currentColor, transparent 72%)",
          }}
        />
      )}
      {InferredIcon && <InferredIcon className={styles.icon} size={iconSize} stroke={2.4} />}
      <Text component="span" className={styles.label}>
        {label}
      </Text>
    </span>
  );
}
