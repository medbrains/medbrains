import { afterEach, describe, expect, it, vi } from "vitest";
import { useAiAssistantStore } from "@/components/ai/assistant-store";
import { render, screen, userEvent } from "@/test/test-utils";
import { AiDraftInsert, aiDraftToHtml } from "./AiDraftInsert";

afterEach(() => useAiAssistantStore.getState().clearDraftOffer());

describe("AiDraftInsert (#4895)", () => {
  it("shows nothing when no AI answer was offered", () => {
    render(<AiDraftInsert sectionTitle="Plan" patientId="patient-a" onAccept={vi.fn()} />);
    expect(
      screen.queryByRole("button", { name: "Insert AI draft into Plan" }),
    ).not.toBeInTheDocument();
  });

  it("inserts only on Accept, labelled, and spends the offer", async () => {
    useAiAssistantStore.getState().offerDraft("Rest\n\nFluids <2 L>", "patient-a");
    const onAccept = vi.fn();
    render(<AiDraftInsert sectionTitle="Plan" patientId="patient-a" onAccept={onAccept} />);

    await userEvent.click(screen.getByRole("button", { name: "Insert AI draft into Plan" }));
    expect(await screen.findByLabelText("AI-generated draft")).toBeInTheDocument();
    expect(onAccept).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Accept and insert" }));
    expect(onAccept).toHaveBeenCalledWith("<p>Rest</p><p>Fluids &lt;2 L&gt;</p>");
    expect(useAiAssistantStore.getState().draftOffer).toBeNull();
  });

  it("Not now inserts nothing and keeps the offer", async () => {
    useAiAssistantStore.getState().offerDraft("Rest", "patient-a");
    const onAccept = vi.fn();
    render(<AiDraftInsert sectionTitle="Plan" patientId="patient-a" onAccept={onAccept} />);
    await userEvent.click(screen.getByRole("button", { name: "Insert AI draft into Plan" }));
    await userEvent.click(await screen.findByRole("button", { name: "Not now" }));
    expect(onAccept).not.toHaveBeenCalled();
    expect(useAiAssistantStore.getState().draftOffer?.text).toBe("Rest");
  });

  it("never offers one patient's AI answer into another patient's note", () => {
    useAiAssistantStore.getState().offerDraft("K+ 6.9 — repeat ECG", "patient-a");
    render(<AiDraftInsert sectionTitle="Plan" patientId="patient-b" onAccept={vi.fn()} />);
    expect(
      screen.queryByRole("button", { name: "Insert AI draft into Plan" }),
    ).not.toBeInTheDocument();
  });

  it("escapes AI text so it cannot inject markup into the note", () => {
    expect(aiDraftToHtml("<img src=x onerror=alert(1)>")).toBe(
      "<p>&lt;img src=x onerror=alert(1)&gt;</p>",
    );
  });
});
