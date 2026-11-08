/**
 * The Sign control every record screen uses: opens the review screen (which
 * records that the signer opened the record) and signs with a fresh step-up.
 *
 * It renders only for a type the server signs and a signer whose permission
 * signs it, so no screen offers a signature the server would refuse.
 */
import { IconCheck, IconSignature } from "@tabler/icons-react";
import { useState } from "react";
import { SignWorkspace } from "@/components/Doctor/SignWorkspace";
import { Badge, IconButton, Tooltip } from "@/components/ui";
import { canSignType, useSignableTypes } from "@/hooks/useSignableTypes";

interface SignRecordButtonProps {
  recordType: string;
  recordId: string | null | undefined;
  /** The row already carries a signature (`is_signed`), when it says so. */
  isSigned?: boolean;
  patientName?: string | null;
  uhid?: string | null;
  summary?: string | null;
  onSigned?: () => void;
}

/** A per-record Sign button, or a "Signed" badge once signed. */
export function SignRecordButton({
  recordType,
  recordId,
  isSigned,
  patientName,
  uhid,
  summary,
  onSigned,
}: SignRecordButtonProps) {
  const { types, isError, rights } = useSignableTypes();
  const [open, setOpen] = useState(false);
  const [signedHere, setSignedHere] = useState(false);
  const info = types?.get(recordType);

  if (!recordId) return null;
  if (isError) {
    return (
      <Tooltip label="Signing is unavailable right now. Try again shortly.">
        <IconButton tone="default" disabled aria-label="Signing unavailable">
          <IconSignature size={16} />
        </IconButton>
      </Tooltip>
    );
  }
  if (!canSignType(info, rights)) return null;
  if (isSigned || signedHere) {
    return (
      <Badge size="sm" tone="success" leftSection={<IconCheck size={12} />}>
        Signed
      </Badge>
    );
  }
  const label = `Sign ${info?.label.toLowerCase() ?? "record"}`;
  return (
    <>
      <Tooltip label={label}>
        <IconButton tone="primary" aria-label={label} onClick={() => setOpen(true)}>
          <IconSignature size={16} />
        </IconButton>
      </Tooltip>
      {open && (
        <SignWorkspace
          opened
          target={{
            record_type: recordType,
            record_id: recordId,
            patient_name: patientName,
            uhid,
            summary,
          }}
          onClose={() => setOpen(false)}
          onSigned={() => {
            setOpen(false);
            setSignedHere(true);
            onSigned?.();
          }}
        />
      )}
    </>
  );
}
