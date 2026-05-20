import { z } from "zod";

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export const formNumberValue = z.union([z.number(), z.string()]);
export type FormNumberValue = z.infer<typeof formNumberValue>;

export const requiredTrimmed = (message: string, max = 255) =>
  z
    .string()
    .max(max, `Must be at most ${max} characters`)
    .refine((value) => value.trim().length > 0, message);

export function hasTrimmedValue(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

export const optionalNonNegativeIntegerString = z
  .string()
  .optional()
  .refine((value) => {
    if (!value || value.trim().length === 0) return true;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 0;
  }, "Enter a valid whole number");

export const optionalIsoDateString = z.string().refine((value) => {
  const trimmed = value.trim();
  return trimmed.length === 0 || isoDatePattern.test(trimmed);
}, "Enter a valid date in YYYY-MM-DD format");

export const optionalNonNegativeIntegerText = z.string().refine((value) => {
  const trimmed = value.trim();
  if (trimmed.length === 0) return true;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed >= 0;
}, "Enter a valid whole number");

export const optionalNumericText = (message: string, min?: number, max?: number) =>
  z.string().refine((value) => {
    const trimmed = value.trim();
    if (trimmed.length === 0) return true;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return false;
    if (min !== undefined && parsed < min) return false;
    return !(max !== undefined && parsed > max);
  }, message);

export const optionalNumericFormValue = (message: string, min?: number, max?: number) =>
  formNumberValue.refine((value) => {
    if (typeof value === "string" && value.trim().length === 0) return true;
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(parsed)) return false;
    if (min !== undefined && parsed < min) return false;
    return !(max !== undefined && parsed > max);
  }, message);

export const nonNegativeNumber = (message: string) =>
  formNumberValue.refine((value) => {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) && parsed >= 0;
  }, message);

export const positiveNumber = (message: string) =>
  formNumberValue.refine((value) => {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) && parsed > 0;
  }, message);

export const nonNegativeInteger = (message: string) =>
  formNumberValue.refine((value) => {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isInteger(parsed) && parsed >= 0;
  }, message);

export const optionalNonNegativeIntegerNumber = (message: string) =>
  formNumberValue.refine((value) => {
    if (typeof value === "string" && value.trim().length === 0) return true;
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isInteger(parsed) && parsed >= 0;
  }, message);

export const positiveInteger = (message: string) =>
  formNumberValue.refine((value) => {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isInteger(parsed) && parsed > 0;
  }, message);

export function optionalTextFromFormValue(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function numberFromFormValue(value: FormNumberValue, fallback: number): number {
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function integerFromFormValue(value: FormNumberValue, fallback: number): number {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

export function optionalNumberFromFormValue(value: FormNumberValue): number | undefined {
  if (typeof value === "string" && value.trim().length === 0) return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function optionalIntegerFromFormValue(value: FormNumberValue): number | undefined {
  if (typeof value === "string" && value.trim().length === 0) return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}
