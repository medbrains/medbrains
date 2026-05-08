import { notifications } from "@mantine/notifications";
import { IconAlertTriangle, IconCheck, IconInfoCircle, IconX } from "@tabler/icons-react";
import { createElement } from "react";

export function showSuccess(title: string, message?: string) {
  notifications.show({
    title,
    message,
    color: "green",
    icon: createElement(IconCheck, { size: 18 }),
  });
}

export function showError(title: string, message?: string) {
  notifications.show({
    title,
    message,
    color: "red",
    icon: createElement(IconX, { size: 18 }),
  });
}

export function showWarning(title: string, message?: string) {
  notifications.show({
    title,
    message,
    color: "yellow",
    icon: createElement(IconAlertTriangle, { size: 18 }),
  });
}

export function showInfo(title: string, message?: string) {
  notifications.show({
    title,
    message,
    color: "blue",
    icon: createElement(IconInfoCircle, { size: 18 }),
  });
}
