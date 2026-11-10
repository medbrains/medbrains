import { api } from "@medbrains/api";

/** AI notes from dictation: record, review, and the admin's service settings. */
export const dictationService = {
  createDictation: (...args: Parameters<typeof api.createDictation>) =>
    api.createDictation(...args),
  retryDictation: (dictationId: string) => api.retryDictation(dictationId),
  reviewDictation: (...args: Parameters<typeof api.reviewDictation>) =>
    api.reviewDictation(...args),
  getDictationSettings: () => api.getDictationSettings(),
  saveDictationSettings: (...args: Parameters<typeof api.saveDictationSettings>) =>
    api.saveDictationSettings(...args),
};
