import { api } from "@medbrains/api";

/** SOP flows: switchboard, impact preview, control room and patient ticket. */
export const sopFlowsService = {
  list: () => api.listFlows(),
  get: (code: string) => api.getFlow(code),
  previewImpact: (...args: Parameters<typeof api.previewFlowImpact>) =>
    api.previewFlowImpact(...args),
  controlRoom: (code: string) => api.getFlowControlRoom(code),
  start: (code: string, subjectId: string) => api.startFlow(code, subjectId),
  ticket: (code: string, subjectId: string) => api.getFlowTicket(code, subjectId),
  run: (...args: Parameters<typeof api.runFlowStation>) => api.runFlowStation(...args),
  completeTask: (code: string, subjectId: string, station: string) =>
    api.completeFlowTask(code, subjectId, station),
};

export const DISCHARGE_FLOW = "ipd.discharge";
