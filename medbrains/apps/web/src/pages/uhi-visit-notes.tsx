import { Text } from "@mantine/core";
import type { UhiRequest } from "@medbrains/types";
import { Badge } from "@/components/ui";
import { formatDateTime } from "@/lib/date-utils";

/** Wrong PINs the server allows before the desk must check a booking by hand. */
export const MAX_PIN_TRIES = 5;

interface UhiVisitNotesProps {
  request: UhiRequest;
}

/**
 * What the desk needs to know about a visit booked through UHI, under its
 * state: how long an unconfirmed slot is held (or that the hold has lapsed),
 * a doctor no-show the patient's app reported, and the PIN check.
 */
export function UhiVisitNotes({ request: r }: UhiVisitNotesProps) {
  const held = r.state === "initialised" && r.slot_held_until;
  const lapsed = held && new Date(r.slot_held_until ?? "").getTime() < Date.now();
  return (
    <>
      {held && (
        <Text size="xs" c="dimmed">
          {lapsed
            ? "Hold lapsed — the slot is free again"
            : `Held until ${formatDateTime(r.slot_held_until ?? "")} unless the app confirms`}
        </Text>
      )}
      {r.doctor_no_show_at && (
        <Badge tone="danger">{`Patient reports doctor no-show · ${formatDateTime(r.doctor_no_show_at)}`}</Badge>
      )}
      {r.pin_verified_at && (
        <Text size="xs" c="dimmed">
          {`PIN checked ${formatDateTime(r.pin_verified_at)}`}
        </Text>
      )}
      {r.has_pin && !r.pin_verified_at && r.pin_failed_attempts >= MAX_PIN_TRIES && (
        <Text size="xs">Too many wrong PINs — check the booking by hand</Text>
      )}
    </>
  );
}
