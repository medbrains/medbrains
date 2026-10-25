import { usePermissionStore } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/test-utils";
import { ToolView } from "./ToolView";
import { AI_TOOL } from "./tools";

const call = {
  id: "c1",
  name: AI_TOOL.QUERY,
  args: { sql: "SELECT count(*) FROM ai_query.visits", question: "How many visits?" },
  result: { row_count: 1 },
  status: "done" as const,
};

describe("a query step shows its SQL only to someone who may run one", () => {
  it("shows the statement to a holder of the query permission", () => {
    usePermissionStore.getState().setPermissions("doctor", [P.AI.ASSISTANT.QUERY]);
    render(<ToolView toolCall={call} />);
    expect(screen.getByText("Query used")).toBeInTheDocument();
    expect(screen.getByText(/SELECT count\(\*\) FROM ai_query\.visits/)).toBeInTheDocument();
  });

  it("names the step but hides the statement from everyone else", () => {
    usePermissionStore.getState().setPermissions("doctor", [P.AI.ASSISTANT.USE]);
    render(<ToolView toolCall={call} />);
    expect(screen.getByText("Query used")).toBeInTheDocument();
    expect(screen.queryByText(/SELECT count/)).not.toBeInTheDocument();
  });
});
