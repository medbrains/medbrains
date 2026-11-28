/** The `/upload` API area. Moved from `client.ts`; one module per first path segment. */
import { request } from "../client.js";

export const uploadApi = {
  presignUpload: (data: {
    category: string;
    filename: string;
    mime_type?: string;
    expires_in?: number;
  }) =>
    request<{ key: string; upload_url: string; expires_at: string }>("/upload/presign", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  presignDownload: (key: string, expiresIn?: number) =>
    request<{ download_url: string; expires_at: string }>(
      `/upload/download-url?key=${encodeURIComponent(key)}${expiresIn ? `&expires_in=${expiresIn}` : ""}`,
    ),
};
