import { api } from "@medbrains/api";

export const notesService = {
  list: () => api.listStickyNotes(),
  create: (...args: Parameters<typeof api.createStickyNote>) => api.createStickyNote(...args),
  update: (...args: Parameters<typeof api.updateStickyNote>) => api.updateStickyNote(...args),
  remove: (...args: Parameters<typeof api.deleteStickyNote>) => api.deleteStickyNote(...args),
  setShares: (...args: Parameters<typeof api.setStickyNoteShares>) =>
    api.setStickyNoteShares(...args),
  removeShare: (...args: Parameters<typeof api.removeStickyNoteShare>) =>
    api.removeStickyNoteShare(...args),
  pinNotification: (notificationId: string) => api.pinNotificationToNotes(notificationId),
  preferences: () => api.getStickyNotePreferences(),
  setPreferences: (kinds: string[]) => api.setStickyNotePreferences(kinds),
  setAutoResolve: (...args: Parameters<typeof api.setStickyNoteAutoResolve>) =>
    api.setStickyNoteAutoResolve(...args),
  recipients: (...args: Parameters<typeof api.listStickyNoteRecipients>) =>
    api.listStickyNoteRecipients(...args),
};
