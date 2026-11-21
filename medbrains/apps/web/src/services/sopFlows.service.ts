import { flowsApi } from "@medbrains/api/modules/flows";

/** SOP flows: switchboard, impact preview, control room, patient ticket and track builder. */
export const sopFlowsService = {
  list: () => flowsApi.listFlows(),
  get: (code: string) => flowsApi.getFlow(code),
  previewImpact: (...args: Parameters<typeof flowsApi.previewFlowImpact>) =>
    flowsApi.previewFlowImpact(...args),
  controlRoom: (code: string) => flowsApi.getFlowControlRoom(code),
  start: (code: string, subjectId: string) => flowsApi.startFlow(code, subjectId),
  ticket: (code: string, subjectId: string) => flowsApi.getFlowTicket(code, subjectId),
  run: (...args: Parameters<typeof flowsApi.runFlowStation>) => flowsApi.runFlowStation(...args),
  completeTask: (code: string, subjectId: string, station: string) =>
    flowsApi.completeFlowTask(code, subjectId, station),
  builder: (code: string) => flowsApi.getFlowBuilder(code),
  saveDraft: (...args: Parameters<typeof flowsApi.saveFlowDraft>) =>
    flowsApi.saveFlowDraft(...args),
  discardDraft: (code: string) => flowsApi.discardFlowDraft(code),
  dryRun: (code: string, revision: number) => flowsApi.dryRunFlowDraft(code, revision),
};

export const DISCHARGE_FLOW = "ipd.discharge";
