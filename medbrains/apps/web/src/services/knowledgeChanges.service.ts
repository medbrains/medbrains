import { knowledgeApi } from "@medbrains/api/modules/knowledge";

/** Knowledge change sets: draft, preview, approve, apply, roll back, prove. */
export const knowledgeChangesService = {
  list: (...args: Parameters<typeof knowledgeApi.listKnowledgeChangeSets>) =>
    knowledgeApi.listKnowledgeChangeSets(...args),
  get: (id: string) => knowledgeApi.getKnowledgeChangeSet(id),
  create: (...args: Parameters<typeof knowledgeApi.createKnowledgeChangeSet>) =>
    knowledgeApi.createKnowledgeChangeSet(...args),
  preview: (id: string) => knowledgeApi.previewKnowledgeChangeSet(id),
  approve: (id: string, note?: string) => knowledgeApi.approveKnowledgeChangeSet(id, note),
  reject: (id: string, note?: string) => knowledgeApi.rejectKnowledgeChangeSet(id, note),
  apply: (id: string) => knowledgeApi.applyKnowledgeChangeSet(id),
  rollback: (id: string, reason: string) => knowledgeApi.rollbackKnowledgeChangeSet(id, reason),
  proof: (id: string) => knowledgeApi.getKnowledgeChangeSetProof(id),
  liveRows: (...args: Parameters<typeof knowledgeApi.listKnowledgeLiveRows>) =>
    knowledgeApi.listKnowledgeLiveRows(...args),
};
