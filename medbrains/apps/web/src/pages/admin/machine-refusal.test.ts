import { describe, expect, it } from "vitest";
import { isRefusedAfterWrongCodes } from "./machine-refusal";

describe("isRefusedAfterWrongCodes", () => {
  it("stops offering Approve only once the server refused the request", () => {
    expect(
      isRefusedAfterWrongCodes(
        "Three wrong codes. This request was refused; ask the person at the machine to start again.",
      ),
    ).toBe(true);
    expect(isRefusedAfterWrongCodes("That is not the code on the machine.")).toBe(false);
  });
});
