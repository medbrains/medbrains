/** The `/flows` API area. Moved from `client.ts`; one module per first path segment. */

import {
  flowBuilderResponseSchema,
  flowControlRoomResponseSchema,
  flowDetailResponseSchema,
  flowImpactResponseSchema,
  flowListResponseSchema,
  flowTestDriveResponseSchema,
  flowTicketOrNullResponseSchema,
  flowTicketResponseSchema,
} from "@medbrains/schemas";
import type {
  FlowBuilder,
  FlowControlRoom,
  FlowDetail,
  FlowImpactReport,
  FlowRunRequest,
  FlowSaveDraft,
  FlowSummary,
  FlowSwitches,
  FlowTestDrive,
  FlowTicket,
} from "@medbrains/types";
import { checkedRequest } from "../client.js";

export const flowsApi = {
  listFlows: () => checkedRequest<FlowSummary[]>(flowListResponseSchema, "/flows"),
  getFlow: (code: string) =>
    checkedRequest<FlowDetail>(flowDetailResponseSchema, `/flows/${encodeURIComponent(code)}`),
  previewFlowImpact: (code: string, switches: FlowSwitches) =>
    checkedRequest<FlowImpactReport>(
      flowImpactResponseSchema,
      `/flows/${encodeURIComponent(code)}/impact`,
      { method: "POST", body: JSON.stringify({ switches }) },
    ),
  getFlowControlRoom: (code: string) =>
    checkedRequest<FlowControlRoom>(
      flowControlRoomResponseSchema,
      `/flows/${encodeURIComponent(code)}/control-room`,
    ),
  startFlow: (code: string, subjectId: string) =>
    checkedRequest<FlowTicket>(
      flowTicketResponseSchema,
      `/flows/${encodeURIComponent(code)}/subjects/${subjectId}/start`,
      { method: "POST" },
    ),
  getFlowTicket: (code: string, subjectId: string) =>
    checkedRequest<FlowTicket | null>(
      flowTicketOrNullResponseSchema,
      `/flows/${encodeURIComponent(code)}/subjects/${subjectId}/ticket`,
    ),
  runFlowStation: (code: string, subjectId: string, data: FlowRunRequest) =>
    checkedRequest<FlowTicket>(
      flowTicketResponseSchema,
      `/flows/${encodeURIComponent(code)}/subjects/${subjectId}/run`,
      { method: "POST", body: JSON.stringify(data) },
    ),
  getFlowBuilder: (code: string) =>
    checkedRequest<FlowBuilder>(
      flowBuilderResponseSchema,
      `/flows/${encodeURIComponent(code)}/build`,
    ),
  saveFlowDraft: (code: string, data: FlowSaveDraft) =>
    checkedRequest<FlowBuilder>(
      flowBuilderResponseSchema,
      `/flows/${encodeURIComponent(code)}/build/draft`,
      { method: "PUT", body: JSON.stringify(data) },
    ),
  discardFlowDraft: (code: string) =>
    checkedRequest<FlowBuilder>(
      flowBuilderResponseSchema,
      `/flows/${encodeURIComponent(code)}/build/draft`,
      { method: "DELETE" },
    ),
  dryRunFlowDraft: (code: string, revision: number) =>
    checkedRequest<FlowTestDrive>(
      flowTestDriveResponseSchema,
      `/flows/${encodeURIComponent(code)}/build/dry-run`,
      { method: "POST", body: JSON.stringify({ revision }) },
    ),
  completeFlowTask: (code: string, subjectId: string, station: string) =>
    checkedRequest<FlowTicket>(
      flowTicketResponseSchema,
      `/flows/${encodeURIComponent(code)}/subjects/${subjectId}/tasks/${station}/complete`,
      { method: "POST" },
    ),
};
