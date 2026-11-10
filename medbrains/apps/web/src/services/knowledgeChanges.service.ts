import { api } from "@medbrains/api";

/** Knowledge change sets: draft, preview, approve, apply, roll back, prove. */
export const knowledgeChangesService = {
  list: (...args: Parameters<typeof api.listKnowledgeChangeSets>) =>
    api.listKnowledgeChangeSets(...args),
  get: (id: string) => api.getKnowledgeChangeSet(id),
  create: (...args: Parameters<typeof api.createKnowledgeChangeSet>) =>
    api.createKnowledgeChangeSet(...args),
  preview: (id: string) => api.previewKnowledgeChangeSet(id),
  approve: (id: string, note?: string) => api.approveKnowledgeChangeSet(id, note),
  reject: (id: string, note?: string) => api.rejectKnowledgeChangeSet(id, note),
  apply: (id: string) => api.applyKnowledgeChangeSet(id),
  rollback: (id: string, reason: string) => api.rollbackKnowledgeChangeSet(id, reason),
  proof: (id: string) => api.getKnowledgeChangeSetProof(id),
  liveRows: (...args: Parameters<typeof api.listKnowledgeLiveRows>) =>
    api.listKnowledgeLiveRows(...args),
};
