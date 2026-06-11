/**
 * User journey test case catalog.
 *
 * This file intentionally registers each catalog entry as a test case so the
 * journey corpus is visible in Playwright/TCMS before every case is fully
 * automated end to end.
 */

import { expect, test } from "@playwright/test";
import {
  JOURNEY_CASES,
  REQUIRED_ACTOR_GROUPS,
  journeyCasesByActorGroup,
  type UserJourneyCase,
} from "../journeys/catalog";

const MIN_CASES_BY_GROUP: Record<UserJourneyCase["actorGroup"], number> = {
  patient_public: 10,
  hospital_user: 20,
  external_user: 10,
  external_system: 10,
};

test.describe("User journey test case catalog", () => {
  test("catalog breadth covers all actor perspectives", () => {
    expect(JOURNEY_CASES.length).toBeGreaterThanOrEqual(50);

    for (const actorGroup of REQUIRED_ACTOR_GROUPS) {
      const cases = journeyCasesByActorGroup(actorGroup);
      expect(
        cases.length,
        `${actorGroup} should have enough journey cases`,
      ).toBeGreaterThanOrEqual(MIN_CASES_BY_GROUP[actorGroup]);
    }

    expect(
      JOURNEY_CASES.some((journey) => journey.timeScope !== "same_day"),
      "catalog should include multi-shift, multi-day, or longitudinal journeys",
    ).toBe(true);
  });

  test("priority journeys carry regulatory anchors and executable assertions", () => {
    for (const journey of JOURNEY_CASES.filter((item) => item.priority !== "P3")) {
      expect(journey.regulatoryAnchors.length, `${journey.id} regulatory anchors`).toBeGreaterThan(0);
      expect(journey.assertions.length, `${journey.id} assertions`).toBeGreaterThanOrEqual(2);
      expect(journey.actors.length, `${journey.id} actors`).toBeGreaterThan(0);
      expect(journey.modules.length, `${journey.id} modules`).toBeGreaterThan(0);
    }
  });

  test("automation backlog is explicit and not hidden", () => {
    const automated = JOURNEY_CASES.filter((journey) => journey.automationStatus === "automated");
    const candidates = JOURNEY_CASES.filter((journey) => journey.automationStatus === "candidate");
    const backlog = JOURNEY_CASES.filter((journey) => journey.automationStatus === "backlog");

    expect(automated.length).toBeGreaterThanOrEqual(8);
    expect(candidates.length).toBeGreaterThan(0);
    expect(backlog.length).toBeGreaterThan(0);
    expect(
      JOURNEY_CASES.every((journey) =>
        journey.automationStatus === "automated" ? Boolean(journey.existingSpec) : true,
      ),
      "automated catalog cases must name their backing spec",
    ).toBe(true);
  });

  for (const journey of JOURNEY_CASES) {
    test(`${journey.id} ${journey.title}`, () => {
      test.info().annotations.push({
        type: "tcms",
        description: `${journey.actorGroup}::${journey.priority}::${journey.title}`,
      });

      expect(journey.id).toMatch(/^JNY-(PAT|HOS|EXTU|EXTS)-\d{3}$/);
      expect(journey.title.trim().length).toBeGreaterThan(8);
      expect(journey.entryPoint.trim().length).toBeGreaterThan(0);
      expect(journey.exitPoint.trim().length).toBeGreaterThan(0);
      expect(journey.assertions.join(" ")).not.toContain("TODO");
    });
  }
});
