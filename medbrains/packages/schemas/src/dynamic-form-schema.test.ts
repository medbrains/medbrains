// @vitest-environment node

import type {
  FieldDataType,
  RequirementLevel,
  ResolvedField,
  ResolvedFormDefinition,
} from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { buildFormSchema } from "./dynamic-form";

function field(over: Partial<ResolvedField> & { field_code: string }): ResolvedField {
  return {
    label: over.field_code,
    description: null,
    data_type: "text" as FieldDataType,
    requirement_level: "optional" as RequirementLevel,
    default_value: null,
    placeholder: null,
    validation: null,
    ui_component: null,
    ui_width: null,
    ui_hint: null,
    icon: null,
    icon_position: null,
    condition: null,
    is_quick_mode: false,
    is_hidden: false,
    access_level: "edit",
    regulatory_clauses: [],
    data_source: null,
    actions: [],
    ...over,
  };
}

function form(...fields: ResolvedField[]): ResolvedFormDefinition {
  return {
    form_code: "f",
    form_name: "Form",
    version: 1,
    config: null,
    sections: [{ section_code: "s", title: "S", description: null, order: 1, fields }] as never,
  };
}

describe("buildFormSchema — requirement", () => {
  it("mandatory fields reject missing input, optional ones accept it", () => {
    const schema = buildFormSchema(
      form(
        field({ field_code: "required_note", requirement_level: "mandatory" }),
        field({ field_code: "optional_note", requirement_level: "optional" }),
      ),
    );
    expect(schema.safeParse({ required_note: "x", optional_note: "y" }).success).toBe(true);
    expect(schema.safeParse({ optional_note: "y" }).success).toBe(false);
    expect(schema.safeParse({ required_note: "x" }).success).toBe(true);
  });

  it("recommended behaves as optional, not as mandatory", () => {
    const schema = buildFormSchema(
      form(field({ field_code: "note", requirement_level: "recommended" })),
    );
    expect(schema.safeParse({}).success).toBe(true);
  });

  it("a conditional field is mandatory only while its condition holds", () => {
    const def = form(
      field({
        field_code: "lmp_date",
        requirement_level: "conditional",
        condition: { field: "gender", operator: "eq", value: "female" },
      }),
    );
    const applies = buildFormSchema(def, { formValues: { gender: "female" } });
    const doesNot = buildFormSchema(def, { formValues: { gender: "male" } });
    expect(applies.safeParse({}).success).toBe(false);
    expect(doesNot.safeParse({}).success).toBe(true);
  });

  /**
   * Without formValues there is nothing to evaluate against, and the code
   * leaves conditionMet true — so a conditional field stays mandatory. That is
   * the safe direction: it asks for the field rather than silently dropping it.
   */
  it("a conditional field stays mandatory when no formValues are supplied", () => {
    const schema = buildFormSchema(
      form(
        field({
          field_code: "lmp_date",
          requirement_level: "conditional",
          condition: { field: "gender", operator: "eq", value: "female" },
        }),
      ),
    );
    expect(schema.safeParse({}).success).toBe(false);
  });
});

describe("buildFormSchema — data types", () => {
  const parse = (data_type: FieldDataType, value: unknown, validation = null) =>
    buildFormSchema(
      form(field({ field_code: "v", data_type, requirement_level: "mandatory", validation })),
    ).safeParse({ v: value });

  it("number coerces numeric strings and rejects integers with a fraction", () => {
    expect(parse("number", "42")).toMatchObject({ success: true, data: { v: 42 } });
    expect(parse("number", 42.5).success).toBe(false);
    expect(parse("decimal", "42.5")).toMatchObject({ success: true, data: { v: 42.5 } });
  });

  it("boolean does not accept the strings a checkbox might send", () => {
    expect(parse("boolean", true).success).toBe(true);
    expect(parse("boolean", "true").success).toBe(false);
  });

  it("uuid_fk rejects a non-uuid, which is what makes an FK picker necessary", () => {
    expect(parse("uuid_fk", "550e8400-e29b-41d4-a716-446655440000").success).toBe(true);
    expect(parse("uuid_fk", "not-a-uuid").success).toBe(false);
  });

  it("date types are plain strings — the value is not validated as a date", () => {
    expect(parse("date", "2026-07-22").success).toBe(true);
    expect(parse("date", "not-a-date").success).toBe(true);
  });

  it("an unrecognised data type falls back to string", () => {
    expect(parse("totally_unknown" as FieldDataType, "x").success).toBe(true);
    expect(parse("totally_unknown" as FieldDataType, 5).success).toBe(false);
  });
});

describe("buildFormSchema — validation rules", () => {
  const withValidation = (data_type: FieldDataType, validation: unknown, value: unknown) =>
    buildFormSchema(
      form(
        field({
          field_code: "v",
          data_type,
          requirement_level: "mandatory",
          validation: validation as never,
        }),
      ),
    ).safeParse({ v: value });

  it("applies min_length, max_length and regex to strings", () => {
    expect(withValidation("text", { min_length: 3 }, "ab").success).toBe(false);
    expect(withValidation("text", { min_length: 3 }, "abc").success).toBe(true);
    expect(withValidation("text", { max_length: 3 }, "abcd").success).toBe(false);
    expect(withValidation("text", { regex: "^[A-Z]{2}$" }, "AB").success).toBe(true);
    expect(withValidation("text", { regex: "^[A-Z]{2}$" }, "ab").success).toBe(false);
  });

  it("applies min and max to numbers", () => {
    expect(withValidation("number", { min: 1, max: 10 }, 0).success).toBe(false);
    expect(withValidation("number", { min: 1, max: 10 }, 5).success).toBe(true);
    expect(withValidation("number", { min: 1, max: 10 }, 11).success).toBe(false);
  });

  it("an invalid regex is skipped rather than throwing", () => {
    expect(withValidation("text", { regex: "([unclosed" }, "anything").success).toBe(true);
  });

  it("select with options accepts only those options", () => {
    expect(withValidation("select", { options: ["a", "b"] }, "a").success).toBe(true);
    expect(withValidation("select", { options: ["a", "b"] }, "c").success).toBe(false);
    expect(withValidation("multiselect", { options: ["a", "b"] }, ["a"]).success).toBe(true);
    expect(withValidation("multiselect", { options: ["a", "b"] }, ["c"]).success).toBe(false);
  });

  /**
   * QUIRK: length rules only reach ZodString. A select with options builds a
   * ZodEnum, so min_length/max_length on it are silently ignored rather than
   * rejected as a misconfiguration.
   */
  it("QUIRK: length rules on an options-backed select are silently ignored", () => {
    expect(withValidation("select", { options: ["a", "bb"], min_length: 5 }, "a").success).toBe(
      true,
    );
  });
});

describe("buildFormSchema — access level and visibility", () => {
  it("hidden fields are dropped from the schema entirely", () => {
    const schema = buildFormSchema(
      form(
        field({ field_code: "visible" }),
        field({ field_code: "flagged_hidden", is_hidden: true, requirement_level: "mandatory" }),
        field({
          field_code: "access_hidden",
          access_level: "hidden",
          requirement_level: "mandatory",
        }),
      ),
    );
    // Mandatory, yet absent input parses — the fields are not in the shape.
    expect(schema.safeParse({}).success).toBe(true);
    expect(Object.keys(schema.shape)).toEqual(["visible"]);
  });

  it("view-only fields accept anything, even when marked mandatory", () => {
    const schema = buildFormSchema(
      form(
        field({
          field_code: "readonly",
          access_level: "view",
          data_type: "number",
          requirement_level: "mandatory",
        }),
      ),
    );
    expect(schema.safeParse({}).success).toBe(true);
    expect(schema.safeParse({ readonly: "anything at all" }).success).toBe(true);
  });

  it("quickMode keeps only quick-mode fields", () => {
    const def = form(
      field({ field_code: "quick", is_quick_mode: true }),
      field({ field_code: "full", is_quick_mode: false, requirement_level: "mandatory" }),
    );
    expect(Object.keys(buildFormSchema(def, { quickMode: true }).shape)).toEqual(["quick"]);
    expect(Object.keys(buildFormSchema(def).shape)).toEqual(["quick", "full"]);
  });
});

describe("buildFormSchema — optional numeric fields", () => {
  const optionalNumber = buildFormSchema(
    form(field({ field_code: "qty", data_type: "number", requirement_level: "optional" })),
  );

  it("accepts an omitted value as undefined", () => {
    expect(optionalNumber.safeParse({})).toMatchObject({ success: true, data: {} });
  });

  /**
   * QUIRK, and the one with teeth: a non-mandatory field is built as
   * `schema.optional().or(z.literal(""))`, but the base is `z.coerce.number()`
   * and coercion turns "" into 0 before the literal branch is ever tried. So a
   * cleared optional numeric input does not submit "absent" — it submits 0,
   * and the `.or(z.literal(""))` fallback is unreachable for numbers.
   *
   * Same family as `numberFromFormValue("") === 0` pinned in
   * form-primitives.test.ts. It matters wherever 0 and "not entered" differ —
   * a cleared dose, quantity or discount reads as an explicit zero.
   */
  it("QUIRK: a cleared optional number submits 0, not undefined", () => {
    expect(optionalNumber.safeParse({ qty: "" })).toMatchObject({
      success: true,
      data: { qty: 0 },
    });
  });

  it("still rejects non-numeric text", () => {
    expect(optionalNumber.safeParse({ qty: "abc" }).success).toBe(false);
  });

  it("an optional string field does accept the empty string", () => {
    const optionalText = buildFormSchema(
      form(field({ field_code: "note", requirement_level: "optional" })),
    );
    expect(optionalText.safeParse({ note: "" }).success).toBe(true);
  });
});
