/**
 * The patient's one Print menu: every paper the desk hands a patient, in one
 * place instead of a button per printer.
 *
 * - **ID card**: the card the hospital's "Card printer" setting names, the
 *   58 mm thermal card or the CR80 card, both with a QR of the UHID.
 * - **Registration slip (A4)**: offered where the screen passes a handler.
 * - **Token ticket**: only inside a visit; when the queue gave the visit no
 *   number it is shown disabled with the reason.
 *
 * Each item is gated on the permission its endpoint accepts, like
 * `PrintDocumentButton`: the cards on `patients.view` or the desk's
 * `patients.card.reprint`, the slip on `patients.view` alone. Never offered a
 * print the server would refuse; with nothing allowed the menu is not shown.
 */
import { Menu, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { IconFileText, IconId, IconPrinter, IconTicket } from "@tabler/icons-react";
import { useState } from "react";
import { Button, IconButton, toast } from "@/components/ui";
import { printDocument } from "@/lib/print/printDocument";
import { useIdCardPrint } from "./useIdCardPrint";

export interface PatientPrintMenuProps {
  /** The OPD visit; when set, the token ticket is offered. */
  encounterId?: string | null;
  /**
   * The visit's token: `null` when the queue issued none (the ticket is shown
   * disabled with the reason), left out when the screen does not know (the
   * ticket prints, and the print says so if there is no token).
   */
  token?: string | null;
  /** The patient; when set, the ID card is offered. */
  patientId?: string | null;
  /** Prints the A4 registration slip; when set, the slip is offered. */
  onRegistrationSlip?: () => void;
  /** Icon-only, for a table row. */
  compact?: boolean;
}

/** The menu; renders nothing without a record or a print this user may make. */
export function PatientPrintMenu({
  encounterId,
  token,
  patientId,
  onRegistrationSlip,
  compact = false,
}: PatientPrintMenuProps) {
  const card = useIdCardPrint();
  const canSlip = useHasPermission(P.PATIENTS.VIEW) && Boolean(onRegistrationSlip && patientId);
  const [printing, setPrinting] = useState(false);
  const showTicket = card.allowed && Boolean(encounterId);
  const showCard = card.allowed && Boolean(patientId);
  if (!showTicket && !showCard && !canSlip) return null;

  /** Runs one print with the trigger busy until it is done. */
  const run = async (job: () => Promise<void>) => {
    setPrinting(true);
    await job();
    setPrinting(false);
  };
  /** Prints the token ticket and says so when it could not. */
  const printTicket = async () => {
    const result = await printDocument("opd-visit-card", encounterId ?? "");
    if (!result.ok) {
      toast.error(result.problem ?? "Nothing was printed", { title: "Could not print" });
    }
  };

  const label = compact ? (encounterId ? "Print token or ID card" : "Print ID card") : "Print";
  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        {compact ? (
          <IconButton size="sm" aria-label={label} loading={printing}>
            <IconPrinter size={16} />
          </IconButton>
        ) : (
          <Button tone="secondary" leftSection={<IconPrinter size={14} />} loading={printing}>
            {label}
          </Button>
        )}
      </Menu.Target>
      <Menu.Dropdown>
        {showCard && (
          <Menu.Item
            leftSection={<IconId size={16} />}
            disabled={!card.ready}
            onClick={() => void run(() => card.print(patientId ?? ""))}
          >
            ID card
            {card.problem && (
              <Text size="xs" c="dimmed">
                {card.problem}
              </Text>
            )}
          </Menu.Item>
        )}
        {canSlip && (
          <Menu.Item leftSection={<IconFileText size={16} />} onClick={onRegistrationSlip}>
            Registration slip (A4)
          </Menu.Item>
        )}
        {showTicket && (
          <Menu.Item
            leftSection={<IconTicket size={16} />}
            disabled={token === null}
            onClick={() => void run(printTicket)}
          >
            Token ticket
            {token === null && (
              <Text size="xs" c="dimmed">
                No token was issued for this visit
              </Text>
            )}
          </Menu.Item>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}
