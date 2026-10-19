/** Sticky notes — a person's own notes, shared to department boards or colleagues. */

export const NOTE_COLOURS = ["yellow", "blue", "green", "pink", "gray"] as const;
export type NoteColour = (typeof NOTE_COLOURS)[number];

/** Longest note body, matching the server and the column's CHECK. */
export const MAX_NOTE_CHARS = 1000;

export interface StickyNoteShare {
  id: string;
  department_id: string | null;
  user_id: string | null;
  /** Department or colleague name. */
  label: string;
}

export interface StickyNote {
  id: string;
  body: string;
  colour: NoteColour;
  pinned: boolean;
  /** When the note clears itself; null keeps it until removed. */
  expires_at: string | null;
  author_id: string;
  author_name: string;
  created_at: string;
  updated_at: string;
  /** The share that put it in front of the reader; removing it takes the note off. */
  share_id: string | null;
  /** Every share — on the reader's own notes only. */
  shares: StickyNoteShare[];
  /** Made by the system from a notification: read-only, never shared, dismissible. */
  is_system: boolean;
  /** Where the item behind the note lives in the app. */
  source_url: string | null;
  /** Clears itself when the item behind it is resolved. */
  auto_resolve: boolean;
  /** Whether the item behind it is one the server can tell is resolved. */
  can_auto_resolve: boolean;
  /** When the item was resolved and the note cleared itself. */
  resolved_at: string | null;
}

export interface StickyNoteBoard {
  department_id: string;
  department_name: string;
  notes: StickyNote[];
}

export interface StickyNotesView {
  mine: StickyNote[];
  shared_with_me: StickyNote[];
  boards: StickyNoteBoard[];
  can_moderate: boolean;
}

export interface SaveStickyNote {
  body: string;
  colour: NoteColour;
  pinned: boolean;
  expires_at: string | null;
}

export interface SetStickyNoteShares {
  department_ids: string[];
  user_ids: string[];
}

export interface NoteRecipient {
  id: string;
  name: string;
}

export interface NoteRecipients {
  departments: NoteRecipient[];
  users: NoteRecipient[];
}

export interface NoteKindChoice {
  key: string;
  label: string;
}

/** Which kinds of notification always become a note for the reader. */
export interface StickyNotePreferences {
  kinds: string[];
  choices: NoteKindChoice[];
}
