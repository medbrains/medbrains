import { Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconSparkles } from "@tabler/icons-react";
import { useAiAssistantStore } from "@/components/ai/assistant-store";
import { Response } from "@/components/ai/Response";
import { AiLabel, Button, Modal } from "@/components/ui";
import { escapeHtml } from "@/pages/patient-detail/shared";

interface AiDraftInsertProps {
  sectionTitle: string;
  /** Called with the accepted text as editor HTML; the caller saves it as AI-assisted. */
  onAccept: (html: string) => void;
}

/** Plain AI text as the rich-text editor's paragraphs, escaped. */
export function aiDraftToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/**
 * The only way an AI answer reaches a note (#4895): offered from the
 * assistant, shown here labelled, and inserted only when the author accepts
 * it. The acceptance is saved with the section marked AI-assisted and audited.
 */
export function AiDraftInsert({ sectionTitle, onAccept }: AiDraftInsertProps) {
  const draft = useAiAssistantStore((s) => s.draftOffer);
  const clearDraft = useAiAssistantStore((s) => s.clearDraftOffer);
  const [opened, { open, close }] = useDisclosure(false);
  if (!draft) return null;

  const accept = () => {
    onAccept(aiDraftToHtml(draft));
    clearDraft();
    close();
  };

  return (
    <>
      <Button
        tone="tertiary"
        size="xs"
        leftSection={<IconSparkles size={16} aria-hidden />}
        onClick={open}
        aria-label={`Insert AI draft into ${sectionTitle}`}
      >
        Insert AI draft
      </Button>
      <Modal
        opened={opened}
        onClose={close}
        title={`AI draft for ${sectionTitle}`}
        size="lg"
        primaryAction={{ label: "Accept and insert", onClick: accept }}
        secondaryAction={{ label: "Not now", onClick: close }}
      >
        <Stack gap="sm">
          <AiLabel size="sm" text="generated" aria-label="AI-generated draft" />
          <Text size="sm" c="dimmed">
            Read it before you accept. It is added to the end of {sectionTitle}, marked as
            AI-assisted, and your acceptance is recorded. You can still edit it before signing.
          </Text>
          <Response>{draft}</Response>
        </Stack>
      </Modal>
    </>
  );
}
