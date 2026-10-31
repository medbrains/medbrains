import { Connection, Items, NodeRunData, RunResult, Workflow } from '../types';
export type RunIndex = ReadonlyMap<string, NodeRunData>;
export declare function indexRuns(result: RunResult | null): RunIndex;
/** What a node emitted on one of its ports. */
export declare function outputOf(runs: RunIndex, nodeId: string, port?: string): Items;
/**
 * What a node received: everything its incoming wires carried.
 *
 * The engine concatenates a node's inputs before running it, so reconstructing
 * the same concatenation here shows exactly what the node saw.
 */
export declare function inputOf(workflow: Workflow, runs: RunIndex, nodeId: string): Items;
/**
 * How many items travelled a wire, or `undefined` when the run never reached
 * it. The difference matters: zero items is a dead branch worth seeing, and no
 * reading at all is a wire that was never evaluated.
 */
export declare function itemsOnWire(runs: RunIndex, connection: Connection): number | undefined;
export interface RunSummary {
    status: RunResult['status'];
    ran: number;
    skipped: number;
    failed: number;
    totalMs: number;
    error?: string;
}
export declare function summarize(result: RunResult): RunSummary;
/** Durations rendered the way an engineer reads them. */
export declare function formatDuration(ms: number): string;
export declare function formatCount(count: number, noun: string): string;
