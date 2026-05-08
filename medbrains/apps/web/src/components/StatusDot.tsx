import { Text } from "@mantine/core";
import styles from "./status-dot.module.scss";

interface StatusDotProps {
  color: string;
  label: string;
  size?: "sm" | "md";
}

export function StatusDot({ color, label, size = "md" }: StatusDotProps) {
  return (
    <span className={`${styles.wrapper} ${styles[size]}`}>
      <span className={styles.dot} style={{ backgroundColor: `var(--mantine-color-${color}-5)` }} />
      <Text component="span" className={styles.label} c="var(--mb-text-primary)">
        {label}
      </Text>
    </span>
  );
}
