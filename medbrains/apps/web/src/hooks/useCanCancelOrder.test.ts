import { describe, expect, it } from "vitest";
import { canCancelOrder } from "./useCanCancelOrder";

const ME = "user-me";
const OTHER = "user-other";

describe("canCancelOrder", () => {
  it("lets the ordering doctor cancel their own order", () => {
    expect(canCancelOrder({ userId: ME, holdsRoute: true, isTeam: false }, ME)).toBe(true);
  });

  it("hides cancel on another doctor's order", () => {
    expect(canCancelOrder({ userId: ME, holdsRoute: true, isTeam: false }, OTHER)).toBe(false);
  });

  it("lets the department team cancel anyone's order", () => {
    expect(canCancelOrder({ userId: ME, holdsRoute: true, isTeam: true }, OTHER)).toBe(true);
  });

  it("never offers cancel without the route permission", () => {
    expect(canCancelOrder({ userId: ME, holdsRoute: false, isTeam: true }, ME)).toBe(false);
  });

  it("does not match an order when the signed-in user is unknown", () => {
    expect(canCancelOrder({ userId: undefined, holdsRoute: true, isTeam: false }, OTHER)).toBe(
      false,
    );
  });
});
