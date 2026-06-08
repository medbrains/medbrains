import type { StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";
import {
  type WorkflowSignalEmphasis,
  type WorkflowSignalMarkerShape,
  type WorkflowSignalMarkerTone,
  workflowSignalShapeStyle,
} from "./workflow-signal-shape-style.js";

export interface WorkflowSignalMarkerProps {
  accessibilityLabel: string;
  emphasis?: WorkflowSignalEmphasis;
  pillExtension?: number;
  shape: WorkflowSignalMarkerShape;
  size?: number;
  style?: StyleProp<ViewStyle>;
  tone: WorkflowSignalMarkerTone;
}

export function WorkflowSignalMarker({
  accessibilityLabel,
  emphasis,
  pillExtension,
  shape,
  size,
  style,
  tone,
}: WorkflowSignalMarkerProps) {
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[workflowSignalShapeStyle({ emphasis, pillExtension, shape, size, tone }), style]}
    />
  );
}
