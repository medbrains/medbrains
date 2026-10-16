import type { FormDefinition } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { buildAnswersSchema, cleanAnswers, emptyAnswers } from "./schema";

const definition: FormDefinition = {
  sections: [
    {
      title: "Main",
      fields: [
        { key: "witness", label: "Witness", kind: "text", required: true, options: [] },
        { key: "side", label: "Side", kind: "radio", required: false, options: ["Left", "Right"] },
        { key: "units", label: "Units", kind: "number", required: false, options: [] },
        {
          key: "risks",
          label: "Risks",
          kind: "multiselect",
          required: true,
          options: ["Bleeding", "Infection"],
        },
      ],
    },
  ],
};

describe("dynamic form schema", () => {
  it("names each required question left blank", () => {
    const result = buildAnswersSchema(definition).safeParse(emptyAnswers(definition));
    expect(result.success).toBe(false);
    const messages = result.error?.issues.map((i) => i.message) ?? [];
    expect(messages).toContain("Witness is required");
    expect(messages).toContain("Risks is required");
  });

  it("refuses a choice that is not offered", () => {
    const values = { ...emptyAnswers(definition), witness: "A", risks: ["Bleeding"], side: "Up" };
    expect(buildAnswersSchema(definition).safeParse(values).success).toBe(false);
  });

  it("sends only what was answered", () => {
    const values = { ...emptyAnswers(definition), witness: " Ravi ", risks: ["Infection"] };
    expect(buildAnswersSchema(definition).safeParse(values).success).toBe(true);
    expect(cleanAnswers(values)).toEqual({ witness: "Ravi", risks: ["Infection"] });
  });
});
