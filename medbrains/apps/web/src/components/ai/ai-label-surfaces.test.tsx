import { usePermissionStore } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { AiChatPanel } from "./AiChatPanel";
import { useAiAssistantStore } from "./assistant-store";
import { Message } from "./Message";
import type { ChatMessage } from "./transport/types";
import type { UseAiChat } from "./useAiChat";

// lottie-web needs a real canvas; the mascot is not what is under test.
// jsdom has no layout; the conversation scrolls itself to the newest turn.
Element.prototype.scrollTo = () => {};

const answer: ChatMessage = {
  id: "a1",
  role: "assistant",
  content: "Plan: paracetamol 500 mg if fever.",
  createdAt: "2026-10-20T09:00:00Z",
  status: "complete",
  patientId: "patient-a",
};
const question: ChatMessage = { ...answer, id: "u1", role: "user", content: "Draft a plan" };

function controller(messages: ChatMessage[]): UseAiChat {
  return {
    messages,
    status: "idle",
    send: vi.fn(async () => {}),
    stop: vi.fn(),
    reset: vi.fn(),
    regenerate: vi.fn(async () => {}),
    hydrate: vi.fn(),
  };
}

afterEach(() => {
  usePermissionStore.getState().clearPermissions();
  useAiAssistantStore.getState().clearDraftOffer();
});

describe("AI output is always labelled (#4895)", () => {
  it("labels an assistant answer and not the user's own words", () => {
    render(<Message message={answer} />);
    expect(screen.getByLabelText("AI-generated answer")).toBeInTheDocument();
    render(<Message message={question} />);
    expect(screen.getAllByLabelText("AI-generated answer")).toHaveLength(1);
  });

  it("labels the assistant panel itself, with what AI may and may not do", async () => {
    render(<AiChatPanel controller={controller([])} />);
    await userEvent.click(screen.getByRole("button", { name: "About AI support" }));
    expect(await screen.findByText(/Nothing goes into a patient record/)).toBeInTheDocument();
  });
});

describe("an AI answer only reaches a note through the case sheet", () => {
  it("offers a finished answer for a note, without writing anything", async () => {
    usePermissionStore.getState().setPermissions("doctor", [P.CLINICAL_NOTES.WRITE]);
    render(<AiChatPanel controller={controller([question, answer])} />);
    await userEvent.click(screen.getByRole("button", { name: "Use in note" }));
    expect(useAiAssistantStore.getState().draftOffer).toEqual({
      text: answer.content,
      patientId: "patient-a",
    });
  });

  it("does not offer an answer that was about no patient", () => {
    usePermissionStore.getState().setPermissions("doctor", [P.CLINICAL_NOTES.WRITE]);
    const general = { ...answer, patientId: undefined };
    render(<AiChatPanel controller={controller([question, general])} />);
    expect(screen.queryByRole("button", { name: "Use in note" })).not.toBeInTheDocument();
  });

  it("does not offer it to someone who cannot write notes", () => {
    usePermissionStore.getState().setPermissions("receptionist", []);
    render(<AiChatPanel controller={controller([question, answer])} />);
    expect(screen.queryByRole("button", { name: "Use in note" })).not.toBeInTheDocument();
  });
});
