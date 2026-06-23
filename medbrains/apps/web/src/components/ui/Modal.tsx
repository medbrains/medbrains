import { Modal as MantineModal, type ModalProps as MantineModalProps } from "@mantine/core";
import type { ReactNode } from "react";
import { Button } from "./Button";
import styles from "./modal.module.scss";

/** A Carbon modal footer action. */
export interface ModalAction {
  label: string;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export interface ModalProps extends MantineModalProps {
  /**
   * Primary (right) action. When set, the seam renders Carbon's full-bleed
   * footer button bar instead of expecting a hand-built footer in `children`.
   */
  primaryAction?: ModalAction;
  /** Secondary (left) action — typically "Cancel". Pairs 50/50 with primary. */
  secondaryAction?: ModalAction;
  /** Danger variant — the primary action becomes a danger button. */
  danger?: boolean;
  children?: ReactNode;
}

/**
 * Standard modal — Carbon-aligned dialog. Centered, soft dimmed/blurred
 * overlay, theme radius. For short, self-contained tasks (a workflow done
 * *alongside* content belongs in a Drawer). Pass `opened`, `onClose`, `title`,
 * `size`. Provide `primaryAction` (+ optional `secondaryAction`, `danger`) for
 * Carbon's transactional/danger footer, or render your own footer in children.
 *
 * Accessibility (Carbon + WCAG 2.1 AA): `title` is the dialog's accessible name
 * (Mantine wires `aria-labelledby`); the close "X" gets a default `aria-label`;
 * focus is trapped and returns to the trigger; Esc closes. Always pass `title`.
 */
export function Modal({
  centered = true,
  radius = "md",
  overlayProps,
  closeButtonProps,
  primaryAction,
  secondaryAction,
  danger = false,
  children,
  ...rest
}: ModalProps) {
  return (
    <MantineModal
      centered={centered}
      radius={radius}
      overlayProps={{ backgroundOpacity: 0.55, blur: 3, ...overlayProps }}
      closeButtonProps={{ "aria-label": "Close", ...closeButtonProps }}
      {...rest}
    >
      {children}
      {primaryAction && (
        // Carbon transactional footer: full-bleed 50/50 bar, secondary left,
        // primary (or danger) right.
        <div className={styles.footer}>
          {secondaryAction && (
            <Button
              tone="secondary"
              className={styles.footerButton}
              onClick={secondaryAction.onClick}
              disabled={secondaryAction.disabled}
            >
              {secondaryAction.label}
            </Button>
          )}
          <Button
            tone={danger ? "danger" : "primary"}
            className={styles.footerButton}
            onClick={primaryAction.onClick}
            loading={primaryAction.loading}
            disabled={primaryAction.disabled}
          >
            {primaryAction.label}
          </Button>
        </div>
      )}
    </MantineModal>
  );
}
