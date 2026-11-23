import { Box, Group, Stack, Text } from "@mantine/core";
import { useNetwork } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useState } from "react";
import { Alert, Button, Checkbox, SegmentedControl, SignaturePad } from "@/components/ui";
import { SignaturePrintPreview } from "./SignaturePrintPreview";
import { SignatureUploadField } from "./SignatureUploadField";

/** Where the signature image comes from; `none` signs with no image. */
type Source = "draw" | "upload" | "none";
const SOURCES: Array<{ value: Source; label: string }> = [
  { value: "draw", label: "Draw" },
  { value: "upload", label: "Upload" },
  { value: "none", label: "No image" },
];

interface SignatureSetupFormProps {
  isSaving: boolean;
  /** Why the last save failed, in words for the signer; `null` when it did not. */
  problem: string | null;
  onSave: (image: string | null) => void;
  onLater: () => void;
}

/**
 * The form inside the signature set-up dialog: draw, upload or no image, the
 * printed preview, and the signer's own statement. Switching between the
 * three keeps what was drawn or chosen, and so does a failed save.
 */
export function SignatureSetupForm({
  isSaving,
  problem,
  onSave,
  onLater,
}: SignatureSetupFormProps) {
  const canManage = useHasPermission(P.SIGNATURES.OWN.MANAGE);
  const { online } = useNetwork();
  const [source, setSource] = useState<Source>("draw");
  const [drawn, setDrawn] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<string | null>(null);
  const [isOwn, setIsOwn] = useState(false);
  const image = { draw: drawn, upload: uploaded, none: null }[source];
  let blocked: string | null = null;
  if (!canManage) blocked = "Your role cannot set up a signature. Ask your administrator.";
  else if (!online) blocked = "You are offline. Connect to save your signature. Nothing is queued.";
  const canSave = !blocked && isOwn && (source === "none" || image !== null);

  return (
    <Stack gap="md">
      <Text size="sm">
        You have no signature yet. Set it up once and it is printed on the records you sign. The
        record you were signing is saved, and stays unsigned until you sign it.
      </Text>
      <SegmentedControl
        aria-label="How to add your signature"
        fullWidth
        data={SOURCES}
        value={source}
        onChange={(value) => setSource(value as Source)}
      />
      <Box display={source === "draw" ? undefined : "none"}>
        <SignaturePad label="Draw your signature" onChange={setDrawn} />
      </Box>
      <Box display={source === "upload" ? undefined : "none"}>
        <SignatureUploadField onChange={setUploaded} />
      </Box>
      <SignaturePrintPreview image={image} isAwaitingImage={source !== "none"} />
      <Checkbox
        required
        checked={isOwn}
        onChange={(event) => setIsOwn(event.currentTarget.checked)}
        label="This is my own signature and I am setting it myself."
      />
      {problem && (
        <Alert tone="danger" title="Your signature was not saved">
          <Stack gap="xs" align="flex-start">
            <Text size="sm">{problem}</Text>
            <Button size="xs" disabled={!canSave} onClick={() => onSave(image)}>
              Retry
            </Button>
          </Stack>
        </Alert>
      )}
      {blocked && (
        <Text size="sm" role="status">
          {blocked}
        </Text>
      )}
      <Group justify="flex-end">
        <Button tone="ghost" onClick={onLater}>
          Later
        </Button>
        <Button tone="primary" loading={isSaving} disabled={!canSave} onClick={() => onSave(image)}>
          Save signature
        </Button>
      </Group>
    </Stack>
  );
}
