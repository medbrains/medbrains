import { z } from "zod";
import {
  optionalIsoDateString,
  optionalNonNegativeIntegerNumber,
  optionalNumericFormValue,
} from "./form-primitives.js";

/** One line of a scanned supplier bill as the reviewer edits it. */
export const grnScanLineFormSchema = z
  .object({
    /** Index of the line in the reader's draft; -1 for a line the reviewer added. */
    source_index: z.number().int(),
    product_name: z.string(),
    catalog_item_id: z.string(),
    batch_number: z.string(),
    expiry_date: optionalIsoDateString,
    manufacture_date: optionalIsoDateString,
    hsn_code: z
      .string()
      .refine(
        (value) => value.trim() === "" || /^\d{4,8}$/.test(value.trim()),
        "HSN is 4–8 digits",
      ),
    mrp: optionalNumericFormValue("MRP cannot be negative", 0),
    rate: optionalNumericFormValue("Rate cannot be negative", 0),
    gst_rate: optionalNumericFormValue("GST must be between 0 and 40%", 0, 40),
    discount_amount: optionalNumericFormValue("Discount cannot be negative", 0),
    quantity: optionalNonNegativeIntegerNumber("Quantity must be a whole number"),
    free_quantity: optionalNonNegativeIntegerNumber("Free quantity must be a whole number"),
    quantity_rejected: optionalNonNegativeIntegerNumber("Rejected must be a whole number"),
  })
  .superRefine((value, ctx) => {
    const mrp = String(value.mrp).trim();
    if (mrp !== "" && Number(mrp) < Number(value.rate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mrp"],
        message: "MRP is below the rate — MRP and rate may be swapped",
      });
    }
    if (Number(value.quantity_rejected || 0) > Number(value.quantity || 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["quantity_rejected"],
        message: "Cannot reject more than was billed",
      });
    }
  });

export const grnScanDraftFormSchema = z.object({
  vendor_id: z.string(),
  po_id: z.string(),
  store_location_id: z.string(),
  invoice_number: z.string(),
  invoice_date: optionalIsoDateString,
  invoice_amount: optionalNumericFormValue("Invoice amount cannot be negative", 0),
  remember_matches: z.boolean(),
  lines: z.array(grnScanLineFormSchema).max(200, "At most 200 lines"),
});

export type GrnScanLineFormInput = z.infer<typeof grnScanLineFormSchema>;
export type GrnScanDraftFormInput = z.infer<typeof grnScanDraftFormSchema>;
