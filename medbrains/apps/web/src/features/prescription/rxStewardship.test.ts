import type { LiveStewardshipRequest } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { stewardshipCovers } from "./rxStewardship";

const request = (antibiotic_name: string): LiveStewardshipRequest => ({
  id: "r1",
  antibiotic_name,
  request_status: "pending",
  auto_stop_date: null,
});

const meronem = { name: "Meronem 1g Inj", salt: "Meropenem" };

describe("stewardship coverage", () => {
  it("a request naming the ingredient covers any brand of it", () => {
    expect(stewardshipCovers(meronem, [request("Meropenem 1 g IV q8h")])).toBe(true);
    expect(stewardshipCovers(meronem, [request("meronem 1g inj")])).toBe(true);
  });

  it("a request for another antibiotic does not", () => {
    expect(stewardshipCovers(meronem, [request("Colistin")])).toBe(false);
    expect(stewardshipCovers(meronem, [])).toBe(false);
  });
});
