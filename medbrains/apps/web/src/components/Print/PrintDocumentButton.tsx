/**
 * The button form of `printDocument`.
 *
 * Gated on the same permission the endpoint enforces, so we never offer a
 * control the server will refuse — the audit found tabs gated on `.list`
 * holding buttons that needed `.create`, which promises what the server denies.
 *
 * Failure is spoken, not swallowed. A print button that does nothing when the
 * document cannot be loaded teaches people to press it twice and give up.
 */
import { useHasPermission } from "@medbrains/stores";
import { IconPrinter } from "@tabler/icons-react";
import { useState } from "react";
import { Button, toast } from "@/components/ui";
import { printDocumentDef } from "@/lib/print/print-registry";
import { printDocument } from "@/lib/print/printDocument";

export interface PrintDocumentButtonProps {
  /** Registry key, e.g. "consent.general". */
  documentKey: string;
  /** The admission, booking, patient or consent this document is for. */
  recordId: string | null | undefined;
  /** Overrides the registry's label. */
  label?: string;
  size?: "xs" | "sm" | "compact-sm" | "compact-xs";
  tone?: "primary" | "secondary";
}

export function PrintDocumentButton({
  documentKey,
  recordId,
  label,
  size = "compact-sm",
  tone = "secondary",
}: PrintDocumentButtonProps) {
  const def = printDocumentDef(documentKey);
  // Hooks before any early return.
  const allowed = useHasPermission(def?.permission ?? "");
  const [printing, setPrinting] = useState(false);

  // An unregistered key is a programming error, not something to render.
  if (!def || !allowed) return null;

  return (
    <Button
      size={size}
      tone={tone}
      leftSection={<IconPrinter size={14} />}
      loading={printing}
      disabled={!recordId}
      onClick={async () => {
        setPrinting(true);
        const result = await printDocument(documentKey, recordId ?? "");
        setPrinting(false);
        if (!result.ok) {
          toast.error(result.problem ?? "The document could not be printed", {
            title: `Could not print ${def.label}`,
          });
        }
      }}
    >
      {label ?? def.label}
    </Button>
  );
}
