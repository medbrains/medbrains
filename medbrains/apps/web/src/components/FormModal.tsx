import { Alert, Button, Drawer, Group, Modal, Stack } from "@mantine/core";
import type { FormEventHandler, ReactNode } from "react";
import { useTranslation } from "react-i18next";

interface FormModalProps {
  opened: boolean;
  /** Close handler — also wired to the Cancel button. Reset form state here. */
  onClose: () => void;
  title: ReactNode;
  size?: string | number;
  /** Drawer slides from the right; modal is centered. */
  variant?: "modal" | "drawer";
  /** Pass `handleSubmit(onValid)` from react-hook-form, or any submit handler. */
  onSubmit: FormEventHandler<HTMLFormElement>;
  submitLabel: ReactNode;
  submitting?: boolean;
  submitDisabled?: boolean;
  submitColor?: string;
  submitIcon?: ReactNode;
  /** Top-level submission error (field errors belong on the inputs). */
  error?: string | null;
  withCancel?: boolean;
  children: ReactNode;
}

/**
 * Shared scaffold for the modal+form+submit pattern (audit #214):
 * one place for the form element, error alert, and cancel/submit
 * footer so pages only declare their fields.
 */
export function FormModal({
  opened,
  onClose,
  title,
  size,
  variant = "modal",
  onSubmit,
  submitLabel,
  submitting,
  submitDisabled,
  submitColor,
  submitIcon,
  error,
  withCancel = true,
  children,
}: FormModalProps) {
  const { t } = useTranslation("common");

  const body = (
    <form onSubmit={onSubmit}>
      <Stack>
        {children}
        {error && (
          <Alert color="danger" variant="light">
            {error}
          </Alert>
        )}
        <Group justify="flex-end" gap="xs">
          {withCancel && (
            <Button variant="subtle" color="gray" onClick={onClose} disabled={submitting}>
              {t("cancel")}
            </Button>
          )}
          <Button
            type="submit"
            color={submitColor}
            leftSection={submitIcon}
            loading={submitting}
            disabled={submitDisabled}
          >
            {submitLabel}
          </Button>
        </Group>
      </Stack>
    </form>
  );

  if (variant === "drawer") {
    return (
      <Drawer opened={opened} onClose={onClose} title={title} position="right" size={size}>
        {body}
      </Drawer>
    );
  }
  return (
    <Modal opened={opened} onClose={onClose} title={title} size={size}>
      {body}
    </Modal>
  );
}
