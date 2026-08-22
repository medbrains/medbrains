/**
 * The bar above the keyboard that moves between fields.
 *
 * Some fields cannot be traversed with the return key: a numeric keyboard has
 * none, and a multi-line field needs its return key for newlines (see
 * `field-chain.ts`). Without another affordance those fields are a dead end —
 * the user must dismiss the keyboard, hunt for the next field, and tap it,
 * which is the reach-and-tap-per-field pattern that makes a long clinical form
 * miserable one-handed.
 *
 * This is a WCAG 2.2 SC 2.1.1 / 2.4.3 obligation rather than a flourish: every
 * control operable from the keyboard, in an order that follows meaning. It also
 * answers Android's own note that a multi-line field never auto-closes the
 * keyboard, so something has to.
 *
 * Shows the position ("2 of 4") because a form you traverse blind is a form you
 * lose your place in.
 */

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Keyboard, Platform, View } from "react-native";
import { Button, Text } from "react-native-paper";
import { COLORS, SPACING } from "../tokens.js";

export interface FieldNavigatorProps {
  /** Human labels, in traversal order. Length defines the chain. */
  labels: readonly string[];
  /** Index of the focused field, or null when focus is outside the form. */
  index: number | null;
  /** Move focus to this index. */
  onFocusIndex: (index: number) => void;
  /** Last field reached, or the user is finished: dismiss and optionally save. */
  onDone: () => void;
  testID?: string;
}

/**
 * True while the software keyboard is up.
 *
 * Both listeners are removed on unmount. A retained keyboard subscription is
 * the sort of leak the constrained-device rules exist to prevent: it outlives
 * the screen and fires into a component that is gone.
 */
function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    // iOS reports will-show/will-hide, which line up with the animation;
    // Android only reports did-show/did-hide.
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const shown = Keyboard.addListener(showEvent, () => setVisible(true));
    const hidden = Keyboard.addListener(hideEvent, () => setVisible(false));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);
  return visible;
}

export function FieldNavigator({
  labels,
  index,
  onFocusIndex,
  onDone,
  testID = "field-navigator",
}: FieldNavigatorProps): ReactNode {
  const keyboardVisible = useKeyboardVisible();
  if (!keyboardVisible || index === null || index < 0 || index >= labels.length) return null;

  const hasPrevious = index > 0;
  const hasNext = index < labels.length - 1;

  return (
    <View
      testID={testID}
      accessibilityRole="toolbar"
      accessibilityLabel="Move between form fields"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: SPACING.xs,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.xs,
        backgroundColor: COLORS.panel,
        borderTopWidth: 1,
        borderTopColor: COLORS.rule,
      }}
    >
      <Button
        testID={`${testID}-previous`}
        accessibilityLabel="Previous field"
        compact
        disabled={!hasPrevious}
        mode="text"
        onPress={() => onFocusIndex(index - 1)}
      >
        Back
      </Button>
      <Button
        testID={`${testID}-next`}
        accessibilityLabel="Next field"
        compact
        disabled={!hasNext}
        mode="text"
        onPress={() => onFocusIndex(index + 1)}
      >
        Next
      </Button>
      <Text
        // Position, not decoration: traversing a long form without it means
        // losing your place.
        accessibilityLabel={`${labels[index]}, field ${index + 1} of ${labels.length}`}
        style={{ color: COLORS.muted, flex: 1, textAlign: "center" }}
        variant="labelSmall"
      >
        {index + 1} of {labels.length}
      </Text>
      <Button
        testID={`${testID}-done`}
        accessibilityLabel="Finish editing and hide the keyboard"
        compact
        mode="text"
        onPress={() => {
          Keyboard.dismiss();
          onDone();
        }}
      >
        Done
      </Button>
    </View>
  );
}
