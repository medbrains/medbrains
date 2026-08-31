import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

/**
 * Error thrown when the server returns 422 validation errors.
 */
export class ValidationError extends Error {
  public readonly fields: Record<string, string[]>;

  constructor(fields: Record<string, string[]>) {
    super("Validation failed");
    this.name = "ValidationError";
    this.fields = fields;
  }
}

/**
 * Maps server-side validation field errors to React Hook Form.
 * Call in `onError` of a mutation.
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
): boolean {
  if (error instanceof ValidationError) {
    for (const [field, messages] of Object.entries(error.fields)) {
      if (messages.length > 0) {
        setError(field as Path<T>, {
          type: "server",
          message: messages[0],
        });
      }
    }
    return true;
  }
  return false;
}
