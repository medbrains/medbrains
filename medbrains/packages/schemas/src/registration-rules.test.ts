import { describe, expect, it } from "vitest";
import fixtures from "./registration.fixtures.generated.json" with { type: "json" };
import { registrationCatalogue } from "./registration.generated.js";
import { registrationProblems } from "./registration-rules.js";

// Written by the Rust rules (crates/medbrains-clinical-core/src/registration/
// fixtures.rs): the problems the server and both native apps find in each
// draft. The web must find exactly the same, in the same order and words.
describe("registration rules agree with the Rust, case for case", () => {
  it.each(fixtures.map((f) => [f.name, f] as const))("%s", (_name, fixture) => {
    expect(registrationProblems(registrationCatalogue, fixture.draft)).toEqual(fixture.problems);
  });

  it("has fixtures to agree with", () => {
    expect(fixtures.length).toBeGreaterThan(20);
  });
});
