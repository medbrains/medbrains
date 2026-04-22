import { describe, it, expect } from "vitest";
import {
  // Standard primitives
  isObject,
  isString,
  isNonEmptyString,
  isNumber,
  isPositiveNumber,
  isNonNegativeNumber,
  isInteger,
  isPositiveInteger,
  isBoolean,
  isNull,
  isUndefined,
  isNullish,
  // Custom primitives
  isUUID,
  isEmail,
  isIndianPhone,
  isPhone,
  isISODate,
  isISODateTime,
  isDateOfBirth,
  isPincode,
  isUHID,
  isAadhaar,
  isABHA,
  isMedicalRegNumber,
  isICD10Code,
  isLOINCCode,
  isGSTIN,
  isPAN,
  isDecimalString,
  isPositiveDecimalString,
  // Object helpers
  hasKeys,
  isArray,
  isArrayOfType,
  optStr,
  optNum,
  optInt,
  optUUID,
  optObj,
  optBool,
  isOneOf,
  optEnum,
  // Composite helpers
  isNullable,
  isOptional,
  isArrayOf,
  isRecordOf,
  isUnion,
  // Assertions
  TypeAssertionError,
  createAssert,
  assertString,
  assertNumber,
  assertBoolean,
  assertUUID,
} from "./primitives.js";

// ══════════════════════════════════════════════════════════════════════════════
// STANDARD PRIMITIVES
// ══════════════════════════════════════════════════════════════════════════════

describe("isObject", () => {
  it("returns true for plain objects", () => {
    expect(isObject({})).toBe(true);
    expect(isObject({ a: 1 })).toBe(true);
    expect(isObject({ nested: { obj: true } })).toBe(true);
  });

  it("returns false for arrays", () => {
    expect(isObject([])).toBe(false);
    expect(isObject([1, 2, 3])).toBe(false);
  });

  it("returns false for null", () => {
    expect(isObject(null)).toBe(false);
  });

  it("returns false for primitives", () => {
    expect(isObject("string")).toBe(false);
    expect(isObject(123)).toBe(false);
    expect(isObject(true)).toBe(false);
    expect(isObject(undefined)).toBe(false);
  });
});

describe("isString", () => {
  it("returns true for strings", () => {
    expect(isString("")).toBe(true);
    expect(isString("hello")).toBe(true);
    expect(isString("123")).toBe(true);
  });

  it("returns false for non-strings", () => {
    expect(isString(123)).toBe(false);
    expect(isString(null)).toBe(false);
    expect(isString(undefined)).toBe(false);
    expect(isString({})).toBe(false);
  });
});

describe("isNonEmptyString", () => {
  it("returns true for non-empty strings", () => {
    expect(isNonEmptyString("hello")).toBe(true);
    expect(isNonEmptyString(" ")).toBe(true);
  });

  it("returns false for empty strings", () => {
    expect(isNonEmptyString("")).toBe(false);
  });

  it("returns false for non-strings", () => {
    expect(isNonEmptyString(123)).toBe(false);
    expect(isNonEmptyString(null)).toBe(false);
  });
});

describe("isNumber", () => {
  it("returns true for valid numbers", () => {
    expect(isNumber(0)).toBe(true);
    expect(isNumber(123)).toBe(true);
    expect(isNumber(-456)).toBe(true);
    expect(isNumber(3.14)).toBe(true);
    expect(isNumber(Infinity)).toBe(true);
  });

  it("returns false for NaN", () => {
    expect(isNumber(NaN)).toBe(false);
  });

  it("returns false for non-numbers", () => {
    expect(isNumber("123")).toBe(false);
    expect(isNumber(null)).toBe(false);
  });
});

describe("isPositiveNumber", () => {
  it("returns true for positive numbers", () => {
    expect(isPositiveNumber(1)).toBe(true);
    expect(isPositiveNumber(0.001)).toBe(true);
    expect(isPositiveNumber(Infinity)).toBe(true);
  });

  it("returns false for zero and negative", () => {
    expect(isPositiveNumber(0)).toBe(false);
    expect(isPositiveNumber(-1)).toBe(false);
  });
});

describe("isNonNegativeNumber", () => {
  it("returns true for zero and positive numbers", () => {
    expect(isNonNegativeNumber(0)).toBe(true);
    expect(isNonNegativeNumber(1)).toBe(true);
  });

  it("returns false for negative numbers", () => {
    expect(isNonNegativeNumber(-1)).toBe(false);
    expect(isNonNegativeNumber(-0.001)).toBe(false);
  });
});

describe("isInteger", () => {
  it("returns true for integers", () => {
    expect(isInteger(0)).toBe(true);
    expect(isInteger(123)).toBe(true);
    expect(isInteger(-456)).toBe(true);
  });

  it("returns false for floats", () => {
    expect(isInteger(3.14)).toBe(false);
    expect(isInteger(0.1)).toBe(false);
  });

  it("returns false for NaN", () => {
    expect(isInteger(NaN)).toBe(false);
  });
});

describe("isPositiveInteger", () => {
  it("returns true for positive integers", () => {
    expect(isPositiveInteger(1)).toBe(true);
    expect(isPositiveInteger(999)).toBe(true);
  });

  it("returns false for zero", () => {
    expect(isPositiveInteger(0)).toBe(false);
  });

  it("returns false for negative integers", () => {
    expect(isPositiveInteger(-1)).toBe(false);
  });

  it("returns false for floats", () => {
    expect(isPositiveInteger(1.5)).toBe(false);
  });
});

describe("isBoolean", () => {
  it("returns true for booleans", () => {
    expect(isBoolean(true)).toBe(true);
    expect(isBoolean(false)).toBe(true);
  });

  it("returns false for non-booleans", () => {
    expect(isBoolean(0)).toBe(false);
    expect(isBoolean(1)).toBe(false);
    expect(isBoolean("true")).toBe(false);
    expect(isBoolean(null)).toBe(false);
  });
});

describe("isNull", () => {
  it("returns true for null", () => {
    expect(isNull(null)).toBe(true);
  });

  it("returns false for non-null", () => {
    expect(isNull(undefined)).toBe(false);
    expect(isNull(0)).toBe(false);
    expect(isNull("")).toBe(false);
  });
});

describe("isUndefined", () => {
  it("returns true for undefined", () => {
    expect(isUndefined(undefined)).toBe(true);
  });

  it("returns false for non-undefined", () => {
    expect(isUndefined(null)).toBe(false);
    expect(isUndefined(0)).toBe(false);
  });
});

describe("isNullish", () => {
  it("returns true for null or undefined", () => {
    expect(isNullish(null)).toBe(true);
    expect(isNullish(undefined)).toBe(true);
  });

  it("returns false for non-nullish", () => {
    expect(isNullish(0)).toBe(false);
    expect(isNullish("")).toBe(false);
    expect(isNullish(false)).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// CUSTOM PRIMITIVES
// ══════════════════════════════════════════════════════════════════════════════

describe("isUUID", () => {
  it("returns true for valid UUIDs", () => {
    expect(isUUID("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(isUUID("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
    expect(isUUID("00000000-0000-0000-0000-000000000000")).toBe(true);
  });

  it("returns false for invalid UUIDs", () => {
    expect(isUUID("not-a-uuid")).toBe(false);
    expect(isUUID("550e8400-e29b-41d4-a716")).toBe(false);
    expect(isUUID("550e8400e29b41d4a716446655440000")).toBe(false);
    expect(isUUID("")).toBe(false);
    expect(isUUID(123)).toBe(false);
  });
});

describe("isEmail", () => {
  it("returns true for valid emails", () => {
    expect(isEmail("test@example.com")).toBe(true);
    expect(isEmail("user.name@domain.co.in")).toBe(true);
    expect(isEmail("a@b.c")).toBe(true);
  });

  it("returns false for invalid emails", () => {
    expect(isEmail("not-an-email")).toBe(false);
    expect(isEmail("@domain.com")).toBe(false);
    expect(isEmail("user@")).toBe(false);
    expect(isEmail("user@domain")).toBe(false);
    expect(isEmail("")).toBe(false);
  });
});

describe("isIndianPhone", () => {
  it("returns true for valid Indian phone numbers", () => {
    expect(isIndianPhone("9876543210")).toBe(true);
    expect(isIndianPhone("+919876543210")).toBe(true);
    expect(isIndianPhone("98765 43210")).toBe(true);
    expect(isIndianPhone("9876-543-210")).toBe(true);
  });

  it("returns false for invalid Indian phone numbers", () => {
    expect(isIndianPhone("1234567890")).toBe(false); // starts with 1
    expect(isIndianPhone("987654321")).toBe(false); // too short
    expect(isIndianPhone("98765432100")).toBe(false); // too long
    expect(isIndianPhone("")).toBe(false);
  });
});

describe("isPhone", () => {
  it("returns true for valid phone numbers", () => {
    expect(isPhone("9876543210")).toBe(true);
    expect(isPhone("+1-555-123-4567")).toBe(true);
    expect(isPhone("123456789012345")).toBe(true); // 15 digits max
  });

  it("returns false for invalid phone numbers", () => {
    expect(isPhone("123")).toBe(false); // too short
    expect(isPhone("1234567890123456")).toBe(false); // 16 digits, too long
    expect(isPhone("")).toBe(false);
  });
});

describe("isISODate", () => {
  it("returns true for valid ISO dates", () => {
    expect(isISODate("2024-01-15")).toBe(true);
    expect(isISODate("1990-12-31")).toBe(true);
    expect(isISODate("2000-06-01")).toBe(true);
  });

  it("returns false for invalid formats", () => {
    expect(isISODate("2024/01/15")).toBe(false);
    expect(isISODate("15-01-2024")).toBe(false);
    expect(isISODate("2024-1-15")).toBe(false);
  });

  it("returns false for invalid dates", () => {
    expect(isISODate("2024-13-01")).toBe(false); // invalid month
    expect(isISODate("2024-02-30")).toBe(false); // invalid day
  });
});

describe("isISODateTime", () => {
  it("returns true for valid ISO datetimes", () => {
    expect(isISODateTime("2024-01-15T10:30:00")).toBe(true);
    expect(isISODateTime("2024-01-15T10:30:00Z")).toBe(true);
    expect(isISODateTime("2024-01-15T10:30:00.000Z")).toBe(true);
    expect(isISODateTime("2024-01-15T10:30:00+05:30")).toBe(true);
  });

  it("returns false for invalid formats", () => {
    expect(isISODateTime("2024-01-15")).toBe(false); // date only
    expect(isISODateTime("10:30:00")).toBe(false); // time only
    expect(isISODateTime("not-a-datetime")).toBe(false);
  });
});

describe("isDateOfBirth", () => {
  it("returns true for valid birth dates", () => {
    expect(isDateOfBirth("1990-01-15")).toBe(true);
    expect(isDateOfBirth("2020-12-31")).toBe(true);
  });

  it("returns false for future dates", () => {
    expect(isDateOfBirth("2099-01-01")).toBe(false);
  });

  it("returns false for dates too old", () => {
    expect(isDateOfBirth("1800-01-01")).toBe(false);
  });
});

describe("isPincode", () => {
  it("returns true for valid Indian pincodes", () => {
    expect(isPincode("110001")).toBe(true);
    expect(isPincode("560034")).toBe(true);
    expect(isPincode("999999")).toBe(true);
  });

  it("returns false for invalid pincodes", () => {
    expect(isPincode("000001")).toBe(false); // starts with 0
    expect(isPincode("12345")).toBe(false); // too short
    expect(isPincode("1234567")).toBe(false); // too long
    expect(isPincode("11000a")).toBe(false); // contains letter
  });
});

describe("isUHID", () => {
  it("returns true for valid UHIDs", () => {
    expect(isUHID("UHID001")).toBe(true);
    expect(isUHID("PT-2024-00001")).toBe(true);
    expect(isUHID("12345")).toBe(true);
  });

  it("returns false for invalid UHIDs", () => {
    expect(isUHID("")).toBe(false);
    expect(isUHID("A".repeat(21))).toBe(false); // too long
  });
});

describe("isAadhaar", () => {
  it("returns true for valid Aadhaar numbers", () => {
    expect(isAadhaar("234567890123")).toBe(true);
    expect(isAadhaar("2345 6789 0123")).toBe(true);
    expect(isAadhaar("999988887777")).toBe(true);
  });

  it("returns false for invalid Aadhaar numbers", () => {
    expect(isAadhaar("123456789012")).toBe(false); // starts with 1
    expect(isAadhaar("023456789012")).toBe(false); // starts with 0
    expect(isAadhaar("23456789012")).toBe(false); // too short
    expect(isAadhaar("2345678901234")).toBe(false); // too long
  });
});

describe("isABHA", () => {
  it("returns true for valid ABHA IDs", () => {
    expect(isABHA("12345678901234")).toBe(true);
    expect(isABHA("12-3456-7890-1234")).toBe(true);
  });

  it("returns false for invalid ABHA IDs", () => {
    expect(isABHA("1234567890123")).toBe(false); // too short
    expect(isABHA("123456789012345")).toBe(false); // too long
  });
});

describe("isMedicalRegNumber", () => {
  it("returns true for valid medical registration numbers", () => {
    expect(isMedicalRegNumber("MCI-123456")).toBe(true);
    expect(isMedicalRegNumber("KMC/12345/2020")).toBe(true);
  });

  it("returns false for invalid formats", () => {
    expect(isMedicalRegNumber("")).toBe(false);
    expect(isMedicalRegNumber("A".repeat(31))).toBe(false); // too long
  });
});

describe("isICD10Code", () => {
  it("returns true for valid ICD-10 codes", () => {
    expect(isICD10Code("A00")).toBe(true);
    expect(isICD10Code("A00.1")).toBe(true);
    expect(isICD10Code("Z99.89")).toBe(true);
    expect(isICD10Code("j06")).toBe(true); // case insensitive
  });

  it("returns false for invalid ICD-10 codes", () => {
    expect(isICD10Code("00A")).toBe(false);
    expect(isICD10Code("A0")).toBe(false);
    expect(isICD10Code("A00.123")).toBe(false); // too many decimal places
  });
});

describe("isLOINCCode", () => {
  it("returns true for valid LOINC codes", () => {
    expect(isLOINCCode("1234-5")).toBe(true);
    expect(isLOINCCode("12345-6")).toBe(true);
    expect(isLOINCCode("1-2")).toBe(true);
  });

  it("returns false for invalid LOINC codes", () => {
    expect(isLOINCCode("123456-7")).toBe(false); // too many digits
    expect(isLOINCCode("1234")).toBe(false); // no check digit
    expect(isLOINCCode("1234-56")).toBe(false); // check digit too long
  });
});

describe("isGSTIN", () => {
  it("returns true for valid GSTINs", () => {
    expect(isGSTIN("27AAPFU0939F1ZV")).toBe(true);
    expect(isGSTIN("29ABCDE1234F1Z5")).toBe(true);
  });

  it("returns false for invalid GSTINs", () => {
    expect(isGSTIN("27AAPFU0939F1Z")).toBe(false); // too short
    expect(isGSTIN("AAAPFU0939F1ZV1")).toBe(false); // doesn't start with digits
    expect(isGSTIN("")).toBe(false);
  });
});

describe("isPAN", () => {
  it("returns true for valid PAN numbers", () => {
    expect(isPAN("ABCDE1234F")).toBe(true);
    expect(isPAN("ZZZZZ9999Z")).toBe(true);
  });

  it("returns false for invalid PAN numbers", () => {
    expect(isPAN("ABCDE1234")).toBe(false); // too short
    expect(isPAN("1BCDE1234F")).toBe(false); // starts with digit
    expect(isPAN("ABCDE12345")).toBe(false); // ends with digit
  });
});

describe("isDecimalString", () => {
  it("returns true for valid decimal strings", () => {
    expect(isDecimalString("123")).toBe(true);
    expect(isDecimalString("123.45")).toBe(true);
    expect(isDecimalString("-123.4567")).toBe(true);
    expect(isDecimalString("0")).toBe(true);
    expect(isDecimalString("0.0001")).toBe(true);
  });

  it("returns false for invalid decimal strings", () => {
    expect(isDecimalString("123.45678")).toBe(false); // too many decimals
    expect(isDecimalString("abc")).toBe(false);
    expect(isDecimalString("12.34.56")).toBe(false);
  });
});

describe("isPositiveDecimalString", () => {
  it("returns true for non-negative decimal strings", () => {
    expect(isPositiveDecimalString("123.45")).toBe(true);
    expect(isPositiveDecimalString("0")).toBe(true);
    expect(isPositiveDecimalString("0.01")).toBe(true);
  });

  it("returns false for negative values", () => {
    expect(isPositiveDecimalString("-123.45")).toBe(false);
    expect(isPositiveDecimalString("-0.01")).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// OBJECT HELPERS
// ══════════════════════════════════════════════════════════════════════════════

describe("hasKeys", () => {
  it("returns true if object has all keys", () => {
    const obj = { a: 1, b: "two", c: true };
    expect(hasKeys(obj, ["a", "b"])).toBe(true);
    expect(hasKeys(obj, ["a", "b", "c"])).toBe(true);
  });

  it("returns false if object missing keys", () => {
    const obj = { a: 1 };
    expect(hasKeys(obj, ["a", "b"])).toBe(false);
  });

  it("returns false for non-objects", () => {
    expect(hasKeys(null, ["a"])).toBe(false);
    expect(hasKeys("string", ["length"])).toBe(false);
  });
});

describe("isArray", () => {
  it("returns true for arrays", () => {
    expect(isArray([])).toBe(true);
    expect(isArray([1, 2, 3])).toBe(true);
  });

  it("returns false for non-arrays", () => {
    expect(isArray({})).toBe(false);
    expect(isArray("array")).toBe(false);
  });
});

describe("isArrayOfType", () => {
  it("returns true for arrays of matching type", () => {
    expect(isArrayOfType([1, 2, 3], isNumber)).toBe(true);
    expect(isArrayOfType(["a", "b"], isString)).toBe(true);
    expect(isArrayOfType([], isString)).toBe(true); // empty array
  });

  it("returns false for arrays with mismatched types", () => {
    expect(isArrayOfType([1, "two", 3], isNumber)).toBe(false);
  });
});

describe("optStr", () => {
  it("returns true for undefined, null, or string", () => {
    expect(optStr({ a: undefined }, "a")).toBe(true);
    expect(optStr({ a: null }, "a")).toBe(true);
    expect(optStr({ a: "hello" }, "a")).toBe(true);
    expect(optStr({}, "a")).toBe(true); // missing key
  });

  it("returns false for non-string values", () => {
    expect(optStr({ a: 123 }, "a")).toBe(false);
    expect(optStr({ a: true }, "a")).toBe(false);
  });
});

describe("optNum", () => {
  it("returns true for undefined, null, or number", () => {
    expect(optNum({ a: undefined }, "a")).toBe(true);
    expect(optNum({ a: null }, "a")).toBe(true);
    expect(optNum({ a: 123 }, "a")).toBe(true);
  });

  it("returns false for non-number values", () => {
    expect(optNum({ a: "123" }, "a")).toBe(false);
  });
});

describe("optInt", () => {
  it("returns true for undefined, null, or integer", () => {
    expect(optInt({ a: 123 }, "a")).toBe(true);
    expect(optInt({ a: null }, "a")).toBe(true);
  });

  it("returns false for floats", () => {
    expect(optInt({ a: 1.5 }, "a")).toBe(false);
  });
});

describe("optUUID", () => {
  it("returns true for undefined, null, or UUID", () => {
    expect(optUUID({ a: "550e8400-e29b-41d4-a716-446655440000" }, "a")).toBe(true);
    expect(optUUID({ a: null }, "a")).toBe(true);
  });

  it("returns false for invalid UUIDs", () => {
    expect(optUUID({ a: "not-uuid" }, "a")).toBe(false);
  });
});

describe("optObj", () => {
  it("returns true for undefined, null, or object", () => {
    expect(optObj({ a: {} }, "a")).toBe(true);
    expect(optObj({ a: { b: 1 } }, "a")).toBe(true);
    expect(optObj({ a: null }, "a")).toBe(true);
  });

  it("returns false for non-objects", () => {
    expect(optObj({ a: [] }, "a")).toBe(false);
    expect(optObj({ a: "string" }, "a")).toBe(false);
  });
});

describe("optBool", () => {
  it("returns true for undefined, null, or boolean", () => {
    expect(optBool({ a: true }, "a")).toBe(true);
    expect(optBool({ a: false }, "a")).toBe(true);
    expect(optBool({ a: null }, "a")).toBe(true);
  });

  it("returns false for non-booleans", () => {
    expect(optBool({ a: 0 }, "a")).toBe(false);
    expect(optBool({ a: "true" }, "a")).toBe(false);
  });
});

describe("isOneOf", () => {
  it("creates a guard for enum values", () => {
    const isColor = isOneOf(["red", "green", "blue"] as const);
    expect(isColor("red")).toBe(true);
    expect(isColor("green")).toBe(true);
    expect(isColor("yellow")).toBe(false);
  });

  it("works with numeric enums", () => {
    const isPriority = isOneOf([1, 2, 3] as const);
    expect(isPriority(1)).toBe(true);
    expect(isPriority(4)).toBe(false);
  });
});

describe("optEnum", () => {
  const colors = ["red", "green", "blue"] as const;

  it("returns true for undefined, null, or valid enum value", () => {
    expect(optEnum({ a: "red" }, "a", colors)).toBe(true);
    expect(optEnum({ a: null }, "a", colors)).toBe(true);
    expect(optEnum({}, "a", colors)).toBe(true);
  });

  it("returns false for invalid enum value", () => {
    expect(optEnum({ a: "yellow" }, "a", colors)).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// COMPOSITE HELPERS
// ══════════════════════════════════════════════════════════════════════════════

describe("isNullable", () => {
  it("accepts null or the guarded type", () => {
    const isNullableString = isNullable(isString);
    expect(isNullableString(null)).toBe(true);
    expect(isNullableString("hello")).toBe(true);
    expect(isNullableString(123)).toBe(false);
    expect(isNullableString(undefined)).toBe(false);
  });
});

describe("isOptional", () => {
  it("accepts undefined or the guarded type", () => {
    const isOptionalString = isOptional(isString);
    expect(isOptionalString(undefined)).toBe(true);
    expect(isOptionalString("hello")).toBe(true);
    expect(isOptionalString(123)).toBe(false);
    expect(isOptionalString(null)).toBe(false);
  });
});

describe("isArrayOf", () => {
  it("creates a guard for typed arrays", () => {
    const isStringArray = isArrayOf(isString);
    expect(isStringArray(["a", "b"])).toBe(true);
    expect(isStringArray([])).toBe(true);
    expect(isStringArray([1, 2])).toBe(false);
    expect(isStringArray("not an array")).toBe(false);
  });
});

describe("isRecordOf", () => {
  it("creates a guard for record types", () => {
    const isStringRecord = isRecordOf(isString);
    expect(isStringRecord({ a: "one", b: "two" })).toBe(true);
    expect(isStringRecord({})).toBe(true);
    expect(isStringRecord({ a: 1 })).toBe(false);
  });
});

describe("isUnion", () => {
  it("creates a union guard", () => {
    const isStringOrNumber = isUnion(isString, isNumber);
    expect(isStringOrNumber("hello")).toBe(true);
    expect(isStringOrNumber(123)).toBe(true);
    expect(isStringOrNumber(true)).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ASSERTIONS
// ══════════════════════════════════════════════════════════════════════════════

describe("TypeAssertionError", () => {
  it("creates error with correct message", () => {
    const error = new TypeAssertionError("string", 123, "field");
    expect(error.message).toBe("Expected string at field, got number");
    expect(error.name).toBe("TypeAssertionError");
    expect(error.expectedType).toBe("string");
    expect(error.actualValue).toBe(123);
    expect(error.context).toBe("field");
  });

  it("handles null value", () => {
    const error = new TypeAssertionError("string", null);
    expect(error.message).toBe("Expected string, got null");
  });
});

describe("createAssert", () => {
  it("creates assertion that throws on invalid", () => {
    const assertPositive = createAssert(isPositiveNumber, "positive number");
    expect(() => assertPositive(-1)).toThrow(TypeAssertionError);
    expect(() => assertPositive(1)).not.toThrow();
  });
});

describe("pre-built assertions", () => {
  it("assertString throws on non-string", () => {
    expect(() => assertString("hello")).not.toThrow();
    expect(() => assertString(123)).toThrow(TypeAssertionError);
  });

  it("assertNumber throws on non-number", () => {
    expect(() => assertNumber(123)).not.toThrow();
    expect(() => assertNumber("123")).toThrow(TypeAssertionError);
  });

  it("assertBoolean throws on non-boolean", () => {
    expect(() => assertBoolean(true)).not.toThrow();
    expect(() => assertBoolean(0)).toThrow(TypeAssertionError);
  });

  it("assertUUID throws on invalid UUID", () => {
    expect(() => assertUUID("550e8400-e29b-41d4-a716-446655440000")).not.toThrow();
    expect(() => assertUUID("not-uuid")).toThrow(TypeAssertionError);
  });
});
