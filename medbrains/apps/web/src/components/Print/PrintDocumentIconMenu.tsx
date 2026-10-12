/**
 * The row-sized form of `PrintDocumentMenu`: one printer icon that lists every
 * document this reader may print for the record.
 *
 * Most records live in a table row or a drawer, where a button per document
 * does not fit. Same registry, same permission filter, same failure toast.
 */
import { Menu } from "@mantine/core";
import { usePermissionStore } from "@medbrains/stores";
import { IconPrinter } from "@tabler/icons-react";
import { IconButton, toast } from "@/components/ui";
import { ALL_PRINT_DOCUMENTS, type PrintDocumentIdKind } from "@/lib/print/print-registry";
import { printDocument } from "@/lib/print/printDocument";

export interface PrintDocumentIconMenuProps {
  idKind: PrintDocumentIdKind;
  recordId: string | null | undefined;
  /** Names the record for screen readers, e.g. the invoice number. */
  recordLabel?: string;
  /** Registry keys to leave out — ones the screen already prints its own way. */
  exclude?: readonly string[];
}

export function PrintDocumentIconMenu({
  idKind,
  recordId,
  recordLabel,
  exclude = [],
}: PrintDocumentIconMenuProps) {
  const hasPermission = usePermissionStore((state) => state.hasPermission);
  const documents = ALL_PRINT_DOCUMENTS.filter(
    (doc) => doc.idKind === idKind && !exclude.includes(doc.key) && hasPermission(doc.permission),
  );
  if (documents.length === 0 || !recordId) return null;

  const print = async (key: string, label: string) => {
    const result = await printDocument(key, recordId);
    if (!result.ok) {
      toast.error(result.problem ?? "The document could not be printed", {
        title: `Could not print ${label}`,
      });
    }
  };

  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <IconButton size="sm" aria-label={recordLabel ? `Print ${recordLabel}` : "Print"}>
          <IconPrinter size={16} />
        </IconButton>
      </Menu.Target>
      <Menu.Dropdown>
        {documents.map((doc) => (
          <Menu.Item
            key={doc.key}
            leftSection={<IconPrinter size={14} />}
            onClick={() => void print(doc.key, doc.label)}
          >
            {doc.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
