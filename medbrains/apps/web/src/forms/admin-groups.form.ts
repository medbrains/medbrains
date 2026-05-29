import type { AccessGroupFormInput, AccessGroupMemberFormInput } from "@medbrains/schemas";
import { optionalTextFromFormValue } from "@medbrains/schemas";

export const defaultAccessGroupFormValues: AccessGroupFormInput = {
  code: "",
  name: "",
  description: "",
  permissions: [],
};

export const defaultAccessGroupMemberFormValues: AccessGroupMemberFormInput = {
  user_id: "",
  expires_at: null,
};

export function accessGroupRowToFormValues(row: {
  code: string;
  name: string;
  description: string | null;
  permissions?: string[];
}): AccessGroupFormInput {
  return {
    code: row.code,
    name: row.name,
    description: row.description ?? "",
    permissions: row.permissions ?? [],
  };
}

export function accessGroupFormToRequest(values: AccessGroupFormInput) {
  return {
    code: values.code.trim(),
    name: values.name.trim(),
    description: optionalTextFromFormValue(values.description),
    permissions: values.permissions,
  };
}

export function accessGroupMemberFormToRequest(values: AccessGroupMemberFormInput) {
  return {
    user_id: values.user_id.trim(),
    expires_at: values.expires_at ? values.expires_at.toISOString() : null,
  };
}
