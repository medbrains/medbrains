/** The `/bereavement` API area. Moved from `client.ts`; one module per first path segment. */
import type { BereavementFollowup } from "@medbrains/types";
import { request } from "../client.js";

export const bereavementApi = {
  updateBereavement: (id: string, data: { status: string; notes?: string }) =>
    request<BereavementFollowup>(`/bereavement/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};
