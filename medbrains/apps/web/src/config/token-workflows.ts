import type { ButtonTone } from "@/components/ui";

/** A staff action that advances a token from one status to the next. */
export interface TokenWorkflowAction {
  id: string;
  label: string;
  /** Statuses this action is offered from. */
  from: readonly string[];
  /** Target status the action sets. */
  to: string;
  permission: string;
  tone?: ButtonTone;
}

export interface TokenWorkflow {
  /** Module-specific label for each generic token status. */
  statusLabels: Record<string, string>;
  actions: readonly TokenWorkflowAction[];
}

const MANAGE = "front_office.queue.manage";
const CAMP_MANAGE = "camp.queue.manage";

/**
 * Call an already-called token again.
 *
 * The commonest thing that goes wrong in a waiting room: the number was
 * announced, and the patient was in the toilet, outside on the phone, or
 * simply did not hear it over the room. Until now the desk's only options
 * were to mark them no-show or to leave the token sitting in `called`
 * indefinitely, because Call was offered from `waiting` alone.
 *
 * The server has always supported this — `transition` has no from-state
 * guard, setting `called` again refreshes `called_at` and `called_by`, and
 * it re-broadcasts `TokenCalled`, which is what makes the board announce.
 * Nothing in the console asked for it.
 */
const RECALL: TokenWorkflowAction = {
  id: "recall",
  label: "Call again",
  from: ["called"],
  to: "called",
  permission: MANAGE,
  tone: "secondary",
};

const NO_SHOW: TokenWorkflowAction = {
  id: "no_show",
  label: "No-show",
  from: ["waiting", "called"],
  to: "no_show",
  permission: MANAGE,
  tone: "subtle-danger",
};

/**
 * A waiting patient who is away for a while — sent for an ECG, gone to pay —
 * keeps their place and is passed over by Call next until they are back.
 */
const HOLD: TokenWorkflowAction = {
  id: "hold",
  label: "Hold",
  from: ["waiting"],
  to: "on_hold",
  permission: MANAGE,
  // Outlined, like Move up: the plain secondary tone read as a label.
  tone: "tertiary",
};

/** Back from hold, in the place they held. */
const BACK: TokenWorkflowAction = {
  id: "back",
  label: "Back",
  from: ["on_hold"],
  to: "waiting",
  permission: MANAGE,
  tone: "primary",
};

/**
 * Per-module queue workflow. Phase 1 uses the generic token lifecycle
 * (waiting → called → serving → completed) with module-specific labels +
 * action verbs; finer states (e.g. pharmacy "ready to dispense") come later.
 */
export const TOKEN_WORKFLOWS: Record<string, TokenWorkflow> = {
  registration: {
    statusLabels: {
      waiting: "Waiting",
      on_hold: "On hold",
      called: "At counter",
      completed: "Registered",
      no_show: "No-show",
    },
    actions: [
      {
        id: "call",
        label: "Call",
        from: ["waiting"],
        to: "called",
        permission: MANAGE,
        tone: "primary",
      },
      {
        id: "complete",
        label: "Done",
        from: ["called"],
        to: "completed",
        permission: MANAGE,
        tone: "secondary",
      },
      RECALL,
      NO_SHOW,
      HOLD,
      BACK,
    ],
  },
  opd: {
    statusLabels: {
      waiting: "Waiting",
      on_hold: "On hold",
      called: "Called",
      serving: "In consultation",
      completed: "Completed",
      no_show: "No-show",
    },
    actions: [
      {
        id: "call",
        label: "Call",
        from: ["waiting"],
        to: "called",
        permission: MANAGE,
        tone: "primary",
      },
      {
        id: "start",
        label: "Start",
        from: ["called"],
        to: "serving",
        permission: MANAGE,
        tone: "secondary",
      },
      {
        id: "complete",
        label: "Complete",
        from: ["serving"],
        to: "completed",
        permission: MANAGE,
        tone: "secondary",
      },
      RECALL,
      NO_SHOW,
      HOLD,
      BACK,
    ],
  },
  // A camp station: finishing with a patient sends them to the next station
  // on the camp's route with the same number, which the button says.
  camp: {
    statusLabels: {
      waiting: "Waiting",
      on_hold: "On hold",
      called: "Called",
      serving: "With staff",
      completed: "Moved on",
      no_show: "No-show",
    },
    actions: [
      {
        id: "call",
        label: "Call",
        from: ["waiting"],
        to: "called",
        permission: CAMP_MANAGE,
        tone: "primary",
      },
      {
        id: "start",
        label: "Start",
        from: ["called"],
        to: "serving",
        permission: CAMP_MANAGE,
        tone: "secondary",
      },
      {
        id: "complete",
        label: "Done — next station",
        from: ["called", "serving"],
        to: "completed",
        permission: CAMP_MANAGE,
        tone: "primary",
      },
      RECALL,
      NO_SHOW,
      HOLD,
      BACK,
    ],
  },
  pharmacy: {
    statusLabels: {
      waiting: "Waiting",
      on_hold: "On hold",
      called: "Called",
      serving: "Preparing",
      completed: "Dispensed",
      no_show: "No-show",
    },
    actions: [
      {
        id: "call",
        label: "Call",
        from: ["waiting"],
        to: "called",
        permission: MANAGE,
        tone: "primary",
      },
      {
        id: "prepare",
        label: "Prepare",
        from: ["called"],
        to: "serving",
        permission: MANAGE,
        tone: "secondary",
      },
      {
        id: "dispense",
        label: "Dispense",
        from: ["serving"],
        to: "completed",
        permission: MANAGE,
        tone: "secondary",
      },
      RECALL,
      NO_SHOW,
      HOLD,
      BACK,
    ],
  },
  billing: {
    statusLabels: {
      waiting: "Waiting",
      on_hold: "On hold",
      called: "At counter",
      serving: "Collecting",
      completed: "Paid",
      no_show: "No-show",
    },
    actions: [
      {
        id: "call",
        label: "Call",
        from: ["waiting"],
        to: "called",
        permission: MANAGE,
        tone: "primary",
      },
      {
        id: "collect",
        label: "Collect",
        from: ["called"],
        to: "serving",
        permission: MANAGE,
        tone: "secondary",
      },
      {
        id: "complete",
        label: "Complete",
        from: ["serving"],
        to: "completed",
        permission: MANAGE,
        tone: "secondary",
      },
      RECALL,
      NO_SHOW,
      HOLD,
      BACK,
    ],
  },
  lab: {
    statusLabels: {
      waiting: "Waiting",
      on_hold: "On hold",
      called: "Called",
      serving: "Collecting sample",
      completed: "Collected",
      no_show: "No-show",
    },
    actions: [
      {
        id: "call",
        label: "Call",
        from: ["waiting"],
        to: "called",
        permission: MANAGE,
        tone: "primary",
      },
      {
        id: "collect",
        label: "Collect",
        from: ["called"],
        to: "serving",
        permission: MANAGE,
        tone: "secondary",
      },
      {
        id: "complete",
        label: "Complete",
        from: ["serving"],
        to: "completed",
        permission: MANAGE,
        tone: "secondary",
      },
      RECALL,
      NO_SHOW,
      HOLD,
      BACK,
    ],
  },
  radiology: {
    statusLabels: {
      waiting: "Waiting",
      on_hold: "On hold",
      called: "Called",
      serving: "Scanning",
      completed: "Completed",
      no_show: "No-show",
    },
    actions: [
      {
        id: "call",
        label: "Call",
        from: ["waiting"],
        to: "called",
        permission: MANAGE,
        tone: "primary",
      },
      {
        id: "scan",
        label: "Start scan",
        from: ["called"],
        to: "serving",
        permission: MANAGE,
        tone: "secondary",
      },
      {
        id: "complete",
        label: "Complete",
        from: ["serving"],
        to: "completed",
        permission: MANAGE,
        tone: "secondary",
      },
      RECALL,
      NO_SHOW,
      HOLD,
      BACK,
    ],
  },
  dispatch: {
    statusLabels: {
      waiting: "Requested",
      called: "Assigned",
      serving: "En route",
      completed: "Arrived",
      no_show: "Cancelled",
    },
    actions: [
      {
        id: "assign",
        label: "Assign",
        from: ["waiting"],
        to: "called",
        permission: MANAGE,
        tone: "primary",
      },
      {
        id: "dispatch",
        label: "Dispatch",
        from: ["called"],
        to: "serving",
        permission: MANAGE,
        tone: "secondary",
      },
      {
        id: "arrive",
        label: "Arrived",
        from: ["serving"],
        to: "completed",
        permission: MANAGE,
        tone: "secondary",
      },
    ],
  },
};

/** Actions available for a token given its module + current status. */
export function resolveTokenActions(
  module: string,
  status: string,
): readonly TokenWorkflowAction[] {
  return (TOKEN_WORKFLOWS[module]?.actions ?? []).filter((action) => action.from.includes(status));
}

/** Module-specific label for a generic token status. */
export function tokenStatusLabel(module: string, status: string): string {
  return TOKEN_WORKFLOWS[module]?.statusLabels[status] ?? status;
}
