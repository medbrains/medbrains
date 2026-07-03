import type { ReactNode } from "react";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { AI_TOOL } from "./tools";
import type { ChatContext, ChatToolCall } from "./transport/types";

/**
 * Props every interactive tool widget receives. `onAction` continues the turn
 * (a new user message + optional context); `active` is true only for the live,
 * latest turn — historical calls render read-only.
 */
export interface ToolWidgetProps {
  toolCall: ChatToolCall;
  active: boolean;
  onAction: (message: string, opts?: { context?: ChatContext }) => void;
}

export type ToolWidget = (props: ToolWidgetProps) => ReactNode;

/**
 * Plugin registry: interactive UI for a tool call, keyed by tool name. The
 * unified renderer looks a widget up here and renders it inline where the tool
 * call appears — so adding a generative-UI tool is one entry, no core changes.
 * A tool with no entry falls back to the standard tool-call loader chip.
 */
export const TOOL_WIDGETS: Record<string, ToolWidget> = {
  [AI_TOOL.REQUEST_PATIENT]: ({ active, onAction }) =>
    active ? (
      <PatientSearchSelect
        value=""
        label="Select a patient to continue"
        onChange={(id) =>
          onAction("I've selected the patient — please continue.", {
            context: { patient_id: id },
          })
        }
      />
    ) : null,
};
