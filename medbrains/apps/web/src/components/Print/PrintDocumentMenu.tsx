/**
 * Every document printable for one record, in one place.
 *
 * Mounted once per record kind rather than a button per document: the registry
 * knows which documents key on an order, a patient, an admission, so the screen
 * only has to say which kind of record it is holding.
 *
 * `hasPermission` is read from the store as a predicate rather than through
 * `useHasPermission` per row — hooks cannot be called inside a map, and a
 * lab order can offer half a dozen documents.
 */
import { Group, Text } from "@mantine/core";
import { usePermissionStore } from "@medbrains/stores";
import { ALL_PRINT_DOCUMENTS, type PrintDocumentIdKind } from "@/lib/print/print-registry";
import { PrintDocumentButton } from "./PrintDocumentButton";

export function PrintDocumentMenu({
  idKind,
  recordId,
  /** Registry keys to leave out — usually ones the screen already prints its own way. */
  exclude = [],
  label = "Print",
}: {
  idKind: PrintDocumentIdKind;
  recordId: string | null | undefined;
  exclude?: readonly string[];
  label?: string;
}) {
  const hasPermission = usePermissionStore((state) => state.hasPermission);

  const documents = ALL_PRINT_DOCUMENTS.filter(
    (doc) => doc.idKind === idKind && !exclude.includes(doc.key) && hasPermission(doc.permission),
  );

  // Nothing this reader may print is not an empty toolbar — it is no toolbar.
  if (documents.length === 0 || !recordId) return null;

  return (
    <Group gap="xs" align="center" wrap="wrap">
      <Text size="sm" fw={600}>
        {label}
      </Text>
      {documents.map((doc) => (
        <PrintDocumentButton key={doc.key} documentKey={doc.key} recordId={recordId} />
      ))}
    </Group>
  );
}
