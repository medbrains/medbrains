import { FileInput } from "@mantine/core";
import { IconPhoto } from "@tabler/icons-react";
import { useState } from "react";

/** The largest image the server accepts for a signature. */
const MAX_BYTES = 750_000;
const TYPES = ["image/png", "image/jpeg", "image/webp"];
const RULE = "Use a PNG, JPEG or WebP image under 750 KB.";

interface SignatureUploadFieldProps {
  /** The chosen image as a data URL, or `null` when none is chosen or it was refused. */
  onChange: (image: string | null) => void;
}

/**
 * The upload way of setting a signature: one image file, refused on the
 * field, naming the limit, when it is the wrong type or too large. The
 * server checks again.
 */
export function SignatureUploadField({ onChange }: SignatureUploadFieldProps) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Check the chosen file and hand it on as a data URL. */
  const choose = (next: File | null) => {
    const refused = next !== null && (!TYPES.includes(next.type) || next.size > MAX_BYTES);
    setFile(refused ? null : next);
    setError(refused ? `That file was not accepted. ${RULE}` : null);
    onChange(null);
    if (!next || refused) return;
    const reader = new FileReader();
    reader.onload = () => onChange(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => setError("Could not read that file. Choose it again.");
    reader.readAsDataURL(next);
  };

  return (
    <FileInput
      label="Signature image"
      description={RULE}
      placeholder="Choose a file"
      accept={TYPES.join(",")}
      clearable
      value={file}
      onChange={choose}
      error={error}
      leftSection={<IconPhoto size={16} />}
    />
  );
}
