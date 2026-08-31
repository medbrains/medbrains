import { describe, expect, it } from "vitest";
import { resolveTokenActions, TOKEN_WORKFLOWS } from "./token-workflows";

/**
 * What the desk can do to a token, and when.
 *
 * The gap these cover is a patient standing at the counter after their
 * number was announced and missed. Every module has to offer the same way
 * out, because a queue whose recovery depends on which department you are
 * standing in is a queue nobody trusts.
 */

const PATIENT_FACING = ["registration", "opd", "pharmacy", "billing", "lab", "radiology"] as const;

describe("calling a token again", () => {
  it.each(PATIENT_FACING)("%s can re-call a token that was already called", (module) => {
    const recall = resolveTokenActions(module, "called").find((a) => a.id === "recall");

    expect(recall, `${module} offers no way to call a patient twice`).toBeDefined();
    // Back to `called`, not onward: the server refreshes called_at and
    // re-broadcasts, which is what makes the board announce a second time.
    expect(recall?.to).toBe("called");
  });

  it("is not offered before the first call, where Call already does it", () => {
    const waiting = resolveTokenActions("opd", "waiting").map((a) => a.id);

    expect(waiting).toContain("call");
    expect(waiting).not.toContain("recall");
  });

  it("is not offered for dispatch, whose called means an assigned vehicle", () => {
    expect(resolveTokenActions("dispatch", "called").map((a) => a.id)).not.toContain("recall");
  });
});

describe("the shape of every workflow", () => {
  it.each(PATIENT_FACING)("%s can reach a terminal state from every live one", (module) => {
    // A status a token can enter but never leave is a row stuck on the board
    // for the rest of the day. Recall makes `called` self-referential, so it
    // is the presence of *some other* action that matters.
    for (const status of ["waiting", "called", "serving"]) {
      const onward = resolveTokenActions(module, status).filter((a) => a.to !== status);
      const reachable = TOKEN_WORKFLOWS[module].statusLabels[status] !== undefined;
      if (!reachable) continue;
      expect(onward.length, `${module}/${status} is a dead end`).toBeGreaterThan(0);
    }
  });

  it("leaves a no-show alone, because recovery lives in the came-back panel", () => {
    // Deliberate: the board excludes no_show without include_finished, so the
    // console cannot see one anyway. Requeueing is the came-back panel's job.
    expect(resolveTokenActions("opd", "no_show")).toHaveLength(0);
  });
});
