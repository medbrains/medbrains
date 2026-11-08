import { Box, FileButton, Group, Loader, Stack, Text } from "@mantine/core";
import { useHasAllPermissions } from "@medbrains/stores";
import {
  type MedicineDecision,
  type Note,
  P,
  type SectionDecision,
  type SessionView,
} from "@medbrains/types";
import { IconMicrophone, IconPlayerStop, IconUpload } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Button, Card, toast } from "@/components/ui";
import { dictationService } from "@/services/dictation.service";
import { DictationReview } from "./DictationReview";
import { useDictatedRxStore } from "./dictated-rx-store";
import styles from "./dictation.module.scss";
import { saveReviewedDraft } from "./save-reviewed-draft";
import { formatClock, MAX_DICTATION_MS, type Recording, useRecorder } from "./useRecorder";

/** The server's upload limit. */
const MAX_UPLOAD_BYTES = 24 * 1024 * 1024;

interface DictationPanelProps {
  encounterId: string;
  /** The visit's notes, as the case sheet has them. */
  notes: Note[];
}

/** How long the browser may take to read an upload's length before sending anyway. */
const DURATION_READ_MS = 3000;

/** How long an uploaded file plays, read by the browser; 0 when it cannot tell. */
function audioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    /** Settle once with the length read (or 0), releasing the object URL. */
    const done = (ms: number) => {
      clearTimeout(giveUp);
      audio.onloadedmetadata = null;
      audio.onerror = null;
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(ms) ? ms : 0);
    };
    const giveUp = setTimeout(() => done(0), DURATION_READ_MS);
    audio.onloadedmetadata = () => done(audio.duration * 1000);
    audio.onerror = () => done(0);
    audio.src = url;
  });
}

/**
 * Dictate the consultation: record (or upload) the doctor's voice, see it
 * transcribed and drafted, then accept, edit or reject each section into
 * the consultation note. When speech-to-text or the model is down it says so
 * and the doctor types as usual; an empty draft is never shown as a result.
 */
export function DictationPanel({ encounterId, notes }: DictationPanelProps) {
  // Saving into the note needs the note permission too: gate on both.
  const canDictate = useHasAllPermissions([P.OPD.DICTATION.USE, P.CLINICAL_NOTES.WRITE]);
  const queryClient = useQueryClient();
  const offerRx = useDictatedRxStore((s) => s.offer);
  const [session, setSession] = useState<SessionView | null>(null);

  const send = useMutation({
    mutationFn: (input: Recording & { source: "recorded" | "uploaded" }) =>
      dictationService.createDictation(encounterId, input.audio, input.durationMs, input.source),
    onSuccess: setSession,
    onError: (error: Error) => toast.error(error.message, { title: "Dictation not sent" }),
  });
  const retry = useMutation({
    mutationFn: (id: string) => dictationService.retryDictation(id),
    onSuccess: setSession,
    onError: (error: Error) => toast.error(error.message, { title: "Not tried again" }),
  });
  const save = useMutation({
    mutationFn: (input: { sections: SectionDecision[]; medicines: MedicineDecision[] }) => {
      if (!session) throw new Error("No dictation to save");
      return saveReviewedDraft({ encounterId, session, notes, ...input });
    },
    onSuccess: (summary, input) => {
      for (const m of input.medicines) {
        const medicine = session?.draft?.medicines[m.index];
        if (m.decision === "accepted" && medicine) offerRx(encounterId, medicine);
      }
      void queryClient.invalidateQueries({ queryKey: ["clinical-notes", encounterId] });
      setSession(null);
      toast.success(
        summary.status === "saved"
          ? "Your consultation note has the accepted text. Read it and sign below."
          : "Nothing from the dictation was kept.",
        { title: summary.status === "saved" ? "Saved to your note" : "Dictation discarded" },
      );
    },
    onError: (error: Error) => toast.error(error.message, { title: "Not saved" }),
  });
  const recorder = useRecorder((recording) => send.mutate({ ...recording, source: "recorded" }));

  if (!canDictate) return null;

  /** Send an uploaded file, refusing one past the size or length limit first. */
  const upload = async (file: File | null) => {
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error("Upload a recording of 24 MB or less.", { title: "Recording too large" });
      return;
    }
    const durationMs = await audioDuration(file);
    if (durationMs > MAX_DICTATION_MS) {
      toast.error("A dictation is at most 10 minutes.", { title: "Recording too long" });
      return;
    }
    send.mutate({ audio: file, durationMs, source: "uploaded" });
  };

  const busy = send.isPending || retry.isPending;
  const recording = recorder.state.kind === "recording" ? recorder.state : null;

  return (
    <Card withBorder padding="md" aria-label="Dictation">
      <Stack gap="sm">
        <Group justify="space-between">
          <Text fw={700}>Dictate this consultation</Text>
          {!session && !busy && !recording && (
            <Group gap="xs">
              <Button
                tone="primary"
                size="xs"
                leftSection={<IconMicrophone size={16} aria-hidden />}
                onClick={() => void recorder.start()}
              >
                Dictate
              </Button>
              <FileButton onChange={(file) => void upload(file)} accept="audio/*">
                {(props) => (
                  <Button
                    {...props}
                    tone="tertiary"
                    size="xs"
                    leftSection={<IconUpload size={16} aria-hidden />}
                  >
                    Upload recording
                  </Button>
                )}
              </FileButton>
            </Group>
          )}
        </Group>
        {!session && !busy && !recording && (
          <Text size="xs" c="dimmed">
            Your voice is transcribed on this hospital's own server and drafted into the note. You
            accept, edit or reject every section before anything is saved.
          </Text>
        )}
        {recorder.state.kind === "unavailable" && (
          <Alert tone="warning" title="Cannot record">
            <Text size="sm">{recorder.state.reason}</Text>
          </Alert>
        )}
        {recording && (
          <Group gap="sm" role="status">
            <Box className={styles.recordingDot} aria-hidden />
            <Text size="sm" fw={600}>
              Recording {formatClock(recording.elapsedMs)} of {formatClock(MAX_DICTATION_MS)}
            </Text>
            <Button
              tone="danger"
              size="xs"
              leftSection={<IconPlayerStop size={16} aria-hidden />}
              aria-label="Stop dictation"
              onClick={recorder.stop}
            >
              Stop
            </Button>
          </Group>
        )}
        {busy && (
          <Group gap="xs" role="status">
            <Loader size="xs" />
            <Text size="sm">Transcribing and drafting. You can keep working on the visit.</Text>
          </Group>
        )}
        {session && !busy && (
          <SessionResult
            session={session}
            saving={save.isPending}
            onRetry={() => retry.mutate(session.id)}
            onDismiss={() => setSession(null)}
            onSave={(sections, medicines) => save.mutate({ sections, medicines })}
          />
        )}
      </Stack>
    </Card>
  );
}

interface SessionResultProps {
  session: SessionView;
  saving: boolean;
  onRetry: () => void;
  onDismiss: () => void;
  onSave: (sections: SectionDecision[], medicines: MedicineDecision[]) => void;
}

/** A draft to review, or the step that failed in plain words with a way on. */
function SessionResult({ session, saving, onRetry, onDismiss, onSave }: SessionResultProps) {
  if (session.status === "drafted" && session.draft) {
    return <DictationReview session={session} saving={saving} onSave={onSave} />;
  }
  const canRetry = session.status === "stt_failed" || session.status === "llm_failed";
  return (
    <Stack gap="sm">
      <Alert
        tone={session.status === "no_speech" ? "warning" : "danger"}
        title={session.status === "llm_failed" ? "Not drafted" : "Not transcribed"}
      >
        <Text size="sm">
          {session.message ?? "Dictation did not work. Type the note as usual."}
        </Text>
      </Alert>
      {session.transcript && (
        <Card withBorder padding="sm">
          <Text fw={600} size="sm">
            What you said
          </Text>
          <Text size="sm" className={styles.transcript} data-testid="dictation-transcript">
            {session.transcript}
          </Text>
        </Card>
      )}
      <Group gap="xs">
        {canRetry && (
          <Button tone="tertiary" size="xs" onClick={onRetry}>
            Try again
          </Button>
        )}
        <Button tone="ghost" size="xs" onClick={onDismiss}>
          Type the note instead
        </Button>
      </Group>
    </Stack>
  );
}
