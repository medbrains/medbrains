/**
 * Scrollable form body that the keyboard cannot cover.
 *
 * Every data-entry screen in the staff and camp apps was a bare `ScrollView`.
 * On a phone the keyboard takes the lower half of the display, so a nurse
 * writing a handover, or a clerk registering a patient, could not see the field
 * they were typing into and could not reach the submit button without
 * dismissing the keyboard first. On iOS nothing moves out of the way unless
 * something asks it to.
 *
 * Android is left to its own resize behaviour — the apps are EAS-managed and
 * resize by default, and stacking `behavior="height"` on top of that fights it.
 */

import type { ReactNode } from "react";
import type { ScrollViewProps } from "react-native";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { COLORS, SPACING } from "../tokens.js";

export interface FormScrollViewProps extends ScrollViewProps {
  children: ReactNode;
}

export function FormScrollView({
  children,
  contentContainerStyle,
  ...rest
}: FormScrollViewProps): ReactNode {
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.canvas }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        // A tap on a button while the keyboard is open should press the button,
        // not just dismiss the keyboard and make the user tap twice.
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[
          { padding: SPACING.md, gap: SPACING.sm },
          contentContainerStyle,
        ]}
        {...rest}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
