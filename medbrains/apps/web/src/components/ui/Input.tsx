import {
  NumberInput as MantineNumberInput,
  PasswordInput as MantinePasswordInput,
  Textarea as MantineTextarea,
  TextInput as MantineTextInput,
  type NumberInputProps,
  type PasswordInputProps,
  type TextareaProps,
  type TextInputProps,
} from "@mantine/core";
import { forwardRef } from "react";

/**
 * Standard text inputs — bordered, sm, radius from the theme. The
 * wrappers keep one import surface and consistent defaults across the
 * app's forms.
 */
export const Input = forwardRef<HTMLInputElement, TextInputProps>(function Input(
  { size = "sm", ...rest },
  ref,
) {
  return <MantineTextInput ref={ref} size={size} {...rest} />;
});
Input.displayName = "Input";

export const PasswordField = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordField({ size = "sm", ...rest }, ref) {
    return <MantinePasswordInput ref={ref} size={size} {...rest} />;
  },
);
PasswordField.displayName = "PasswordField";

export const NumberField = forwardRef<HTMLInputElement, NumberInputProps>(function NumberField(
  { size = "sm", ...rest },
  ref,
) {
  return <MantineNumberInput ref={ref} size={size} {...rest} />;
});
NumberField.displayName = "NumberField";

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaProps>(function TextArea(
  { size = "sm", autosize = true, minRows = 2, ...rest },
  ref,
) {
  return <MantineTextarea ref={ref} size={size} autosize={autosize} minRows={minRows} {...rest} />;
});
TextArea.displayName = "TextArea";
