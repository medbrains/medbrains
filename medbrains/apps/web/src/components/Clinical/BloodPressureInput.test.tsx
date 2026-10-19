import {
  parseBloodPressureText,
  refineBloodPressure,
  validateBloodPressure,
} from "@medbrains/schemas";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { render, screen, userEvent } from "@/test/test-utils";
import { BloodPressureInput, type BloodPressureValue } from "./BloodPressureInput";

describe("validateBloodPressure", () => {
  it("accepts a normal reading and a blank one", () => {
    expect(validateBloodPressure(120, 80)).toEqual({});
    expect(validateBloodPressure(undefined, null)).toEqual({});
  });

  it("wants both numbers or neither", () => {
    expect(validateBloodPressure(120, undefined).diastolic).toMatch(/diastolic \(low\) value too/);
    expect(validateBloodPressure(undefined, 80).systolic).toMatch(/systolic \(high\) value too/);
  });

  it("holds systolic to 50–300 and diastolic to 20–200, inclusive", () => {
    expect(validateBloodPressure(50, 20)).toEqual({});
    expect(validateBloodPressure(300, 200)).toEqual({});
    expect(validateBloodPressure(49, 30).systolic).toMatch(/50–300/);
    expect(validateBloodPressure(301, 80).systolic).toMatch(/50–300/);
    expect(validateBloodPressure(120, 19).diastolic).toMatch(/20–200/);
    expect(validateBloodPressure(250, 201).diastolic).toMatch(/20–200/);
    expect(validateBloodPressure(120.5, 80).systolic).toMatch(/whole number/);
  });

  it("refuses a diastolic at or above the systolic — the numbers were swapped", () => {
    expect(validateBloodPressure(80, 120).diastolic).toMatch(/lower than systolic/);
    expect(validateBloodPressure(90, 90).diastolic).toMatch(/lower than systolic/);
  });
});

describe("refineBloodPressure", () => {
  const schema = z
    .object({ sys: z.string(), dia: z.string() })
    .superRefine(refineBloodPressure("sys", "dia"));

  it("puts the error on the field that has to change", () => {
    const result = schema.safeParse({ sys: "80", dia: "120" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["dia"]);
    expect(schema.safeParse({ sys: "", dia: "" }).success).toBe(true);
  });
});

describe("parseBloodPressureText", () => {
  it("reads the old free-text form and nothing else", () => {
    expect(parseBloodPressureText(" 142 / 91 ")).toEqual({ systolic: 142, diastolic: 91 });
    expect(parseBloodPressureText("high")).toEqual({});
    expect(parseBloodPressureText(undefined)).toEqual({});
  });
});

function Harness({ initial = {} }: { initial?: BloodPressureValue }) {
  const [value, setValue] = useState<BloodPressureValue>(initial);
  return <BloodPressureInput value={value} onChange={setValue} />;
}

describe("BloodPressureInput", () => {
  it("is two labelled fields, systolic first, tab moves to diastolic", async () => {
    render(<Harness />);
    const systolic = screen.getByRole("textbox", { name: "Systolic (high)" });
    const diastolic = screen.getByRole("textbox", { name: "Diastolic (low)" });
    await userEvent.type(systolic, "120");
    await userEvent.tab();
    expect(diastolic).toHaveFocus();
    expect(screen.getByRole("group", { name: "Blood pressure" })).toBeInTheDocument();
  });

  it("does not clamp an out-of-range value — it says so", async () => {
    render(<Harness />);
    const systolic = screen.getByRole("textbox", { name: "Systolic (high)" });
    await userEvent.type(systolic, "30");
    await userEvent.tab();
    expect(systolic).toHaveValue("30");
    expect(screen.getByText(/50–300 mmHg/)).toBeInTheDocument();
  });

  it("flags a swapped reading once both fields are left", async () => {
    render(<Harness />);
    await userEvent.type(screen.getByRole("textbox", { name: "Systolic (high)" }), "80");
    await userEvent.tab();
    expect(screen.queryByText(/lower than systolic/)).not.toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox", { name: "Diastolic (low)" }), "120");
    await userEvent.tab();
    expect(screen.getByText(/lower than systolic/)).toBeInTheDocument();
  });
});
