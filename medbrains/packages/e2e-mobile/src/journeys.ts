/**
 * The journeys every device surface owes a test.
 *
 * The web has had a typed journey catalogue for months
 * (`apps/web/e2e/journeys/catalog.ts`): fifty cases, each naming its actors,
 * its entry and exit points, the regulation it answers to and what a passing
 * run has to assert. The device surfaces had four specs that each opened one
 * screen and checked it rendered.
 *
 * The difference matters more on a phone than on the web, because a phone is
 * where the work actually happens — the nurse scanning a wristband and the
 * receptionist issuing a pass are not doing it at a desktop. A suite that
 * proves each screen mounts says nothing about whether a shift can be
 * completed.
 *
 * `automationStatus` is the honest part. A journey listed as `backlog` is a
 * gap somebody can see; a journey quietly absent is a gap nobody can.
 */

export type Surface = "phone" | "tablet" | "tv";

export type JourneyPriority = "P0" | "P1" | "P2";

export type AutomationStatus =
  /** A spec walks it end to end today. */
  | "automated"
  /** Everything it needs exists; nobody has written the spec. */
  | "candidate"
  /** Blocked on a screen, an endpoint or hardware that does not exist yet. */
  | "backlog";

export interface SurfaceJourney {
  id: string;
  title: string;
  /** The role a spec must provision to walk this. */
  actor: string;
  surfaces: readonly Surface[];
  priority: JourneyPriority;
  /** Where the actor starts, in their words. */
  entryPoint: string;
  /** What has to be true when they stop. */
  exitPoint: string;
  /** What a passing run proves. Not "the screen rendered". */
  assertions: readonly string[];
  /** The clinical or regulatory reason this journey is worth a test. */
  anchors: readonly string[];
  automationStatus: AutomationStatus;
  /** Set when automated. */
  spec?: string;
  /** Set when blocked, saying on what. */
  blockedOn?: string;
}

export const SURFACE_JOURNEYS: readonly SurfaceJourney[] = [
  // ── Nursing, at the bed ────────────────────────────────
  {
    id: "MJ-NUR-001",
    title: "Answer a nurse call from the ward board",
    actor: "nurse",
    surfaces: ["phone", "tablet"],
    priority: "P0",
    entryPoint: "nurse module home",
    exitPoint: "call marked seen, then done",
    assertions: [
      "the board distinguishes an answered ward from an unreadable one",
      "acknowledging does not stop the waiting clock",
      "a call past its escalation threshold is named as well as coloured",
    ],
    anchors: ["NABH nursing response times"],
    automationStatus: "automated",
    spec: "nurse-calls.e2e.ts",
  },
  {
    id: "MJ-NUR-002",
    title: "Give a scheduled dose at the bedside",
    actor: "nurse",
    surfaces: ["phone"],
    priority: "P0",
    entryPoint: "MAR for an admitted patient",
    exitPoint: "dose recorded as given, with the scan behind it",
    assertions: [
      "the administration is not reachable from the MAR list",
      "the bedside screen asks for the wristband before it offers anything",
      "a mismatch is a full stop with no way past it",
    ],
    anchors: ["IPSG 3 medication safety", "5 rights"],
    automationStatus: "automated",
    spec: "bcma.e2e.ts",
  },
  {
    id: "MJ-NUR-003",
    title: "Hang a unit of blood and chart the fifteen-minute check",
    actor: "nurse",
    surfaces: ["phone"],
    priority: "P0",
    entryPoint: "bedside transfusion chart",
    exitPoint: "unit closed with its observations charted",
    assertions: [
      "starting refuses without consent, compatibility and a second nurse",
      "the fifteen-minute check is named and goes overdue on its own",
      "a suspected reaction is read from the server, never recomputed",
    ],
    anchors: ["D&C Part XII-B", "NABH transfusion safety"],
    automationStatus: "candidate",
  },
  {
    id: "MJ-NUR-004",
    title: "Hand a patient to the next shift",
    actor: "nurse",
    surfaces: ["phone"],
    priority: "P1",
    entryPoint: "patient workspace",
    exitPoint: "SBAR handover accepted by the incoming nurse",
    assertions: [
      "an unaccepted handover is surfaced before anything else",
      "carried-over tasks survive the shift boundary",
    ],
    anchors: ["NABH shift handover"],
    automationStatus: "candidate",
  },

  // ── The consulting room ────────────────────────────────
  {
    id: "MJ-DOC-001",
    title: "Call the next patient and complete the consult",
    actor: "doctor",
    surfaces: ["phone", "tablet"],
    priority: "P0",
    entryPoint: "doctor module home",
    exitPoint: "token completed on the queue the board reads",
    assertions: [
      "the queue shown is the one the waiting-room board displays",
      "a transition the queue is not in is never offered",
      "all three transitions take the one permission the server checks",
    ],
    anchors: ["OPD queue integrity"],
    automationStatus: "automated",
    spec: "opd-queue.e2e.ts",
  },

  // ── The front desk ─────────────────────────────────────
  {
    id: "MJ-REC-001",
    title: "Register a walk-in patient",
    actor: "receptionist",
    surfaces: ["phone", "tablet"],
    priority: "P0",
    entryPoint: "reception module home",
    exitPoint: "registration offered for submission",
    assertions: [
      "the desk reaches registration from its own module home",
      "a blank identity cannot be submitted",
    ],
    anchors: ["two patient identifiers", "duplicate prevention"],
    automationStatus: "automated",
    spec: "front-office.e2e.ts",
  },
  {
    id: "MJ-REC-005",
    title: "Walk-in from the front door to a token",
    actor: "receptionist",
    surfaces: ["phone", "tablet"],
    priority: "P0",
    entryPoint: "reception module home",
    exitPoint: "OPD token issued and read back to the patient",
    assertions: [
      "the patient exists afterwards and is findable by name",
      "the detail screen offers the visit rather than dead-ending",
      "a token comes back, which is the point of registering anybody",
    ],
    anchors: ["two patient identifiers", "OPD queue integrity"],
    automationStatus: "candidate",
    // Written and walks four of five steps; the submit tap is being finished
    // now that the proxy's missing IPv6 listener is fixed. Listed candidate
    // rather than automated because the catalogue's own test refuses a claim
    // of "automated" that a run does not yet back.
  },
  {
    id: "MJ-REC-006",
    title: "The registration form is short enough to complete on a phone",
    actor: "receptionist",
    surfaces: ["phone"],
    priority: "P2",
    entryPoint: "register patient",
    exitPoint: "submit reached without a scroll marathon",
    assertions: [
      "a walk-in can be registered without passing six sections",
    ],
    anchors: ["a desk registers people while they stand there"],
    automationStatus: "backlog",
    blockedOn:
      "a product decision: the form is identity, referral, clinical ownership, " +
      "ICD-11 search and safety flags, which is a desktop form on a handset",
  },
  {
    id: "MJ-REC-002",
    title: "Register a visitor and issue their pass",
    actor: "receptionist",
    surfaces: ["phone", "tablet"],
    priority: "P1",
    entryPoint: "visitor desk",
    exitPoint: "pass issued and the visitor checked in",
    assertions: [
      "registering and issuing are one act at the desk",
      "a pass past its end time is distinguished from one properly revoked",
    ],
    anchors: ["visiting hours", "who is in the building"],
    automationStatus: "automated",
    spec: "front-office.e2e.ts",
  },
  {
    id: "MJ-REC-003",
    title: "Log an enquiry and resolve it",
    actor: "receptionist",
    surfaces: ["phone", "tablet"],
    priority: "P2",
    entryPoint: "enquiry desk",
    exitPoint: "enquiry closed with what the caller was told",
    assertions: ["an open enquiry is distinguished from a resolved one"],
    anchors: [],
    automationStatus: "automated",
    spec: "front-office.e2e.ts",
  },
  {
    id: "MJ-REC-004",
    title: "Call the next patient from the floor",
    actor: "receptionist",
    surfaces: ["phone", "tablet"],
    priority: "P1",
    entryPoint: "reception queue board",
    exitPoint: "next token called, chosen by the server",
    assertions: [
      "the desk offers one call action, not a call per row",
      "who is next is the server's decision under a lock",
    ],
    anchors: ["priority queue rules"],
    automationStatus: "candidate",
  },

  // ── The wall ───────────────────────────────────────────
  {
    id: "MJ-TV-001",
    title: "A waiting room watches the OPD queue advance",
    actor: "display_device",
    surfaces: ["tv"],
    priority: "P0",
    entryPoint: "paired display showing the OPD board",
    exitPoint: "the called token changes when the doctor calls",
    assertions: [
      "the board carries no patient name",
      "a display reads a board only while it is a paired device",
      "an unreadable feed says so rather than showing an empty queue",
    ],
    anchors: ["queue privacy", "display.board.read"],
    automationStatus: "backlog",
    blockedOn: "an Android TV AVD in CI, and a TV Detox build",
  },
  {
    id: "MJ-TV-002",
    title: "A nursing station sees an unanswered call escalate",
    actor: "display_device",
    surfaces: ["tv"],
    priority: "P1",
    entryPoint: "ward call board",
    exitPoint: "a call crosses its threshold and is named as escalated",
    assertions: [
      "escalation is a word as well as a colour",
      "the board keeps its last good list when the feed drops",
    ],
    anchors: ["NABH nursing response times"],
    automationStatus: "backlog",
    blockedOn: "an Android TV AVD in CI, and a TV Detox build",
  },

  // ── Cross-cutting ──────────────────────────────────────
  {
    id: "MJ-SEC-001",
    title: "Each role opens the app at its own desk",
    actor: "every built-in role",
    surfaces: ["phone", "tablet"],
    priority: "P0",
    entryPoint: "sign-in",
    exitPoint: "the module home the role works from",
    assertions: ["no role lands in a module belonging to another", "no role lands nowhere at all"],
    anchors: ["module gates match the permission their actions require"],
    automationStatus: "candidate",
  },
];

/** Journeys a surface owes, in priority order. */
export function journeysFor(surface: Surface): SurfaceJourney[] {
  const rank = { P0: 0, P1: 1, P2: 2 } as const;
  return SURFACE_JOURNEYS.filter((j) => j.surfaces.includes(surface)).sort(
    (a, b) => rank[a.priority] - rank[b.priority],
  );
}

/** What is not covered yet, which is the number worth watching. */
export function coverage(surface: Surface): {
  automated: number;
  total: number;
  gaps: SurfaceJourney[];
} {
  const owed = journeysFor(surface);
  const gaps = owed.filter((j) => j.automationStatus !== "automated");
  return { automated: owed.length - gaps.length, total: owed.length, gaps };
}
