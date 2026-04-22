import type { ResolvedSidecar } from "@medbrains/types";
import type { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@medbrains/api", () => ({
  api: {
    triggerPipeline: vi.fn(),
  },
}));

vi.mock("./executeInlineAction", () => ({
  executeInlineAction: vi.fn(),
}));

import { api } from "@medbrains/api";
import { executeInlineAction } from "./executeInlineAction";
import { runResolvedSidecars } from "./sidecarRuntime";

const queryClient = {
  invalidateQueries: vi.fn(),
} as unknown as QueryClient;

function makeSidecar(overrides: Partial<ResolvedSidecar>): ResolvedSidecar {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Test sidecar",
    trigger_event: "form_submit",
    trigger_config: {},
    pipeline_id: null,
    inline_action: null,
    condition: null,
    ...overrides,
  };
}

describe("runResolvedSidecars", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("triggers only matching pipeline sidecars", async () => {
    const screenData = { status: "approved", encounter_id: "ENC-001" };

    await runResolvedSidecars(
      [
        makeSidecar({
          id: "pipeline-match",
          trigger_event: "form_submit",
          pipeline_id: "22222222-2222-2222-2222-222222222222",
        }),
        makeSidecar({
          id: "pipeline-skip",
          trigger_event: "screen_load",
          pipeline_id: "33333333-3333-3333-3333-333333333333",
        }),
      ],
      "form_submit",
      {
        navigate: vi.fn(),
        queryClient,
        screenData,
      },
    );

    expect(api.triggerPipeline).toHaveBeenCalledTimes(1);
    expect(api.triggerPipeline).toHaveBeenCalledWith("22222222-2222-2222-2222-222222222222", {
      input_data: screenData,
    });
    expect(executeInlineAction).not.toHaveBeenCalled();
  });

  it("runs inline actions when the condition passes", async () => {
    const navigate = vi.fn();
    const screenData = { status: "approved", invoice_total: 1500 };
    const inlineAction = { type: "notification", message: "Approved" };

    await runResolvedSidecars(
      [
        makeSidecar({
          inline_action: inlineAction,
          condition: {
            logic: "and",
            rules: [{ field: "status", operator: "eq", value: "approved" }],
          },
        }),
      ],
      "form_submit",
      {
        navigate,
        queryClient,
        screenData,
      },
    );

    expect(executeInlineAction).toHaveBeenCalledTimes(1);
    expect(executeInlineAction).toHaveBeenCalledWith(inlineAction, {
      navigate,
      queryClient,
      screenData,
    });
    expect(api.triggerPipeline).not.toHaveBeenCalled();
  });

  it("skips sidecars when conditions fail", async () => {
    await runResolvedSidecars(
      [
        makeSidecar({
          pipeline_id: "44444444-4444-4444-4444-444444444444",
          condition: {
            logic: "and",
            rules: [{ field: "status", operator: "eq", value: "draft" }],
          },
        }),
      ],
      "form_submit",
      {
        navigate: vi.fn(),
        queryClient,
        screenData: { status: "approved" },
      },
    );

    expect(api.triggerPipeline).not.toHaveBeenCalled();
    expect(executeInlineAction).not.toHaveBeenCalled();
  });
});
