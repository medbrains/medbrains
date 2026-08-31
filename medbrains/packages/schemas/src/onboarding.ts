import { z } from "zod";
import { serviceTypeFormSchema } from "./hms-forms.js";

// ── Shared patterns ──────────────────────────────────────

const codePattern = /^[A-Z0-9][A-Z0-9-]*[A-Z0-9]$/;
const usernamePattern = /^[a-z][a-z0-9_]*$/;
const hexColorPattern = /^#[0-9A-Fa-f]{6}$/;
const pincodePattern = /^\d{4,10}$/;
const phonePattern = /^[\d+\-() ]+$/;
const prefixPattern = /^[A-Za-z0-9-]{0,10}$/;

const codeField = z
  .string()
  .min(2, "Code must be at least 2 characters")
  .max(20, "Code must be at most 20 characters")
  .regex(
    codePattern,
    "Code must be uppercase alphanumeric with optional hyphens, no leading/trailing hyphen",
  );

const nameField = z
  .string()
  .min(2, "Name must be at least 2 characters")
  .max(100, "Name must be at most 100 characters");

// ── Step 2: Admin / Init ─────────────────────────────────

export const onboardingInitSchema = z.object({
  hospital_name: nameField,
  hospital_code: codeField,
  hospital_type: z.enum([
    "medical_college",
    "multi_specialty",
    "district_hospital",
    "community_health",
    "primary_health",
    "standalone_clinic",
    "eye_hospital",
    "dental_college",
  ]),
  admin_full_name: z
    .string()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name must be at most 100 characters"),
  admin_username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be at most 30 characters")
    .regex(
      usernamePattern,
      "Username must start with a letter and contain only lowercase letters, digits, and underscores",
    ),
  admin_email: z.string().email("Invalid email address"),
  admin_password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one digit")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
});

export type OnboardingInitInput = z.infer<typeof onboardingInitSchema>;

// ── Step 3: Hospital Details ─────────────────────────────

export const updateTenantSchema = z.object({
  address_line1: z.string().max(200).optional().nullable(),
  address_line2: z.string().max(200).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  pincode: z
    .string()
    .regex(pincodePattern, "PIN code must be 4-10 digits")
    .optional()
    .nullable()
    .or(z.literal("")),
  phone: z
    .string()
    .regex(phonePattern, "Phone must contain only digits, +, -, spaces, and parentheses")
    .optional()
    .nullable()
    .or(z.literal("")),
  email: z.string().email("Invalid email address").optional().nullable().or(z.literal("")),
  website: z.string().url("Invalid URL").optional().nullable().or(z.literal("")),
  registration_no: z.string().max(100).optional().nullable(),
  accreditation: z.string().max(100).optional().nullable(),
  timezone: z.string().min(1, "Timezone is required"),
  currency: z.string().length(3, "Currency must be exactly 3 characters"),
  fy_start_month: z.coerce
    .number()
    .int()
    .min(1, "Month must be 1-12")
    .max(12, "Month must be 1-12"),
});

export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;

// ── Step 4: Geo & Regulatory ─────────────────────────────

export const geoRegulatorySchema = z.object({
  country_id: z.string().uuid().optional().nullable(),
  state_id: z.string().uuid().optional().nullable(),
  district_id: z.string().uuid().optional().nullable(),
});

export type GeoRegulatoryInput = z.infer<typeof geoRegulatorySchema>;

// ── Step 5: Facilities ───────────────────────────────────

export const createFacilitySchema = z.object({
  code: codeField,
  name: nameField,
  facility_type: z.string().min(1, "Facility type is required"),
  parent_id: z.string().uuid().optional().nullable(),
  address_line1: z.string().max(200).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  phone: z
    .string()
    .regex(phonePattern, "Invalid phone number")
    .optional()
    .nullable()
    .or(z.literal("")),
  email: z.string().email("Invalid email").optional().nullable().or(z.literal("")),
  bed_count: z.coerce.number().int().min(0, "Bed count cannot be negative").optional().nullable(),
  shared_billing: z.boolean().optional(),
  shared_pharmacy: z.boolean().optional(),
  shared_lab: z.boolean().optional(),
  shared_hr: z.boolean().optional(),
});

export type CreateFacilityInput = z.infer<typeof createFacilitySchema>;

// ── Step 6: Locations ────────────────────────────────────

export const createLocationSchema = z.object({
  code: codeField,
  name: nameField,
  level: z.enum(["campus", "building", "floor", "wing", "zone", "room", "bed"]),
  parent_id: z.string().uuid().optional().nullable(),
});

export type CreateLocationInput = z.infer<typeof createLocationSchema>;

// ── Step 7: Departments ──────────────────────────────────

const timeSlotSchema = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM"),
  end: z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM"),
});

const dayScheduleSchema = z
  .object({
    morning: timeSlotSchema.optional(),
    evening: timeSlotSchema.optional(),
  })
  .nullable();

export const workingHoursSchema = z.record(z.string(), dayScheduleSchema).optional();

export const createDepartmentSchema = z.object({
  code: codeField,
  name: nameField,
  department_type: z.enum([
    "clinical",
    "pre_clinical",
    "para_clinical",
    "administrative",
    "support",
    "academic",
  ]),
  parent_id: z.string().uuid().optional().nullable(),
  working_hours: workingHoursSchema,
});

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;

// ── Step 8: Users ────────────────────────────────────────

export const createUserSchema = z.object({
  full_name: z
    .string()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name must be at most 100 characters"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be at most 30 characters")
    .regex(
      usernamePattern,
      "Username must start with a letter and contain only lowercase letters, digits, and underscores",
    ),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one digit")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
  role: z.string().min(1, "Role is required"),
  specialization: z.string().max(100).optional(),
  medical_registration_number: z.string().max(50).optional(),
  qualification: z.string().max(200).optional(),
  consultation_fee: z.coerce.number().min(0, "Fee cannot be negative").optional(),
  department_local_ids: z.array(z.string()).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

// ── Step 9: Sequences ────────────────────────────────────

export const sequencesSchema = z.object({
  uhid_prefix: z
    .string()
    .max(10, "Prefix must be at most 10 characters")
    .regex(prefixPattern, "Prefix must be alphanumeric with optional hyphens"),
  uhid_pad_width: z.coerce
    .number()
    .int()
    .min(3, "Pad width must be 3-10")
    .max(10, "Pad width must be 3-10"),
  invoice_prefix: z
    .string()
    .max(10, "Prefix must be at most 10 characters")
    .regex(prefixPattern, "Prefix must be alphanumeric with optional hyphens"),
  invoice_pad_width: z.coerce
    .number()
    .int()
    .min(3, "Pad width must be 3-10")
    .max(10, "Pad width must be 3-10"),
});

export type SequencesInput = z.infer<typeof sequencesSchema>;

// ── Step 10: Branding ────────────────────────────────────

export const brandingSchema = z.object({
  primary_color: z.string().regex(hexColorPattern, "Must be a valid hex color (#RRGGBB)"),
  secondary_color: z.string().regex(hexColorPattern, "Must be a valid hex color (#RRGGBB)"),
  logo_url: z.string().url("Invalid URL").optional().or(z.literal("")),
});

export type BrandingInput = z.infer<typeof brandingSchema>;

// ── Role creation ────────────────────────────────────────

export const createRoleSchema = z.object({
  code: codeField,
  name: nameField,
  description: z.string().max(500).optional(),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;

// ── Services ────────────────────────────────────────────

export const createServiceSchema = z.object({
  code: codeField,
  name: nameField,
  service_type: serviceTypeFormSchema,
  description: z.string().max(500).optional(),
});

export type CreateServiceInput = z.infer<typeof createServiceSchema>;

// ── Bed Types ───────────────────────────────────────────

export const createBedTypeSchema = z.object({
  code: codeField,
  name: nameField,
  daily_rate: z.coerce.number().min(0, "Daily rate cannot be negative"),
  description: z.string().max(500).optional(),
});

export type CreateBedTypeInput = z.infer<typeof createBedTypeSchema>;

// ── Tax Categories ──────────────────────────────────────

export const createTaxCategorySchema = z.object({
  code: codeField,
  name: nameField,
  rate_percent: z.coerce
    .number()
    .min(0, "Rate cannot be negative")
    .max(100, "Rate cannot exceed 100"),
  applicability: z.enum(["taxable", "exempt", "zero_rated"]),
  description: z.string().max(500).optional(),
});

export type CreateTaxCategoryInput = z.infer<typeof createTaxCategorySchema>;

// ── Payment Methods ─────────────────────────────────────

export const createPaymentMethodSchema = z.object({
  code: codeField,
  name: nameField,
  is_default: z.boolean().optional(),
});

export type CreatePaymentMethodInput = z.infer<typeof createPaymentMethodSchema>;

// ── Additional Sequences ────────────────────────────────

export const additionalSequenceSchema = z.object({
  seq_type: z.string().min(1, "Type is required"),
  prefix: z
    .string()
    .max(10, "Prefix must be at most 10 characters")
    .regex(prefixPattern, "Prefix must be alphanumeric with optional hyphens"),
  pad_width: z.coerce
    .number()
    .int()
    .min(3, "Pad width must be 3-10")
    .max(10, "Pad width must be 3-10"),
});

export type AdditionalSequenceInput = z.infer<typeof additionalSequenceSchema>;
