import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/test-utils";
import { Message } from "./Message";
import { refusalReason } from "./transport/sse";

const UNSAFE =
  "Couldn't run the AI safely, so nothing was sent to it. Carry on without it, or try again.";

describe("a refused AI turn says why", () => {
  it("reads the server's reason, not just a status code", async () => {
    const response = new Response(
      JSON.stringify({ error: "service unavailable", detail: UNSAFE }),
      {
        status: 503,
      },
    );
    expect(await refusalReason(response)).toBe(UNSAFE);
    expect(await refusalReason(new Response("oops", { status: 502 }))).toBe(
      "Assistant unavailable (502)",
    );
  });

  it("shows the reason on the failed answer", () => {
    render(
      <Message
        message={{
          id: "a",
          role: "assistant",
          content: "",
          createdAt: "2026-10-25T09:00:00Z",
          status: "error",
          error: UNSAFE,
        }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't run the AI safely");
  });
});

describe("an answer the guard cut says so", () => {
  it("shows what was removed and why", () => {
    const notice =
      "Removed from this answer: a sentence that read the record as a diagnosis. Diagnosis is the treating clinician's decision.";
    render(
      <Message
        message={{
          id: "b",
          role: "assistant",
          content: "Ferritin 6 ng/mL (L).",
          createdAt: "2026-10-25T09:00:00Z",
          status: "complete",
          guardNotices: [notice],
        }}
      />,
    );
    expect(screen.getByText("Part of this answer was removed")).toBeInTheDocument();
    expect(screen.getByText(notice)).toBeInTheDocument();
  });
});
