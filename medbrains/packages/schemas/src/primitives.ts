/**
 * Primitive Type Guards
 *
 * Foundation guards for basic and custom primitive types.
 * Business/domain guards in guards.ts build on top of these.
 *
 * Structure:
 * 1. Standard Primitives - string, number, boolean, etc.
 * 2. Custom Primitives - UUID, Email, Phone, Date, etc.
 * 3. Composite Helpers - nullable, array, record
 */

// ══════════════════════════════════════════════════════════════════════════════
// 1. STANDARD PRIMITIVES
// ══════════════════════════════════════════════════════════════════════════════

/** Check if value is an object (not null, not array) */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Check if value is a string */
export function isString(value: unknown): value is string {
  return typeof value === "string";
}

/** Check if value is a non-empty string */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/** Check if value is a number (not NaN) */
export function isNumber(value: unknown): value is number {
  return typeof value === "number" && !Number.isNaN(value);
}

/** Check if value is a positive number */
export function isPositiveNumber(value: unknown): value is number {
  return isNumber(value) && value > 0;
}

/** Check if value is a non-negative number */
export function isNonNegativeNumber(value: unknown): value is number {
  return isNumber(value) && value >= 0;
}

/** Check if value is an integer */
export function isInteger(value: unknown): value is number {
  return isNumber(value) && Number.isInteger(value);
}

/** Check if value is a positive integer */
export function isPositiveInteger(value: unknown): value is number {
  return isInteger(value) && value > 0;
}

/** Check if value is a boolean */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

/** Check if value is null */
export function isNull(value: unknown): value is null {
  return value === null;
}

/** Check if value is undefined */
export function isUndefined(value: unknown): value is undefined {
  return value === undefined;
}

/** Check if value is null or undefined */
export function isNullish(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. CUSTOM PRIMITIVES (Domain-specific)
// ══════════════════════════════════════════════════════════════════════════════

/** UUID v4 format */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Check if value is a valid UUID */
export function isUUID(value: unknown): value is string {
  return isString(value) && UUID_REGEX.test(value);
}

/** Email format (basic validation) */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Check if value is a valid email */
export function isEmail(value: unknown): value is string {
  return isString(value) && EMAIL_REGEX.test(value);
}

/** Indian phone number format (10 digits, optionally with +91) */
const PHONE_REGEX = /^(\+91)?[6-9]\d{9}$/;

/** Check if value is a valid Indian phone number */
export function isIndianPhone(value: unknown): value is string {
  if (!isString(value)) return false;
  const cleaned = value.replace(/[\s-]/g, "");
  return PHONE_REGEX.test(cleaned);
}

/** Generic phone (at least 10 digits) */
export function isPhone(value: unknown): value is string {
  if (!isString(value)) return false;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

/** ISO date string format (YYYY-MM-DD) */
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Check if value is a valid ISO date string */
export function isISODate(value: unknown): value is string {
  if (!isString(value) || !ISO_DATE_REGEX.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;
  // Ensure the parsed date matches input (catches invalid dates like Feb 30)
  const [year, month, day] = value.split("-").map(Number);
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
}

/** ISO datetime string format */
const ISO_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

/** Check if value is a valid ISO datetime string */
export function isISODateTime(value: unknown): value is string {
  if (!isString(value) || !ISO_DATETIME_REGEX.test(value)) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

/** Check if value is a valid date of birth (not in future, not too old) */
export function isDateOfBirth(value: unknown): value is string {
  if (!isISODate(value)) return false;
  const dob = new Date(value);
  const now = new Date();
  const minDate = new Date();
  minDate.setFullYear(minDate.getFullYear() - 150); // Max 150 years old
  return dob <= now && dob >= minDate;
}

/** Indian pincode (6 digits) */
const PINCODE_REGEX = /^[1-9]\d{5}$/;

/** Check if value is a valid Indian pincode */
export function isPincode(value: unknown): value is string {
  return isString(value) && PINCODE_REGEX.test(value);
}

/** UHID format (alphanumeric, typically hospital-specific prefix + number) */
export function isUHID(value: unknown): value is string {
  return isNonEmptyString(value) && value.length <= 20;
}

/** Aadhaar number (12 digits, basic validation) */
const AADHAAR_REGEX = /^[2-9]\d{11}$/;

/** Check if value is a valid Aadhaar number format */
export function isAadhaar(value: unknown): value is string {
  if (!isString(value)) return false;
  const cleaned = value.replace(/\s/g, "");
  return AADHAAR_REGEX.test(cleaned);
}

/** ABHA ID (Ayushman Bharat Health Account - 14 digit or 14-char alphanumeric) */
export function isABHA(value: unknown): value is string {
  if (!isString(value)) return false;
  const cleaned = value.replace(/[\s-]/g, "");
  return cleaned.length === 14;
}

/** Medical Registration Number (MCI/SMC format) */
export function isMedicalRegNumber(value: unknown): value is string {
  return isNonEmptyString(value) && value.length <= 30;
}

/** ICD-10 code format */
const ICD10_REGEX = /^[A-Z]\d{2}(\.\d{1,2})?$/i;

/** Check if value is a valid ICD-10 code */
export function isICD10Code(value: unknown): value is string {
  return isString(value) && ICD10_REGEX.test(value);
}

/** LOINC code format */
const LOINC_REGEX = /^\d{1,5}-\d$/;

/** Check if value is a valid LOINC code */
export function isLOINCCode(value: unknown): value is string {
  return isString(value) && LOINC_REGEX.test(value);
}

/** GST number format (15 characters) */
const GST_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}$/;

/** Check if value is a valid GSTIN */
export function isGSTIN(value: unknown): value is string {
  return isString(value) && GST_REGEX.test(value);
}

/** PAN number format (10 characters) */
const PAN_REGEX = /^[A-Z]{5}\d{4}[A-Z]$/;

/** Check if value is a valid PAN number */
export function isPAN(value: unknown): value is string {
  return isString(value) && PAN_REGEX.test(value);
}

/** Decimal string (for monetary values) */
const DECIMAL_REGEX = /^-?\d+(\.\d{1,4})?$/;

/** Check if value is a valid decimal string */
export function isDecimalString(value: unknown): value is string {
  return isString(value) && DECIMAL_REGEX.test(value);
}

/** Non-negative decimal string (for prices, amounts) */
export function isPositiveDecimalString(value: unknown): value is string {
  if (!isDecimalString(value)) return false;
  return Number.parseFloat(value) >= 0;
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. OBJECT VALIDATION HELPERS
// ══════════════════════════════════════════════════════════════════════════════

/** Check if object has all required keys */
export function hasKeys<T extends Record<string, unknown>>(
  v: unknown,
  keys: readonly (keyof T)[],
): v is T {
  if (!isObject(v)) return false;
  for (const key of keys) {
    if (!(key as string in v)) return false;
  }
  return true;
}

/** Check if value is an array */
export function isArray(v: unknown): v is unknown[] {
  return Array.isArray(v);
}

/** Check if array and all items pass guard */
export function isArrayOfType<T>(v: unknown, guard: (item: unknown) => item is T): v is T[] {
  return isArray(v) && v.every(guard);
}

/** Check optional string field - undefined, null, or string */
export function optStr(v: Record<string, unknown>, key: string): boolean {
  const val = v[key];
  return val === undefined || val === null || isString(val);
}

/** Check optional number field - undefined, null, or number */
export function optNum(v: Record<string, unknown>, key: string): boolean {
  const val = v[key];
  return val === undefined || val === null || isNumber(val);
}

/** Check optional integer field */
export function optInt(v: Record<string, unknown>, key: string): boolean {
  const val = v[key];
  return val === undefined || val === null || isInteger(val);
}

/** Check optional UUID field */
export function optUUID(v: Record<string, unknown>, key: string): boolean {
  const val = v[key];
  return val === undefined || val === null || isUUID(val);
}

/** Check optional object field */
export function optObj(v: Record<string, unknown>, key: string): boolean {
  const val = v[key];
  return val === undefined || val === null || isObject(val);
}

/** Check optional boolean field */
export function optBool(v: Record<string, unknown>, key: string): boolean {
  const val = v[key];
  return val === undefined || val === null || isBoolean(val);
}

/** Creates enum guard */
export function isOneOf<T extends string | number>(
  allowed: readonly T[],
): (v: unknown) => v is T {
  const set = new Set<string | number>(allowed);
  return (v): v is T => (typeof v === "string" || typeof v === "number") && set.has(v);
}

/** Check optional enum field */
export function optEnum<T extends string | number>(
  v: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
): boolean {
  const val = v[key];
  if (val === undefined || val === null) return true;
  return isOneOf(allowed)(val);
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. COMPOSITE HELPERS
// ══════════════════════════════════════════════════════════════════════════════

/** Create a guard for nullable values */
export function isNullable<T>(
  guard: (v: unknown) => v is T,
): (v: unknown) => v is T | null {
  return (value: unknown): value is T | null => value === null || guard(value);
}

/** Create a guard for optional values (undefined allowed) */
export function isOptional<T>(
  guard: (v: unknown) => v is T,
): (v: unknown) => v is T | undefined {
  return (value: unknown): value is T | undefined =>
    value === undefined || guard(value);
}

/** Create a guard for arrays of a specific type */
export function isArrayOf<T>(
  guard: (v: unknown) => v is T,
): (v: unknown) => v is T[] {
  return (value: unknown): value is T[] => {
    return Array.isArray(value) && value.every(guard);
  };
}

/** Create a guard for record/dictionary types */
export function isRecordOf<T>(
  valueGuard: (v: unknown) => v is T,
): (v: unknown) => v is Record<string, T> {
  return (value: unknown): value is Record<string, T> => {
    if (!isObject(value)) return false;
    return Object.values(value).every(valueGuard);
  };
}

/** Create a union guard (OR) */
export function isUnion<A, B>(
  guardA: (v: unknown) => v is A,
  guardB: (v: unknown) => v is B,
): (v: unknown) => v is A | B {
  return (value: unknown): value is A | B => guardA(value) || guardB(value);
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. ASSERTION HELPERS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Assertion error with context
 */
export class TypeAssertionError extends TypeError {
  constructor(
    public readonly expectedType: string,
    public readonly actualValue: unknown,
    public readonly context?: string,
  ) {
    const ctx = context ? ` at ${context}` : "";
    const actual = actualValue === null ? "null" : typeof actualValue;
    super(`Expected ${expectedType}${ctx}, got ${actual}`);
    this.name = "TypeAssertionError";
  }
}

/**
 * Create an assertion function from a type guard.
 * Uses TypeScript's `asserts` for proper type narrowing.
 */
export function createAssert<T>(
  guard: (value: unknown) => value is T,
  typeName: string,
): (value: unknown, context?: string) => asserts value is T {
  return (value: unknown, context?: string): asserts value is T => {
    if (!guard(value)) {
      throw new TypeAssertionError(typeName, value, context);
    }
  };
}

// Pre-built assertions for common primitives
export const assertString = createAssert(isString, "string");
export const assertNumber = createAssert(isNumber, "number");
export const assertBoolean = createAssert(isBoolean, "boolean");
export const assertObject = createAssert(isObject, "object");
export const assertUUID = createAssert(isUUID, "UUID");
export const assertEmail = createAssert(isEmail, "email");
export const assertPhone = createAssert(isPhone, "phone");
export const assertISODate = createAssert(isISODate, "ISO date");
export const assertISODateTime = createAssert(isISODateTime, "ISO datetime");
