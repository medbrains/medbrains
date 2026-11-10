import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/test-utils";
import { AuditActor } from "./AuditActor";

const agent = {
  kind: "ai_agent" as const,
  agent: "clinical_assistant",
  model: "claude-sonnet",
  run_id: "11111111-2222-3333-4444-555555555555",
};

describe("AuditActor", () => {
  it("names the assistant and the clinician it acted for", () => {
    render(<AuditActor userName="Dr Meena Iyer" actingAgent={agent} />);
    expect(screen.getByLabelText("AI assistant on behalf of Dr Meena Iyer")).toBeInTheDocument();
    expect(screen.getByText("on behalf of Dr Meena Iyer")).toBeInTheDocument();
  });

  it("shows a person's own action as theirs alone, with no AI mark", () => {
    render(<AuditActor userName="Dr Meena Iyer" actingAgent={null} />);
    expect(screen.getByText("Dr Meena Iyer")).toBeInTheDocument();
    expect(screen.queryByText("AI")).not.toBeInTheDocument();
  });
});
