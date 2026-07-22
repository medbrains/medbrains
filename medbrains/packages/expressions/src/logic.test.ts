// @vitest-environment node

import type { FieldCondition } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { evaluateComputed } from "./computed";
import { evaluateFieldCondition, evaluateLogic, fieldConditionToJsonLogic } from "./logic";
import { createSandboxedContext } from "./sandbox";
import { renderTemplate } from "./template";

/**
 * Every evaluator in this package walks its context with `Object.keys()` after
 * sandboxing it behind a Proxy. The proxy's descriptor trap used to report
 * properties as non-configurable when the target's were configurable, which
 * is a Proxy invariant violation — the engine threw, all three evaluators
 * caught it, and each degraded silently.
 *
 * The tests below would all have failed before that trap was corrected.
 */

describe("sandboxed contexts can be walked", () => {
  it("Object.keys works on a sandboxed context", () => {
    const ctx = createSandboxedContext({ qty: 4, patient: { age: 30 } });
    expect(Object.keys(ctx).sort()).toEqual(["patient", "qty"]);
  });

  it("still hides blocked keys and refuses writes", () => {
    const ctx = createSandboxedContext({ qty: 4, constructor: "evil", window: "evil" });
    expect(Object.keys(ctx)).toEqual(["qty"]);
    expect((ctx as Record<string, unknown>).constructor).toBeUndefined();
    expect(() => {
      (ctx as Record<string, unknown>).qty = 99;
    }).toThrow();
  });
});

describe("json logic", () => {
  it("translates a condition to the expected rule", () => {
    expect(fieldConditionToJsonLogic({ field: "gender", operator: "eq", value: "female" })).toEqual(
      {
        "===": [{ var: "gender" }, "female"],
      },
    );
  });

  it("evaluates against real data instead of failing", () => {
    const rule = fieldConditionToJsonLogic({ field: "age", operator: "gte", value: 18 });
    expect(evaluateLogic(rule, { age: 30 })).toEqual({ success: true, value: true });
    expect(evaluateLogic(rule, { age: 10 })).toEqual({ success: true, value: false });
  });
});

describe("evaluateFieldCondition discriminates", () => {
  const eqFemale: FieldCondition = { field: "gender", operator: "eq", value: "female" };

  /**
   * The regression that matters: matching and non-matching data must give
   * different answers. Previously both returned true, because the evaluation
   * threw and the on-error fallback allowed everything through.
   */
  it("separates matching from non-matching data", () => {
    expect(evaluateFieldCondition(eqFemale, { gender: "female" })).toBe(true);
    expect(evaluateFieldCondition(eqFemale, { gender: "male" })).toBe(false);
  });

  it("evaluates a contradiction as false", () => {
    const impossible: FieldCondition = {
      field: "",
      operator: "eq",
      all: [
        { field: "x", operator: "eq", value: 1 },
        { field: "x", operator: "eq", value: 2 },
      ],
    };
    expect(evaluateFieldCondition(impossible, { x: 1 })).toBe(false);
  });

  it("handles composites and nested context", () => {
    const adultFemale: FieldCondition = {
      field: "",
      operator: "eq",
      all: [eqFemale, { field: "age", operator: "gte", value: 18 }],
    };
    expect(evaluateFieldCondition(adultFemale, { gender: "female", age: 30 })).toBe(true);
    expect(evaluateFieldCondition(adultFemale, { gender: "female", age: 10 })).toBe(false);
  });

  it("reads _tenant.* from the tenant context", () => {
    const c: FieldCondition = { field: "_tenant.country", operator: "eq", value: "IN" };
    expect(evaluateFieldCondition(c, { any: "data" }, { country: "IN" })).toBe(true);
    expect(evaluateFieldCondition(c, { any: "data" }, { country: "US" })).toBe(false);
  });

  /**
   * The documented fallback still applies when a rule genuinely cannot be
   * evaluated — it just no longer fires on every call.
   */
  it("still allows when the condition itself is unusable", () => {
    const bogus = { field: "f", operator: "no_such_operator" } as unknown as FieldCondition;
    expect(evaluateFieldCondition(bogus, { f: 1 })).toBe(true);
  });
});

describe("the other evaluators were broken by the same trap", () => {
  it("computed expressions evaluate against a populated context", () => {
    expect(evaluateComputed("qty * price", { qty: 4, price: 25 })).toEqual({
      success: true,
      value: 100,
    });
  });

  it("templates render values from a populated context", () => {
    expect(renderTemplate("Qty: {{qty}}", { qty: 4, patient: { age: 30 } })).toEqual({
      success: true,
      value: "Qty: 4",
    });
  });

  /**
   * An empty context always worked, because a proxy with no keys never
   * reached the failing trap. That is why the breakage was easy to miss.
   */
  it("an empty context worked before and still works", () => {
    expect(evaluateComputed("2 + 2", {})).toEqual({ success: true, value: 4 });
    expect(renderTemplate("static", {})).toEqual({ success: true, value: "static" });
  });
});
