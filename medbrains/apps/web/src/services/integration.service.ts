import { integrationApi } from "@medbrains/api/modules/integration";
import { orchestrationApi } from "@medbrains/api/modules/orchestration";
import { schemaApi } from "@medbrains/api/modules/schema";

export const integrationService = {
  listDefaultPipelines: (...args: Parameters<typeof integrationApi.listDefaultPipelines>) =>
    integrationApi.listDefaultPipelines(...args),
  setDefaultPipelineEnabled: (
    ...args: Parameters<typeof integrationApi.setDefaultPipelineEnabled>
  ) => integrationApi.setDefaultPipelineEnabled(...args),
  listUncoveredEvents: (...args: Parameters<typeof integrationApi.listUncoveredEvents>) =>
    integrationApi.listUncoveredEvents(...args),
  getJobStats: (...args: Parameters<typeof orchestrationApi.getJobStats>) =>
    orchestrationApi.getJobStats(...args),
  listJobs: (...args: Parameters<typeof orchestrationApi.listJobs>) =>
    orchestrationApi.listJobs(...args),
  listNodeTemplates: (...args: Parameters<typeof integrationApi.listNodeTemplates>) =>
    integrationApi.listNodeTemplates(...args),
  listConnectors: (...args: Parameters<typeof orchestrationApi.listConnectors>) =>
    orchestrationApi.listConnectors(...args),
  createConnector: (...args: Parameters<typeof orchestrationApi.createConnector>) =>
    orchestrationApi.createConnector(...args),
  testConnector: (...args: Parameters<typeof orchestrationApi.testConnector>) =>
    orchestrationApi.testConnector(...args),
  listOrchestrationEvents: (...args: Parameters<typeof orchestrationApi.listOrchestrationEvents>) =>
    orchestrationApi.listOrchestrationEvents(...args),
  listPipelineExecutions: (...args: Parameters<typeof integrationApi.listPipelineExecutions>) =>
    integrationApi.listPipelineExecutions(...args),
  listPipelines: (...args: Parameters<typeof integrationApi.listPipelines>) =>
    integrationApi.listPipelines(...args),
  updatePipelineStatus: (...args: Parameters<typeof integrationApi.updatePipelineStatus>) =>
    integrationApi.updatePipelineStatus(...args),
  deletePipeline: (...args: Parameters<typeof integrationApi.deletePipeline>) =>
    integrationApi.deletePipeline(...args),
  triggerPipeline: (...args: Parameters<typeof integrationApi.triggerPipeline>) =>
    integrationApi.triggerPipeline(...args),
  listEventSchemas: (...args: Parameters<typeof schemaApi.listEventSchemas>) =>
    schemaApi.listEventSchemas(...args),
  listSchemaModules: (...args: Parameters<typeof schemaApi.listSchemaModules>) =>
    schemaApi.listSchemaModules(...args),
  listModuleEntities: (...args: Parameters<typeof schemaApi.listModuleEntities>) =>
    schemaApi.listModuleEntities(...args),
};
