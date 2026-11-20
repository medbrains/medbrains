import { notesApi } from "@medbrains/api/modules/notes";

export const notesService = {
  list: () => notesApi.listStickyNotes(),
  create: (...args: Parameters<typeof notesApi.createStickyNote>) =>
    notesApi.createStickyNote(...args),
  update: (...args: Parameters<typeof notesApi.updateStickyNote>) =>
    notesApi.updateStickyNote(...args),
  remove: (...args: Parameters<typeof notesApi.deleteStickyNote>) =>
    notesApi.deleteStickyNote(...args),
  setShares: (...args: Parameters<typeof notesApi.setStickyNoteShares>) =>
    notesApi.setStickyNoteShares(...args),
  removeShare: (...args: Parameters<typeof notesApi.removeStickyNoteShare>) =>
    notesApi.removeStickyNoteShare(...args),
  pinNotification: (notificationId: string) => notesApi.pinNotificationToNotes(notificationId),
  preferences: () => notesApi.getStickyNotePreferences(),
  setPreferences: (kinds: string[]) => notesApi.setStickyNotePreferences(kinds),
  setAutoResolve: (...args: Parameters<typeof notesApi.setStickyNoteAutoResolve>) =>
    notesApi.setStickyNoteAutoResolve(...args),
  recipients: (...args: Parameters<typeof notesApi.listStickyNoteRecipients>) =>
    notesApi.listStickyNoteRecipients(...args),
};
