export type WorkflowSignalShape = "bed" | "diamond" | "pill" | "token";
export type WorkflowSignalTone = "active" | "blocked" | "complete" | "neutral" | "ready" | "risk";
export type WorkflowSignalShapeSemantic =
  | "bed_assignment"
  | "handoff_or_queue"
  | "ready_or_complete"
  | "stop_or_safety_attention";

export interface WorkflowSignalShapeDefinition {
  descriptionKey: string;
  labelKey: string;
  semantic: WorkflowSignalShapeSemantic;
  shape: WorkflowSignalShape;
}

export const WORKFLOW_SIGNAL_SHAPE_DEFINITIONS = {
  bed: {
    descriptionKey: "operationalShapes.bed.description",
    labelKey: "operationalShapes.bed.label",
    semantic: "bed_assignment",
    shape: "bed",
  },
  diamond: {
    descriptionKey: "operationalShapes.diamond.description",
    labelKey: "operationalShapes.diamond.label",
    semantic: "stop_or_safety_attention",
    shape: "diamond",
  },
  pill: {
    descriptionKey: "operationalShapes.pill.description",
    labelKey: "operationalShapes.pill.label",
    semantic: "ready_or_complete",
    shape: "pill",
  },
  token: {
    descriptionKey: "operationalShapes.token.description",
    labelKey: "operationalShapes.token.label",
    semantic: "handoff_or_queue",
    shape: "token",
  },
} as const satisfies Readonly<Record<WorkflowSignalShape, WorkflowSignalShapeDefinition>>;

export const WORKFLOW_SIGNAL_SHAPES = [
  WORKFLOW_SIGNAL_SHAPE_DEFINITIONS.diamond,
  WORKFLOW_SIGNAL_SHAPE_DEFINITIONS.token,
  WORKFLOW_SIGNAL_SHAPE_DEFINITIONS.pill,
  WORKFLOW_SIGNAL_SHAPE_DEFINITIONS.bed,
] as const;

export function workflowSignalShapeDefinition(
  shape: WorkflowSignalShape,
): WorkflowSignalShapeDefinition {
  return WORKFLOW_SIGNAL_SHAPE_DEFINITIONS[shape];
}
