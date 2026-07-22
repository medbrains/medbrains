// @vitest-environment node

import type { FieldCondition } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { evaluateFieldCondition, evaluateLogic, fieldConditionToJsonLogic } from "./logic";

/**
 * `evaluateFieldCondition` is documented as replacing the hand-rolled
 * `evaluateCondition` in @medbrains/schemas. It does not work.
 *
 * Every evaluation throws inside `evaluateLogic`, and the documented
 * "on error, default to true" fallback converts that into an unconditional
 * allow. These tests assert the broken behaviour deliberately: nothing
 * imports the function today, so this is a landmine rather than an outage,
 * and the tests make it visible until it is fixed.
 */

describe("rule translation is fine", () => {
  it("produces the JSON Logic a condition should compile to", () => {
    expect(fieldConditionToJsonLogic({ field: "gender", operator: "eq", value: "female" })).toEqual(
      {
        "===": [{ var: "gender" }, "female"],
      },
    );
    expect(fieldConditionToJsonLogic({ field: "age", operator: "gte", value: 18 })).toEqual({
      ">=": [{ var: "age" }, 18],
    });
  });

  it("composes all and any into and/or", () => {
    const leaf: FieldCondition = { field: "a", operator: "eq", value: 1 };
    expect(fieldConditionToJsonLogic({ field: "", operator: "eq", all: [leaf] })).toEqual({
      and: [{ "===": [{ var: "a" }, 1] }],
    });
    expect(fieldConditionToJsonLogic({ field: "", operator: "eq", any: [leaf] })).toEqual({
      or: [{ "===": [{ var: "a" }, 1] }],
    });
  });
});

describe("evaluation is broken", () => {
  /**
   * `evaluateLogic` sandboxes the data behind a Proxy, then calls
   * `flattenForJsonLogic` on it to get a plain object for json-logic-js.
   * That flatten uses `Object.keys()`, which trips the proxy's
   * `getOwnPropertyDescriptor` trap and throws. The catch turns it into a
   * failed result, so every rule fails regardless of the data.
   */
  it("every evaluation fails on the sandbox proxy", () => {
    const rule = fieldConditionToJsonLogic({ field: "gender", operator: "eq", value: "female" });
    const result = evaluateLogic(rule, { gender: "female" });

    expect(result.success).toBe(false);
    expect(result.success ? "" : result.error).toContain("getOwnPropertyDescriptor");
  });

  it("fails even for data that plainly satisfies the rule", () => {
    const rule = fieldConditionToJsonLogic({ field: "age", operator: "gte", value: 18 });
    expect(evaluateLogic(rule, { age: 30 }).success).toBe(false);
  });
});

describe("the failure is invisible to callers", () => {
  const eqFemale: FieldCondition = { field: "gender", operator: "eq", value: "female" };

  /**
   * The consequence: matching and non-matching data give the same answer.
   * A caller cannot tell the condition was never evaluated.
   */
  it("returns true for data that matches and data that does not", () => {
    expect(evaluateFieldCondition(eqFemale, { gender: "female" })).toBe(true);
    expect(evaluateFieldCondition(eqFemale, { gender: "male" })).toBe(true);
  });

  it("returns true for a contradiction that cannot be satisfied", () => {
    const impossible: FieldCondition = {
      field: "",
      operator: "eq",
      all: [
        { field: "x", operator: "eq", value: 1 },
        { field: "x", operator: "eq", value: 2 },
      ],
    };
    expect(evaluateFieldCondition(impossible, { x: 1 })).toBe(true);
  });

  /**
   * The one case that still works, and it pins the cause precisely: with an
   * empty data object the proxy has no keys, `Object.keys()` never reaches
   * the failing trap, and the rule evaluates for real. So the function is
   * correct exactly when there is nothing to evaluate against, and wrong for
   * every context that carries data.
   */
  it("evaluates correctly only when the context is empty", () => {
    expect(evaluateFieldCondition(eqFemale, {})).toBe(false);
    expect(evaluateFieldCondition({ field: "", operator: "eq", any: [] }, {})).toBe(false);

    // The moment the context has a key, it flips to the unconditional allow.
    expect(evaluateFieldCondition(eqFemale, { gender: "male" })).toBe(true);
  });
});

describe("why this matters if the migration is completed", () => {
  /**
   * buildFormSchema uses the condition result to decide whether a
   * `conditional` field is mandatory. Swapping in this implementation as the
   * comment intends would make every conditional field both visible and
   * required on every form, because the answer is always true.
   *
   * The schemas implementation, whatever its own quirks, does evaluate.
   */
  it("no input produces a false, so no condition can ever hide or relax a field", () => {
    const inputs: Array<[FieldCondition, Record<string, unknown>]> = [
      [{ field: "a", operator: "eq", value: "x" }, { a: "y" }],
      [{ field: "n", operator: "lt", value: 5 }, { n: 100 }],
      [{ field: "f", operator: "is_not_empty" }, { f: "" }],
      [{ field: "s", operator: "contains", value: "zzz" }, { s: "abc" }],
    ];
    for (const [condition, values] of inputs) {
      expect(evaluateFieldCondition(condition, values)).toBe(true);
    }
  });
});
