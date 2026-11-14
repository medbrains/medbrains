import { describe, expect, it } from "vitest";
import { examSchema, toForm } from "./exam-form";

const base = { ...toForm(null, "p1") };

describe("eye exam axis and cylinder", () => {
  it("flags an axis entered without a cylinder before the server does", () => {
    const r = examSchema.safeParse({ ...base, axis_od: 90 });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["axis_od"]);
  });

  it("flags a cylinder entered without an axis", () => {
    const r = examSchema.safeParse({ ...base, cylinder_os: -1.25 });
    expect(r.error?.issues[0]?.path).toEqual(["axis_os"]);
  });

  it("accepts a cylinder with its axis, and neither", () => {
    expect(examSchema.safeParse({ ...base, cylinder_od: -0.5, axis_od: 180 }).success).toBe(true);
    expect(examSchema.safeParse(base).success).toBe(true);
  });
});
