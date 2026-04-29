/**
 * Schema for the PatientRegisterForm validation spec.
 *
 * Each field declares: label (matches getByLabel), type, required flag,
 * a valid example, and (where useful) an invalid example to reject.
 */

import type { FormSchema } from "../../helpers/form-runner";

export const patientRegisterSchema: FormSchema = {
  name: "PatientRegisterForm",
  navigatePath: "/patients",
  openTrigger: { role: "button", name: /Register Patient/i },
  expectDialog: true,
  submitName: /Register/,
  cancelName: /Cancel/,
  fields: [
    {
      label: "First name",
      type: "text",
      required: true,
      validValue: "TestFirst",
    },
    {
      label: "Last name",
      type: "text",
      required: true,
      validValue: "TestLast",
    },
    {
      label: "Phone (primary)",
      type: "phone",
      required: true,
      validValue: "9876543210",
    },
    {
      label: "Gender",
      type: "select",
      required: true,
      validValue: "male",
      optionText: "Male",
    },
    // Optional fields covered in submit-success path:
    {
      label: "Prefix",
      type: "text",
      validValue: "Mr",
    },
    {
      label: "Middle name",
      type: "text",
      validValue: "Mid",
    },
    {
      label: "Phone (alternate)",
      type: "phone",
      validValue: "9876543211",
    },
    {
      label: "Email",
      type: "email",
      validValue: "test@example.com",
    },
  ],
};
