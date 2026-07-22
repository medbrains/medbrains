// @vitest-environment node

import type { FieldCondition } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { evaluateCondition } from "./dynamic-form";

/**
 * `evaluateCondition` decides whether a dynamic form field is shown or required.
 * A wrong answer does not throw — it silently hides a field a clinician was
 * meant to fill, or reveals one that should have stayed hidden, so the
 * asymmetries below are pinned deliberately rather than assumed.
 */
describe("evaluateCondition — equality", () => {
  it("eq matches by strict identity", () => {
    const c: FieldCondition = { field: "gender", operator: "eq", value: "male" };
    expect(evaluateCondition(c, { gender: "male" })).toBe(true);
    expect(evaluateCondition(c, { gender: "female" })).toBe(false);
  });

  it("EDGE: eq is strict, so 1 does not equal '1'", () => {
    const c: FieldCondition = { field: "parity", operator: "eq", value: 1 };
    expect(evaluateCondition(c, { parity: 1 })).toBe(true);
    expect(evaluateCondition(c, { parity: "1" })).toBe(false);
  });

  it("neq is the negation, and a missing field is not equal to a value", () => {
    const c: FieldCondition = { field: "gender", operator: "neq", value: "male" };
    expect(evaluateCondition(c, { gender: "female" })).toBe(true);
    expect(evaluateCondition(c, {})).toBe(true);
  });
});

describe("evaluateCondition — membership", () => {
  const values = ["diabetes", "hypertension"];

  it("in and not_in are complements when values is supplied", () => {
    const inC: FieldCondition = { field: "dx", operator: "in", values };
    const notIn: FieldCondition = { field: "dx", operator: "not_in", values };
    expect(evaluateCondition(inC, { dx: "diabetes" })).toBe(true);
    expect(evaluateCondition(notIn, { dx: "diabetes" })).toBe(false);
    expect(evaluateCondition(inC, { dx: "asthma" })).toBe(false);
    expect(evaluateCondition(notIn, { dx: "asthma" })).toBe(true);
  });

  /**
   * QUIRK, and an asymmetry worth knowing: with `values` absent, `in` denies
   * and `not_in` allows. A malformed condition therefore fails closed when it
   * gates on inclusion and fails open when it gates on exclusion.
   */
  it("QUIRK: a malformed condition denies for in but allows for not_in", () => {
    expect(evaluateCondition({ field: "dx", operator: "in" }, { dx: "x" })).toBe(false);
    expect(evaluateCondition({ field: "dx", operator: "not_in" }, { dx: "x" })).toBe(true);
  });
});

describe("evaluateCondition — contains", () => {
  it("works on strings and arrays", () => {
    const c: FieldCondition = { field: "notes", operator: "contains", value: "fever" };
    expect(evaluateCondition(c, { notes: "patient reports fever since monday" })).toBe(true);
    expect(evaluateCondition(c, { notes: "no complaints" })).toBe(false);

    const arr: FieldCondition = { field: "allergies", operator: "contains", value: "penicillin" };
    expect(evaluateCondition(arr, { allergies: ["penicillin", "sulfa"] })).toBe(true);
    expect(evaluateCondition(arr, { allergies: ["sulfa"] })).toBe(false);
  });

  it("returns false when the value is not a string or array", () => {
    const c: FieldCondition = { field: "count", operator: "contains", value: "1" };
    expect(evaluateCondition(c, { count: 12 })).toBe(false);
  });
});

describe("evaluateCondition — emptiness", () => {
  const empty: FieldCondition = { field: "f", operator: "is_empty" };
  const notEmpty: FieldCondition = { field: "f", operator: "is_not_empty" };

  it("treats null, undefined, empty string and empty array as empty", () => {
    for (const v of [null, undefined, "", []]) {
      expect(evaluateCondition(empty, { f: v })).toBe(true);
      expect(evaluateCondition(notEmpty, { f: v })).toBe(false);
    }
  });

  it("a missing key is empty", () => {
    expect(evaluateCondition(empty, {})).toBe(true);
    expect(evaluateCondition(notEmpty, {})).toBe(false);
  });

  /**
   * Zero and false are values a clinician entered, not absences — dropping
   * them would treat a recorded 0 as an unanswered field.
   */
  it("EDGE: zero and false are present, not empty", () => {
    expect(evaluateCondition(empty, { f: 0 })).toBe(false);
    expect(evaluateCondition(notEmpty, { f: 0 })).toBe(true);
    expect(evaluateCondition(empty, { f: false })).toBe(false);
    expect(evaluateCondition(notEmpty, { f: false })).toBe(true);
  });
});

describe("evaluateCondition — numeric comparison", () => {
  it("compares numbers", () => {
    const gt: FieldCondition = { field: "age", operator: "gt", value: 18 };
    expect(evaluateCondition(gt, { age: 19 })).toBe(true);
    expect(evaluateCondition(gt, { age: 18 })).toBe(false);

    const gte: FieldCondition = { field: "age", operator: "gte", value: 18 };
    expect(evaluateCondition(gte, { age: 18 })).toBe(true);

    const lt: FieldCondition = { field: "age", operator: "lt", value: 18 };
    expect(evaluateCondition(lt, { age: 17 })).toBe(true);

    const lte: FieldCondition = { field: "age", operator: "lte", value: 18 };
    expect(evaluateCondition(lte, { age: 18 })).toBe(true);
  });

  /**
   * QUIRK worth flagging: the comparison operators require BOTH sides to be
   * real numbers, so a numeric string denies. Text and number inputs can hand
   * back "20", and a rule such as `age gt 18` then evaluates false and hides
   * the field. Callers must coerce before evaluating — see
   * `numberFromFormValue` in form-primitives.
   */
  it("QUIRK: a numeric string never satisfies gt/lt/gte/lte", () => {
    const gt: FieldCondition = { field: "age", operator: "gt", value: 18 };
    expect(evaluateCondition(gt, { age: "20" })).toBe(false);

    const lte: FieldCondition = { field: "age", operator: "lte", value: 18 };
    expect(evaluateCondition(lte, { age: "5" })).toBe(false);
  });

  it("a missing or non-numeric field denies rather than throwing", () => {
    const gt: FieldCondition = { field: "age", operator: "gt", value: 18 };
    expect(evaluateCondition(gt, {})).toBe(false);
    expect(evaluateCondition(gt, { age: null })).toBe(false);
  });
});

describe("evaluateCondition — composites", () => {
  const isMale: FieldCondition = { field: "gender", operator: "eq", value: "male" };
  const isAdult: FieldCondition = { field: "age", operator: "gte", value: 18 };

  it("all requires every branch, any requires one", () => {
    const all: FieldCondition = { field: "", operator: "eq", all: [isMale, isAdult] };
    const any: FieldCondition = { field: "", operator: "eq", any: [isMale, isAdult] };
    const values = { gender: "male", age: 20 };

    expect(evaluateCondition(all, values)).toBe(true);
    expect(evaluateCondition(all, { gender: "female", age: 20 })).toBe(false);
    expect(evaluateCondition(any, { gender: "female", age: 20 })).toBe(true);
    expect(evaluateCondition(any, { gender: "female", age: 5 })).toBe(false);
  });

  it("nests", () => {
    const nested: FieldCondition = {
      field: "",
      operator: "eq",
      all: [
        isAdult,
        {
          field: "",
          operator: "eq",
          any: [isMale, { field: "pregnant", operator: "eq", value: true }],
        },
      ],
    };
    expect(evaluateCondition(nested, { age: 30, gender: "female", pregnant: true })).toBe(true);
    expect(evaluateCondition(nested, { age: 30, gender: "female", pregnant: false })).toBe(false);
    expect(evaluateCondition(nested, { age: 10, gender: "male" })).toBe(false);
  });

  /**
   * QUIRK: empty composites inherit JS every/some semantics, so an empty
   * `all` allows and an empty `any` denies. A condition built from a filtered
   * list that happened to come out empty flips meaning depending on which
   * composite it used.
   */
  it("QUIRK: an empty all allows, an empty any denies", () => {
    expect(evaluateCondition({ field: "", operator: "eq", all: [] }, {})).toBe(true);
    expect(evaluateCondition({ field: "", operator: "eq", any: [] }, {})).toBe(false);
  });

  it("all wins when both all and any are present", () => {
    const both: FieldCondition = {
      field: "",
      operator: "eq",
      all: [isMale],
      any: [{ field: "gender", operator: "eq", value: "female" }],
    };
    expect(evaluateCondition(both, { gender: "male" })).toBe(true);
    expect(evaluateCondition(both, { gender: "female" })).toBe(false);
  });
});

describe("evaluateCondition — tenant context", () => {
  const c: FieldCondition = { field: "_tenant.country", operator: "eq", value: "IN" };

  it("reads _tenant.* from the tenant context, not the form values", () => {
    expect(evaluateCondition(c, {}, { country: "IN" })).toBe(true);
    expect(evaluateCondition(c, {}, { country: "US" })).toBe(false);
    // A form field literally named "_tenant.country" must not satisfy it.
    expect(evaluateCondition(c, { "_tenant.country": "IN" }, { country: "US" })).toBe(false);
  });

  it("denies when no tenant context is supplied", () => {
    expect(evaluateCondition(c, {})).toBe(false);
  });
});
