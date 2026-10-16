import { toReading } from "@medbrains/schemas";
import { type Control, type FieldValues, type Path, useController } from "react-hook-form";
import { BloodPressureInput } from "./BloodPressureInput";

interface BloodPressureFieldProps<T extends FieldValues> {
  control: Control<T>;
  systolicName: Path<T>;
  diastolicName: Path<T>;
  /** What the form stores for a blank field: "" for string-backed forms, undefined otherwise. */
  emptyValue: "" | undefined;
  label?: string;
  disabled?: boolean;
}

/** `BloodPressureInput` bound to a React Hook Form pair of fields. */
export function BloodPressureField<T extends FieldValues>({
  control,
  systolicName,
  diastolicName,
  emptyValue,
  label,
  disabled,
}: BloodPressureFieldProps<T>) {
  const systolic = useController({ control, name: systolicName });
  const diastolic = useController({ control, name: diastolicName });

  return (
    <BloodPressureInput
      label={label}
      disabled={disabled}
      value={{
        systolic: toReading(systolic.field.value),
        diastolic: toReading(diastolic.field.value),
      }}
      onChange={(bp) => {
        systolic.field.onChange(bp.systolic ?? emptyValue);
        diastolic.field.onChange(bp.diastolic ?? emptyValue);
      }}
      errors={{
        systolic: systolic.fieldState.error?.message,
        diastolic: diastolic.fieldState.error?.message,
      }}
    />
  );
}
