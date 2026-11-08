import { usePermissionStore } from "@medbrains/stores";
import { type Note, P, type SessionView } from "@medbrains/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { DictationPanel } from "./DictationPanel";
import { useDictatedRxStore } from "./dictated-rx-store";

const dictation = vi.hoisted(() => ({
  createDictation: vi.fn(),
  retryDictation: vi.fn(),
  reviewDictation: vi.fn(),
}));
const notes = vi.hoisted(() => ({ createNote: vi.fn(), saveNoteDraft: vi.fn() }));
vi.mock("@/services/dictation.service", () => ({ dictationService: dictation }));
vi.mock("@/services/clinicalNotes.service", () => ({ clinicalNotesService: notes }));

const TRANSCRIPT = "Fever for three days. Paracetamol 500 mg.";

function session(over: Partial<SessionView>): SessionView {
  return {
    id: "d-1",
    encounter_id: "enc-1",
    status: "drafted",
    failure: null,
    message: null,
    stt_adapter: "local",
    transcript: TRANSCRIPT,
    draft: {
      sections: [
        { code: "subjective", title: "Subjective", text: "Complaint: Fever for three days" },
        { code: "plan", title: "Plan", text: "Review in five days" },
      ],
      medicines: [
        { name: "Paracetamol", dose: "500 mg", frequency: "", duration: "3 days", route: "" },
      ],
    },
    duration_ms: 4000,
    created_at: "2026-11-08T10:00:00Z",
    ...over,
  };
}

const audio = () => new File([new Uint8Array([1, 2, 3])], "visit.webm", { type: "audio/webm" });

async function uploadRecording() {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("no file input");
  await userEvent.upload(input, audio());
}

/** jsdom plays no media: an upload's length reads as unknown at once. */
class SilentAudio {
  duration = Number.NaN;
  onloadedmetadata: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(_url: string) {
    setTimeout(() => this.onerror?.(), 0);
  }
}

beforeEach(() => {
  vi.stubGlobal("Audio", SilentAudio);
  URL.createObjectURL = () => "blob:x";
  URL.revokeObjectURL = () => {};
  usePermissionStore
    .getState()
    .setPermissions("doctor", [P.OPD.DICTATION.USE, P.CLINICAL_NOTES.WRITE]);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  useDictatedRxStore.getState().clear("enc-1");
});

describe("DictationPanel", () => {
  it("is not offered without the dictation permission", () => {
    usePermissionStore.getState().setPermissions("doctor", [P.CLINICAL_NOTES.WRITE]);
    render(<DictationPanel encounterId="enc-1" notes={[]} />);
    expect(screen.queryByRole("button", { name: "Dictate" })).not.toBeInTheDocument();
  });

  it("shows the draft beside the transcript and saves nothing until every line is decided", async () => {
    dictation.createDictation.mockResolvedValue(session({}));
    render(<DictationPanel encounterId="enc-1" notes={[]} />);
    await uploadRecording();

    expect(await screen.findByTestId("dictation-transcript")).toHaveTextContent(TRANSCRIPT);
    expect(dictation.createDictation).toHaveBeenCalledWith(
      "enc-1",
      expect.any(File),
      0,
      "uploaded",
    );
    expect(screen.getByLabelText("Subjective as drafted")).toHaveValue(
      "Complaint: Fever for three days",
    );
    expect(screen.getByRole("button", { name: "Save to note" })).toBeDisabled();
    expect(screen.getByText("3 suggestions still to accept or reject")).toBeInTheDocument();
    expect(notes.saveNoteDraft).not.toHaveBeenCalled();
  });

  it("saves only accepted (and edited) sections into the note, and hands accepted medicines to the pad", async () => {
    dictation.createDictation.mockResolvedValue(session({}));
    notes.createNote.mockResolvedValue({ id: "note-1", sections: [] } as unknown as Note);
    notes.saveNoteDraft.mockResolvedValue({});
    dictation.reviewDictation.mockResolvedValue({
      status: "saved",
      accepted: 1,
      edited: 1,
      rejected: 0,
    });
    render(<DictationPanel encounterId="enc-1" notes={[]} />);
    await uploadRecording();

    const plan = await screen.findByLabelText("Plan as drafted");
    await userEvent.clear(plan);
    await userEvent.type(plan, "Review in a week");
    await userEvent.click(screen.getByRole("button", { name: "Accept: Plan" }));
    await userEvent.click(screen.getByRole("button", { name: "Reject: Subjective" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Add to prescription pad: Paracetamol" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Save to note" }));

    await waitFor(() => expect(dictation.reviewDictation).toHaveBeenCalled());
    expect(notes.saveNoteDraft).toHaveBeenCalledWith("note-1", [
      { code: "plan", text: "<p>Review in a week</p>", ai_accepted: true },
    ]);
    expect(dictation.reviewDictation).toHaveBeenCalledWith("d-1", {
      note_id: "note-1",
      sections: [
        { code: "subjective", decision: "rejected", text: "Complaint: Fever for three days" },
        { code: "plan", decision: "accepted", text: "Review in a week" },
      ],
      medicines: [{ index: 0, decision: "accepted" }],
    });
    expect(useDictatedRxStore.getState().byEncounter["enc-1"]?.[0]?.name).toBe("Paracetamol");
  });

  it("Reject all files nothing in the note", async () => {
    dictation.createDictation.mockResolvedValue(session({}));
    dictation.reviewDictation.mockResolvedValue({
      status: "rejected",
      accepted: 0,
      edited: 0,
      rejected: 3,
    });
    render(<DictationPanel encounterId="enc-1" notes={[]} />);
    await uploadRecording();
    await userEvent.click(await screen.findByRole("button", { name: "Reject all" }));

    await waitFor(() => expect(dictation.reviewDictation).toHaveBeenCalled());
    expect(notes.createNote).not.toHaveBeenCalled();
    expect(notes.saveNoteDraft).not.toHaveBeenCalled();
    expect(dictation.reviewDictation.mock.calls[0]?.[1]).toMatchObject({ note_id: null });
    expect(useDictatedRxStore.getState().byEncounter["enc-1"]).toBeUndefined();
  });

  it("says plainly when speech-to-text is down, shows no draft, and can try again", async () => {
    dictation.createDictation.mockResolvedValue(
      session({
        status: "stt_failed",
        failure: "stt_unreachable",
        message: "Speech-to-text is not available, so nothing was transcribed.",
        transcript: null,
        draft: null,
      }),
    );
    dictation.retryDictation.mockResolvedValue(session({}));
    render(<DictationPanel encounterId="enc-1" notes={[]} />);
    await uploadRecording();

    expect(await screen.findByText(/nothing was transcribed/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save to note" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByTestId("dictation-transcript")).toHaveTextContent(TRANSCRIPT);
  });

  it("keeps the transcript in view when the model is down", async () => {
    dictation.createDictation.mockResolvedValue(
      session({
        status: "llm_failed",
        failure: "llm_unreachable",
        message: "The transcript is below, but the note could not be drafted from it.",
        draft: null,
      }),
    );
    render(<DictationPanel encounterId="enc-1" notes={[]} />);
    await uploadRecording();

    expect(await screen.findByText(/could not be drafted/)).toBeInTheDocument();
    expect(screen.getByTestId("dictation-transcript")).toHaveTextContent(TRANSCRIPT);
    expect(screen.getByRole("button", { name: "Type the note instead" })).toBeInTheDocument();
  });

  it("records from the microphone with a labelled stop control", async () => {
    const stopTrack = vi.fn();
    const stream = { getTracks: () => [{ stop: stopTrack }] };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    class FakeRecorder {
      state = "inactive";
      mimeType = "audio/webm";
      stream = stream;
      ondataavailable: ((e: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        this.ondataavailable?.({ data: new Blob(["x"], { type: "audio/webm" }) });
        this.onstop?.();
      }
    }
    vi.stubGlobal("MediaRecorder", FakeRecorder);
    dictation.createDictation.mockResolvedValue(session({}));
    render(<DictationPanel encounterId="enc-1" notes={[]} />);

    await userEvent.click(screen.getByRole("button", { name: "Dictate" }));
    expect(await screen.findByText(/Recording 0:00 of 10:00/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Stop dictation" }));

    await waitFor(() =>
      expect(dictation.createDictation).toHaveBeenCalledWith(
        "enc-1",
        expect.any(Blob),
        expect.any(Number),
        "recorded",
      ),
    );
    expect(stopTrack).toHaveBeenCalled();
  });
});
