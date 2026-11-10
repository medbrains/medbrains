import { RunResult, Workflow } from '../types';
export type LogLevel = 'info' | 'warn' | 'error' | 'debug';
export interface LogLine {
    /** Milliseconds since the run started, accumulated from node durations. */
    elapsedMs: number;
    level: LogLevel;
    /** The node this line is about, when it is about one. */
    scope: string;
    message: string;
    /** Payload shown when the line is expanded. */
    detail?: string;
}
export interface RunMeta {
    mode?: string;
    startedAt?: string;
}
export declare function logLines(workflow: Workflow, result: RunResult, meta?: RunMeta): LogLine[];
/** Keep only the lines a viewer asked for. */
export declare function filterLines(lines: readonly LogLine[], { levels, query }: {
    levels: ReadonlySet<LogLevel>;
    query: string;
}): LogLine[];
/** The whole console as text, for pasting into a bug report. */
export declare function toPlainText(lines: readonly LogLine[]): string;
