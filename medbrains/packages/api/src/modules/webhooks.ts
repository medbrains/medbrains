/** The `/webhooks` API area. Moved from `client.ts`; one module per first path segment. */
import { request } from "../client.js";

export const webhooksApi = {
  receiveRazorpayWebhook: (data: Record<string, unknown>) =>
    request<unknown>("/webhooks/razorpay", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
