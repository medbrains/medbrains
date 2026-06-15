import { Modal as MantineModal, type ModalProps } from "@mantine/core";

/**
 * Standard modal — centered, soft dimmed/blurred overlay, theme radius.
 * For short, self-contained tasks (a workflow done *alongside* content
 * belongs in a Drawer). Pass `opened`, `onClose`, `title`, `size`.
 */
export function Modal({ centered = true, radius = "md", overlayProps, ...rest }: ModalProps) {
  return (
    <MantineModal
      centered={centered}
      radius={radius}
      overlayProps={{ backgroundOpacity: 0.55, blur: 3, ...overlayProps }}
      {...rest}
    />
  );
}
