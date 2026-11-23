/**
 * PrintSignatureBlock — the signature area of a printed document
 * (prescriptions, lab reports, certificates).
 *
 * The area never prints empty, because blank paper under "Signature" reads
 * as signed to whoever is handed it:
 *   1. no signature → "Not signed", in words;
 *   2. signed with the signer's own image → that image;
 *   3. signed with no image → "Digitally signed by <name>, Reg. no. <no>,
 *      <date>", in words. Never the name drawn in a script font: that would
 *      be handwriting the system made up.
 *
 * Per RFCs/sprints/SPRINT-doctor-activities.md §2.4.
 */
import { Group, Stack, Text } from "@mantine/core";
import type { PrintSignatureData } from "@medbrains/types";
import { Badge, type BadgeTone, Image } from "@/components/ui";

/** What an unsigned document prints where the signature would be. */
export const NOT_SIGNED = "Not signed";

const LEGAL_CLASS: Record<string, { label: string; tone: BadgeTone }> = {
  medico_legal: { label: "Medico-legal", tone: "danger" },
  statutory_export: { label: "Statutory", tone: "warning" },
  clinical: { label: "Clinical", tone: "info" },
};

/** When a signature was made, in the reader's own date and time format. */
function signedAt(sig: PrintSignatureData): string {
  const at = new Date(sig.signed_at);
  return `${at.toLocaleDateString()} ${at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

/** The words a signature with no image prints: who, their registration number, when. */
export function signedInWords(sig: PrintSignatureData): string {
  const registration = sig.signer_registration ? `, Reg. no. ${sig.signer_registration}` : "";
  return `Digitally signed by ${sig.signer_name ?? "the signer"}${registration}, ${signedAt(sig)}`;
}

interface PrintSignatureBlockProps {
  signatures: PrintSignatureData[] | null | undefined;
  /** Shown above the signatures (for example "Pathologist", "Surgeon"). */
  label?: string;
}

/** The signature area: every signer's block, or "Not signed". */
export function PrintSignatureBlock({ signatures, label }: PrintSignatureBlockProps) {
  const sigs = signatures ?? [];
  return (
    <Stack gap="xs" mt="lg">
      {label && (
        <Text size="xs" fw={600} c="var(--mb-text-secondary)">
          {label}
        </Text>
      )}
      {sigs.length === 0 && (
        <Text size="sm" fw={600}>
          {NOT_SIGNED}. Draft: not for legal or clinical use.
        </Text>
      )}
      <Group gap="lg" align="flex-start">
        {sigs.map((sig, index) => (
          <SingleSignature key={sig.verify_ref} sig={sig} index={index} />
        ))}
      </Group>
    </Stack>
  );
}

/** One signer's block: their image or the words, then who, when and how to verify. */
function SingleSignature({ sig, index }: { sig: PrintSignatureData; index: number }) {
  const legal = LEGAL_CLASS[sig.legal_class] ?? { label: sig.legal_class, tone: "neutral" };
  return (
    <Stack gap={2} miw={200} pt="xs" style={{ borderTop: "2px solid var(--mb-border-strong)" }}>
      {sig.display_image_url ? (
        <Image
          src={sig.display_image_url}
          alt={`Signature of ${sig.signer_name ?? "the signer"}`}
          mah={56}
          maw={200}
          fit="contain"
        />
      ) : (
        <Text size="sm">{signedInWords(sig)}</Text>
      )}
      <Text size="xs" fw={600}>
        {sig.signer_name ?? "Signer"}
      </Text>
      <Text size="xs" c="var(--mb-text-secondary)">
        {index === 0 ? "Primary" : `Co-signer ${index}`} • {signedAt(sig)}
      </Text>
      <Text size="xs" ff="monospace" c="var(--mb-text-secondary)">
        Verify: {sig.verify_ref.slice(0, 12)}…
      </Text>
      <Group>
        <Badge size="xs" tone={legal.tone}>
          {legal.label}
        </Badge>
      </Group>
    </Stack>
  );
}
