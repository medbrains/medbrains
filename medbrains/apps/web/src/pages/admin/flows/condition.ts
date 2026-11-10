/**
 * Branch conditions as the condition form builds them: rows of fact +
 * operator + value, joined by "all" (AND) or "any" (an `$any` OR group).
 * The server types and evaluates them (condition.rs, checks.rs); this turns
 * rows into a clause and back, and a clause into words.
 */
import type { FlowClause, FlowFact, FlowNamed } from "@medbrains/types";

export type ConditionValue = string | number | boolean | string[];

export interface ConditionRow {
  fact: string;
  op: string;
  value: ConditionValue;
}

export type Joiner = "all" | "any";

const ANY = "$any";

function clauseOf(row: ConditionRow): Record<string, unknown> {
  // Plain equality is stored as the value itself, as library flows write it.
  return { [row.fact]: row.op === "eq" ? row.value : { [row.op]: row.value } };
}

/** The clause the rows make; null when there are none (every patient). */
export function rowsToClause(rows: ConditionRow[], joiner: Joiner): FlowClause {
  if (rows.length === 0) return null;
  if (joiner === "any" && rows.length > 1) return { [ANY]: rows.map(clauseOf) };
  const out: Record<string, unknown> = {};
  for (const row of rows) {
    const prev = out[row.fact];
    const next = clauseOf(row)[row.fact];
    // Two rules on one fact (age at least 18 and under 65) share its operators.
    out[row.fact] =
      prev && typeof prev === "object" && typeof next === "object" && !Array.isArray(next)
        ? { ...(prev as object), ...(next as object) }
        : next;
  }
  return out;
}

function rowsOf(fact: string, value: unknown): ConditionRow[] {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value).map(([op, v]) => ({ fact, op, value: v as ConditionValue }));
  }
  return [{ fact, op: "eq", value: value as ConditionValue }];
}

/** The rows a clause was built from, for editing it again. */
export function clauseToRows(clause: FlowClause): { rows: ConditionRow[]; joiner: Joiner } {
  if (!clause) return { rows: [], joiner: "all" };
  const any = clause[ANY];
  if (Array.isArray(any)) {
    const rows = any.flatMap((c) =>
      Object.entries(c as Record<string, unknown>).flatMap(([f, v]) => rowsOf(f, v)),
    );
    return { rows, joiner: "any" };
  }
  return { rows: Object.entries(clause).flatMap(([f, v]) => rowsOf(f, v)), joiner: "all" };
}

const OP_WORDS: Record<string, string> = {
  eq: "is",
  ne: "is not",
  gt: "is over",
  gte: "is at least",
  lt: "is under",
  lte: "is at most",
  in: "is one of",
};

/** Who a yes on a yes/no fact picks out; mirrors `blocks::Fact::who`. */
const WHO: Record<string, string> = {
  is_insurance: "insurance patients",
  is_mlc: "medico-legal patients",
};

export interface Vocabulary {
  facts?: FlowFact[];
  departments?: FlowNamed[];
}

function show(fact: string, value: unknown, vocab: Vocabulary): string {
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (Array.isArray(value)) return value.map((v) => show(fact, v, vocab)).join(", ");
  if (fact === "department") {
    return vocab.departments?.find((d) => d.code === value)?.name ?? String(value);
  }
  return String(value);
}

function rowWords(row: ConditionRow, vocab: Vocabulary): string {
  const label = vocab.facts?.find((f) => f.key === row.fact)?.label ?? row.fact.replace(/_/g, " ");
  return `${label.toLowerCase()} ${OP_WORDS[row.op] ?? row.op} ${show(row.fact, row.value, vocab)}`;
}

/** A clause in words: "admitting department is Orthopaedics". */
export function describeClause(clause: FlowClause, vocab: Vocabulary = {}): string {
  const { rows, joiner } = clauseToRows(clause);
  if (rows.length === 0) return "always";
  return rows.map((r) => rowWords(r, vocab)).join(joiner === "any" ? " or " : " and ");
}

/** Who a branch picks out: "every patient", "insurance patients", … */
export function audience(clause: FlowClause, vocab: Vocabulary = {}): string {
  const { rows } = clauseToRows(clause);
  if (rows.length === 0) return "every patient";
  const only = rows.length === 1 ? rows[0] : undefined;
  if (only && only.op === "eq" && only.value === true && WHO[only.fact])
    return WHO[only.fact] as string;
  return `patients whose ${describeClause(clause, vocab)}`;
}
