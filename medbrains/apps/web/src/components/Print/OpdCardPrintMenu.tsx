/**
 * The OPD print control: two prints with two purposes.
 *
 * - **Token ticket**: a bus ticket off the 80 mm roll with only the visit's
 *   token, large, and when it was issued. Offered only for a visit; when the
 *   queue gave the visit no number it is shown disabled with the reason.
 * - **Patient ID card**: the permanent CR80 card, identity and a QR of the
 *   UHID. Offered wherever the patient is.
 *
 * Gated on the permissions the endpoints accept, like `PrintDocumentButton`:
 * `patients.view` with a relationship, or the desk's `patients.card.reprint`,
 * which reaches any patient. Never offered a print the server would refuse.
 */
import { Menu, Text } from "@mantine/core";
import { useHasAnyPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { IconId, IconPrinter, IconTicket } from "@tabler/icons-react";
import { useState } from "react";
import { Button, IconButton, toast } from "@/components/ui";
import { printDocumentDef } from "@/lib/print/print-registry";
import { printDocument } from "@/lib/print/printDocument";

export interface OpdCardPrintMenuProps {
  /** The OPD visit; when set, the token ticket is offered. */
  encounterId?: string | null;
  /** The visit's token; without one the ticket is shown disabled. */
  token?: string | null;
  /** The patient; when set, the ID card is offered. */
  patientId?: string | null;
  /** Icon-only, for a table row. */
  compact?: boolean;
}

/** The print control; renders nothing without a record or the permission. */
export function OpdCardPrintMenu({
  encounterId,
  token,
  patientId,
  compact = false,
}: OpdCardPrintMenuProps) {
  const permission = printDocumentDef("opd-card")?.permission;
  const allowed = useHasAnyPermission(permission ? [permission, P.PATIENTS.CARD.REPRINT] : []);
  const [printing, setPrinting] = useState(false);
  if (!allowed || (!encounterId && !patientId)) return null;

  /** Prints one document and says so when it could not. */
  const print = async (documentKey: string, recordId: string) => {
    setPrinting(true);
    const result = await printDocument(documentKey, recordId);
    setPrinting(false);
    if (!result.ok) {
      toast.error(result.problem ?? "Nothing was printed", { title: "Could not print" });
    }
  };

  const label = encounterId ? "Print token or ID card" : "Print ID card";
  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        {compact ? (
          <IconButton size="sm" aria-label={label} loading={printing}>
            <IconPrinter size={16} />
          </IconButton>
        ) : (
          <Button
            size="compact-sm"
            tone="secondary"
            leftSection={<IconPrinter size={14} />}
            loading={printing}
          >
            {label}
          </Button>
        )}
      </Menu.Target>
      <Menu.Dropdown>
        {encounterId && (
          <Menu.Item
            leftSection={<IconTicket size={16} />}
            disabled={!token}
            onClick={() => void print("opd-visit-card", encounterId)}
          >
            Token ticket
            {!token && (
              <Text size="xs" c="dimmed">
                No token was issued for this visit
              </Text>
            )}
          </Menu.Item>
        )}
        {patientId && (
          <Menu.Item
            leftSection={<IconId size={16} />}
            onClick={() => void print("opd-card", patientId)}
          >
            Patient ID card
          </Menu.Item>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}
