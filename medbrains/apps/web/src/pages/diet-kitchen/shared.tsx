// Diet Kitchen shared helpers — split from diet-kitchen.tsx (pure move).

import { notifications } from "@mantine/notifications";

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function mutationError(error: unknown) {
  return error instanceof Error ? error.message : "Request failed. Please try again.";
}

export function notifyFormError(message: string) {
  notifications.show({ title: "Check form", message, color: "warning" });
}

export function notifyMutationError(title: string) {
  return (error: unknown) => {
    notifications.show({ title, message: mutationError(error), color: "danger" });
  };
}

export function rowsOrEmpty<T>(rows: T[] | null | undefined): T[] {
  return Array.isArray(rows) ? rows.filter((row): row is T => Boolean(row)) : [];
}

export function optionalUuid(value: string | undefined, label: string) {
  if (!value) {
    return undefined;
  }

  if (!UUID_PATTERN.test(value)) {
    notifyFormError(`${label} must be a valid ID.`);
    return null;
  }

  return value;
}
