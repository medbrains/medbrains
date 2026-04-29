/**
 * Parameterized field-validation runner for Layer 3 form specs.
 */

import { type Locator, type Page, expect } from "@playwright/test";

export type FieldType =
  | "text"
  | "email"
  | "phone"
  | "number"
  | "date"
  | "select"
  | "textarea"
  | "checkbox";

export interface FieldSpec {
  label: string;
  type: FieldType;
  required?: boolean;
  validValue: string | number | boolean;
  invalidValue?: string | number;
  optionText?: string;
  errorPattern?: RegExp;
}

export interface FormSchema {
  name: string;
  navigatePath: string;
  openTrigger?: { role: "button" | "link"; name: string | RegExp };
  expectDialog?: boolean;
  fields: FieldSpec[];
  submitName: string | RegExp;
  cancelName?: string | RegExp;
}

async function getRoot(page: Page, schema: FormSchema): Promise<Locator> {
  if (schema.openTrigger) {
    const opener = page.getByRole(schema.openTrigger.role, {
      name: schema.openTrigger.name,
    });
    await opener.first().click();
  }
  if (schema.expectDialog) {
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    return dialog;
  }
  return page.locator("body");
}

async function fillField(
  root: Locator,
  page: Page,
  field: FieldSpec,
  value: string | number | boolean,
): Promise<void> {
  switch (field.type) {
    case "select": {
      await root.getByLabel(field.label).click();
      const optionName = field.optionText ?? String(value);
      await page
        .getByRole("option", { name: optionName, exact: true })
        .first()
        .click();
      break;
    }
    case "checkbox": {
      const cb = root.getByLabel(field.label);
      const wantChecked = Boolean(value);
      const isChecked = await cb.isChecked();
      if (wantChecked !== isChecked) await cb.click();
      break;
    }
    case "date":
      await root.getByLabel(field.label).fill(String(value));
      break;
    default:
      await root.getByLabel(field.label).fill(String(value));
  }
}

export async function assertRequiredValidation(
  page: Page,
  schema: FormSchema,
): Promise<void> {
  const requiredFields = schema.fields.filter((f) => f.required);
  for (const target of requiredFields) {
    const root = await getRoot(page, schema);
    for (const f of schema.fields) {
      if (f === target) continue;
      await fillField(root, page, f, f.validValue);
    }
    await root
      .getByRole("button", { name: schema.submitName })
      .first()
      .click();
    if (schema.expectDialog) {
      await expect(page.getByRole("dialog")).toBeVisible();
    }
    if (schema.cancelName) {
      await root
        .getByRole("button", { name: schema.cancelName })
        .first()
        .click()
        .catch(() => undefined);
    }
  }
}

export async function assertSubmitSuccess(
  page: Page,
  schema: FormSchema,
): Promise<void> {
  const root = await getRoot(page, schema);
  for (const f of schema.fields) {
    await fillField(root, page, f, f.validValue);
  }
  await root.getByRole("button", { name: schema.submitName }).first().click();
  if (schema.expectDialog) {
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 15_000 });
  }
}

export async function assertInvalidValueRejected(
  page: Page,
  schema: FormSchema,
): Promise<void> {
  const targets = schema.fields.filter((f) => f.invalidValue !== undefined);
  for (const target of targets) {
    const root = await getRoot(page, schema);
    for (const f of schema.fields) {
      const value = f === target ? target.invalidValue! : f.validValue;
      await fillField(root, page, f, value);
    }
    await root
      .getByRole("button", { name: schema.submitName })
      .first()
      .click();
    if (schema.expectDialog) {
      await expect(page.getByRole("dialog")).toBeVisible();
    }
    if (schema.cancelName) {
      await root
        .getByRole("button", { name: schema.cancelName })
        .first()
        .click()
        .catch(() => undefined);
    }
  }
}
