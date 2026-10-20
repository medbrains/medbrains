import { afterEach, describe, expect, it, vi } from "vitest";
import { useAiAssistantStore } from "@/components/ai/assistant-store";
import { render, screen, userEvent } from "@/test/test-utils";
import { AiDraftInsert, aiDraftToHtml } from "./AiDraftInsert";

afterEach(() => useAiAssistantStore.getState().clearDraftOffer());

describe("AiDraftInsert (#4895)", () => {
  it("shows nothing when no AI answer was offered", () => {
    render(<AiDraftInsert sectionTitle="Plan" onAccept={vi.fn()} />);
    expect(
      screen.queryByRole("button", { name: "Insert AI draft into Plan" }),
    ).not.toBeInTheDocument();
  });

  it("inserts only on Accept, labelled, and spends the offer", async () => {
    useAiAssistantStore.getState().offerDraft("Rest\n\nFluids <2 L>");
    const onAccept = vi.fn();
    render(<AiDraftInsert sectionTitle="Plan" onAccept={onAccept} />);

    await userEvent.click(screen.getByRole("button", { name: "Insert AI draft into Plan" }));
    expect(await screen.findByLabelText("AI-generated draft")).toBeInTheDocument();
    expect(onAccept).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Accept and insert" }));
    expect(onAccept).toHaveBeenCalledWith("<p>Rest</p><p>Fluids &lt;2 L&gt;</p>");
    expect(useAiAssistantStore.getState().draftOffer).toBeNull();
  });

  it("Not now inserts nothing and keeps the offer", async () => {
    useAiAssistantStore.getState().offerDraft("Rest");
    const onAccept = vi.fn();
    render(<AiDraftInsert sectionTitle="Plan" onAccept={onAccept} />);
    await userEvent.click(screen.getByRole("button", { name: "Insert AI draft into Plan" }));
    await userEvent.click(await screen.findByRole("button", { name: "Not now" }));
    expect(onAccept).not.toHaveBeenCalled();
    expect(useAiAssistantStore.getState().draftOffer).toBe("Rest");
  });

  it("escapes AI text so it cannot inject markup into the note", () => {
    expect(aiDraftToHtml("<img src=x onerror=alert(1)>")).toBe(
      "<p>&lt;img src=x onerror=alert(1)&gt;</p>",
    );
  });
});
