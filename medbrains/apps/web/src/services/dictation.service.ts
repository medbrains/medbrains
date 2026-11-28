import { adminApi } from "@medbrains/api/modules/admin";
import { opdApi } from "@medbrains/api/modules/opd";

/** AI notes from dictation: record, review, and the admin's service settings. */
export const dictationService = {
  createDictation: (...args: Parameters<typeof opdApi.createDictation>) =>
    opdApi.createDictation(...args),
  retryDictation: (dictationId: string) => opdApi.retryDictation(dictationId),
  reviewDictation: (...args: Parameters<typeof opdApi.reviewDictation>) =>
    opdApi.reviewDictation(...args),
  getDictationSettings: () => adminApi.getDictationSettings(),
  saveDictationSettings: (...args: Parameters<typeof adminApi.saveDictationSettings>) =>
    adminApi.saveDictationSettings(...args),
};
