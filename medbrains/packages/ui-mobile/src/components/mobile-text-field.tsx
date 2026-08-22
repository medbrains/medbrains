/**
 * MedBrains mobile text field.
 *
 * Mirrors the web enterprise input standard:
 * white canvas, 1px rule border, 6px radius, compact label, ink focus.
 */

import type { ComponentProps, ReactNode } from "react";
import { View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { HelperText, Text, TextInput } from "react-native-paper";
import { COLORS, RADIUS, SPACING } from "../tokens.js";

type PaperTextInputProps = ComponentProps<typeof TextInput>;

/**
 * What a form needs from a field it wants to focus: the ability to focus.
 *
 * Structural on purpose. Naming a concrete instance type does not work here --
 * Paper resolves a nested copy of react-native, so its `TextInput` and the
 * top-level one are incompatible types with the same name, and a ref annotated
 * against either will fail to assign somewhere. Asking only for the one method
 * traversal actually calls sidesteps that entirely and keeps working if Paper
 * moves its dependency.
 */
export interface FocusableField {
  focus: () => void;
}

export interface MobileTextFieldProps
  extends Omit<PaperTextInputProps, "label" | "mode" | "theme"> {
  label?: string;
  required?: boolean;
  helperText?: string;
  errorText?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * `ref` reaches the input through `...props`, so a form can move focus into it.
 *
 * React 19 passes `ref` as an ordinary prop, so there is no `forwardRef` here;
 * Paper's own props already carry it. Focus control is not optional polish --
 * WCAG 2.2 SC 2.1.1 keyboard operability on a handheld depends on something
 * being able to move focus between fields. See `field-chain.ts`.
 */
export function MobileTextField(
  {
    label,
    required = false,
    helperText,
    errorText,
    containerStyle,
    accessibilityLabel,
    contentStyle,
    outlineColor,
    outlineStyle,
    placeholderTextColor,
    style,
    ...props
  }: MobileTextFieldProps,
): ReactNode {
  const hasError = Boolean(errorText) || Boolean(props.error);
  const inputHeight = props.multiline ? 88 : 42;

  return (
    <View style={[{ gap: SPACING.xs }, containerStyle]}>
      {label && (
        <Text
          variant="labelMedium"
          style={{
            color: COLORS.ink,
            fontWeight: "500",
            letterSpacing: 0,
          }}
        >
          {label}
          {required && <Text style={{ color: COLORS.red }}> *</Text>}
        </Text>
      )}
      <TextInput
        {...props}
        accessibilityLabel={accessibilityLabel ?? label}
        // Announce the error with the field rather than leaving it to be
        // noticed: WCAG 2.2 SC 3.3.1 wants the problem identified in text, and
        // a screen reader user never sees the red outline.
        accessibilityHint={errorText ?? props.accessibilityHint}
        activeOutlineColor={COLORS.ink}
        contentStyle={[
          {
            minHeight: inputHeight,
            paddingVertical: SPACING.sm,
            fontSize: 14,
            color: COLORS.ink,
          },
          contentStyle,
        ]}
        cursorColor={COLORS.ink}
        dense
        error={hasError}
        mode="outlined"
        outlineColor={hasError ? COLORS.red : (outlineColor ?? COLORS.rule)}
        outlineStyle={[
          {
            borderRadius: RADIUS.sm,
            borderWidth: 1,
          },
          outlineStyle,
        ]}
        placeholderTextColor={placeholderTextColor ?? COLORS.muted}
        selectionColor={COLORS.navActiveBg}
        style={[
          {
            backgroundColor: COLORS.canvas,
          },
          style,
        ]}
        textColor={COLORS.ink}
        theme={{
          roundness: RADIUS.sm,
          colors: {
            primary: COLORS.ink,
            error: COLORS.red,
            onSurfaceVariant: COLORS.brandDeep,
            surface: COLORS.canvas,
            surfaceVariant: COLORS.canvas,
          },
        }}
      />
      {(errorText || helperText) && (
        <HelperText
          type={hasError ? "error" : "info"}
          visible
          style={{
            color: hasError ? COLORS.red : COLORS.brandDeep,
            marginTop: -SPACING.xs,
            paddingHorizontal: 0,
          }}
        >
          {errorText ?? helperText}
        </HelperText>
      )}
    </View>
  );
}