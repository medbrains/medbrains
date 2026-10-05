import { describe, expect, it } from "vitest";
import { summariseSection } from "./section-summary";

describe("summariseSection", () => {
  it("reads a history as the paper sheet would", () => {
    expect(
      summariseSection("history", {
        hpi: "Cough for three weeks",
        past_medical_history: [{ condition: "Diabetes", status: "controlled" }],
        family_history: [{ relation: "Father", condition: "Hypertension" }],
        social_history: { smoking: { status: "former" } },
      }),
    ).toEqual([
      "HPI: Cough for three weeks",
      "Past medical: Diabetes (controlled)",
      "Family: Father: Hypertension",
      "Social: smoking former",
    ]);
  });

  it("lists abnormal systems with their detail, then the normal ones", () => {
    expect(
      summariseSection("ros", {
        respiratory: { abnormal: true, details: "Dry cough" },
        cardiovascular: { abnormal: false },
        gastrointestinal: { abnormal: false },
      }),
    ).toEqual(["Respiratory: Dry cough", "Normal: Cardiovascular, Gastrointestinal"]);
  });

  it("puts a finding at its side and site", () => {
    expect(
      summariseSection("examination", {
        general_appearance: "Comfortable",
        exam: {
          respiratory: "Bilateral wheeze",
          findings: [{ site: "knee", site_code: null, laterality: "left", finding: "Effusion" }],
        },
      }),
    ).toEqual([
      "General appearance: Comfortable",
      "Respiratory: Bilateral wheeze",
      "knee (left): Effusion",
    ]);
  });

  it("an empty record says nothing", () => {
    expect(summariseSection("history", { hpi: " ", past_medical_history: [] })).toEqual([]);
    expect(summariseSection("plan", { anything: 1 })).toEqual([]);
  });
});
