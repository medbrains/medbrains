import { api } from "@medbrains/api";

export const integrationService = {
  listDefaultPipelines: (...args: Parameters<typeof api.listDefaultPipelines>) =>
    api.listDefaultPipelines(...args),
  setDefaultPipelineEnabled: (...args: Parameters<typeof api.setDefaultPipelineEnabled>) =>
    api.setDefaultPipelineEnabled(...args),
  getJobStats: (...args: Parameters<typeof api.getJobStats>) => api.getJobStats(...args),
  listJobs: (...args: Parameters<typeof api.listJobs>) => api.listJobs(...args),
  listNodeTemplates: (...args: Parameters<typeof api.listNodeTemplates>) =>
    api.listNodeTemplates(...args),
  listConnectors: (...args: Parameters<typeof api.listConnectors>) => api.listConnectors(...args),
  createConnector: (...args: Parameters<typeof api.createConnector>) =>
    api.createConnector(...args),
  testConnector: (...args: Parameters<typeof api.testConnector>) => api.testConnector(...args),
  listOrchestrationEvents: (...args: Parameters<typeof api.listOrchestrationEvents>) =>
    api.listOrchestrationEvents(...args),
  listPipelineExecutions: (...args: Parameters<typeof api.listPipelineExecutions>) =>
    api.listPipelineExecutions(...args),
  listPipelines: (...args: Parameters<typeof api.listPipelines>) => api.listPipelines(...args),
  updatePipelineStatus: (...args: Parameters<typeof api.updatePipelineStatus>) =>
    api.updatePipelineStatus(...args),
  deletePipeline: (...args: Parameters<typeof api.deletePipeline>) => api.deletePipeline(...args),
  triggerPipeline: (...args: Parameters<typeof api.triggerPipeline>) =>
    api.triggerPipeline(...args),
  listEventSchemas: (...args: Parameters<typeof api.listEventSchemas>) =>
    api.listEventSchemas(...args),
  listSchemaModules: (...args: Parameters<typeof api.listSchemaModules>) =>
    api.listSchemaModules(...args),
  listModuleEntities: (...args: Parameters<typeof api.listModuleEntities>) =>
    api.listModuleEntities(...args),
};
