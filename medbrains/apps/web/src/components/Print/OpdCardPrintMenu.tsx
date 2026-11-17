/**
 * "Print OPD card": one control, two papers (the half-A4 slip and the CR80
 * card). Printed for a visit it carries the token, department and doctor;
 * printed for a patient, identity only.
 *
 * Gated on the permission the endpoint enforces, like `PrintDocumentButton`,
 * so the desk is never offered a card the server would refuse.
 */
import { Menu } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { IconId, IconPrinter } from "@tabler/icons-react";
import { useState } from "react";
import { Button, IconButton, toast } from "@/components/ui";
import { OPD_CARD_FORMATS, type OpdCardFormat } from "@/lib/print/opd-card";
import { printDocumentDef } from "@/lib/print/print-registry";
import { printDocument } from "@/lib/print/printDocument";

export interface OpdCardPrintMenuProps {
  /** The OPD visit; when set, the card carries its token. */
  encounterId?: string | null;
  /** The patient, printed for when there is no visit. */
  patientId?: string | null;
  /** Icon-only, for a table row. */
  compact?: boolean;
}

/** The print OPD card control; renders nothing without a record or the permission. */
export function OpdCardPrintMenu({
  encounterId,
  patientId,
  compact = false,
}: OpdCardPrintMenuProps) {
  const documentKey = encounterId ? "opd-visit-card" : "opd-card";
  const recordId = encounterId ?? patientId;
  const def = printDocumentDef(documentKey);
  const allowed = useHasPermission(def?.permission ?? "");
  const [printing, setPrinting] = useState(false);
  if (!def || !allowed || !recordId) return null;

  const print = async (format: OpdCardFormat) => {
    setPrinting(true);
    const result = await printDocument(documentKey, recordId, { format });
    setPrinting(false);
    if (!result.ok) {
      toast.error(result.problem ?? "The OPD card could not be printed", {
        title: "Could not print the OPD card",
      });
    }
  };

  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        {compact ? (
          <IconButton size="sm" aria-label="Print OPD card" loading={printing}>
            <IconId size={16} />
          </IconButton>
        ) : (
          <Button
            size="compact-sm"
            tone="secondary"
            leftSection={<IconPrinter size={14} />}
            loading={printing}
          >
            Print OPD card
          </Button>
        )}
      </Menu.Target>
      <Menu.Dropdown>
        {OPD_CARD_FORMATS.map((format) => (
          <Menu.Item
            key={format.value}
            leftSection={<IconPrinter size={14} />}
            onClick={() => void print(format.value)}
          >
            {format.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
