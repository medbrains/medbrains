import { Group, Text } from "@mantine/core";
import type { ReactNode } from "react";
import styles from "./signature-hero.module.scss";

export interface SignatureHeroProps {
  /** Eyebrow label (uppercase, mono) — e.g. the module name. */
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Leading icon, rendered inside a frosted tile. */
  icon?: ReactNode;
  /** Right-aligned actions (rendered on the gradient). */
  actions?: ReactNode;
  /** Compact height for embedding above a workflow. */
  compact?: boolean;
}

/**
 * Signature Spectrum hero — the high-energy gradient header for flagship
 * clinical surfaces (prescription writer, pharmacy workspace). Indigo →
 * blue-violet → rose → coral, with a soft sheen and frosted icon tile.
 * Calm but distinctive; reserved for hero moments, not dense chrome.
 */
export function SignatureHero({
  eyebrow,
  title,
  subtitle,
  icon,
  actions,
  compact,
}: SignatureHeroProps) {
  return (
    <div className={styles.hero} data-compact={compact || undefined}>
      <div className={styles.sheen} aria-hidden="true" />
      <Group justify="space-between" align="center" wrap="nowrap" className={styles.inner}>
        <Group gap="sm" wrap="nowrap" align="center">
          {icon && <span className={styles.iconTile}>{icon}</span>}
          <div>
            {eyebrow && <div className={styles.eyebrow}>{eyebrow}</div>}
            <Text className={styles.title}>{title}</Text>
            {subtitle && <Text className={styles.subtitle}>{subtitle}</Text>}
          </div>
        </Group>
        {actions && (
          <Group gap="xs" wrap="nowrap">
            {actions}
          </Group>
        )}
      </Group>
    </div>
  );
}
