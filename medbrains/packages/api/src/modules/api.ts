/** The `/api` API area. Moved from `client.ts`; one module per first path segment. */

export const apiApi = {
  downloadDocumentUrl: (id: string) => `/api/documents/${id}/download`,
  previewRenderTemplateUrl: (code: string) => `/api/documents/render/templates/${code}/preview`,
};
