/** The `/knowledge` API area. Moved from `client.ts`; one module per first path segment. */

import {
  knowledgeChangeSetDetailResponseSchema,
  knowledgeChangeSetListResponseSchema,
  knowledgeLiveRowsResponseSchema,
  knowledgeProofResponseSchema,
} from "@medbrains/schemas";
import type {
  KnowledgeArea,
  KnowledgeChangeSet,
  KnowledgeChangeSetDetail,
  KnowledgeChangeSetFilter,
  KnowledgeLiveRow,
  KnowledgeProof,
  NewKnowledgeChangeSet,
} from "@medbrains/types";
import { checkedRequest } from "../client.js";

export const knowledgeApi = {
  listKnowledgeChangeSets: (filter: KnowledgeChangeSetFilter = {}) => {
    const qs = new URLSearchParams(
      Object.entries(filter).filter((e): e is [string, string] => Boolean(e[1])),
    ).toString();
    return checkedRequest<KnowledgeChangeSet[]>(
      knowledgeChangeSetListResponseSchema,
      `/knowledge/change-sets${qs ? `?${qs}` : ""}`,
    );
  },
  getKnowledgeChangeSet: (id: string) =>
    checkedRequest<KnowledgeChangeSetDetail>(
      knowledgeChangeSetDetailResponseSchema,
      `/knowledge/change-sets/${id}`,
    ),
  createKnowledgeChangeSet: (data: NewKnowledgeChangeSet) =>
    checkedRequest<KnowledgeChangeSetDetail>(
      knowledgeChangeSetDetailResponseSchema,
      "/knowledge/change-sets",
      { method: "POST", body: JSON.stringify(data) },
    ),
  previewKnowledgeChangeSet: (id: string) =>
    checkedRequest<KnowledgeChangeSetDetail>(
      knowledgeChangeSetDetailResponseSchema,
      `/knowledge/change-sets/${id}/preview`,
      { method: "POST" },
    ),
  approveKnowledgeChangeSet: (id: string, note?: string) =>
    checkedRequest<KnowledgeChangeSetDetail>(
      knowledgeChangeSetDetailResponseSchema,
      `/knowledge/change-sets/${id}/approve`,
      { method: "POST", body: JSON.stringify({ note }) },
    ),
  rejectKnowledgeChangeSet: (id: string, note?: string) =>
    checkedRequest<KnowledgeChangeSetDetail>(
      knowledgeChangeSetDetailResponseSchema,
      `/knowledge/change-sets/${id}/reject`,
      { method: "POST", body: JSON.stringify({ note }) },
    ),
  applyKnowledgeChangeSet: (id: string) =>
    checkedRequest<KnowledgeChangeSetDetail>(
      knowledgeChangeSetDetailResponseSchema,
      `/knowledge/change-sets/${id}/apply`,
      { method: "POST" },
    ),
  rollbackKnowledgeChangeSet: (id: string, reason: string) =>
    checkedRequest<KnowledgeChangeSetDetail>(
      knowledgeChangeSetDetailResponseSchema,
      `/knowledge/change-sets/${id}/rollback`,
      { method: "POST", body: JSON.stringify({ reason }) },
    ),
  getKnowledgeChangeSetProof: (id: string) =>
    checkedRequest<KnowledgeProof>(
      knowledgeProofResponseSchema,
      `/knowledge/change-sets/${id}/proof`,
    ),
  listKnowledgeLiveRows: (area: KnowledgeArea) =>
    checkedRequest<KnowledgeLiveRow[]>(
      knowledgeLiveRowsResponseSchema,
      `/knowledge/areas/${area}/rows`,
    ),
};
