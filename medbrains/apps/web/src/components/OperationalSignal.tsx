import { type WorkflowSignalShape, workflowSignalShapeDefinition } from "@medbrains/types";
import type { ComponentType, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import styles from "./operational-signal.module.scss";

export type OperationalSignalTone =
  | "active"
  | "blocked"
  | "complete"
  | "neutral"
  | "ready"
  | "risk";
export type OperationalSignalShape = WorkflowSignalShape;

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
  const { t } = useTranslation("clinical");
  const shapeDefinition = workflowSignalShapeDefinition(shape);
  const shapeTitle = `${t(shapeDefinition.labelKey)}: ${t(shapeDefinition.descriptionKey)}`;

  return (
    <span
      className={styles.signal}
      data-shape={shape}
      data-shape-meaning={shapeDefinition.semantic}
      data-size={size}
      data-tone={tone}
      title={shapeTitle}
    >
      <span className={styles.marker} aria-hidden="true">
        {Icon && <Icon className={styles.icon} size={size === "xs" ? 10 : 12} stroke={2.4} />}
      </span>
      {value && <span className={styles.value}>{value}</span>}
      <span className={styles.label}>{label}</span>
    </span>
  );
}
