/** The `/widget-templates` API area. Moved from `client.ts`; one module per first path segment. */
import type { WidgetTemplate } from "@medbrains/types";
import { request } from "../client.js";

export const widgetTemplatesApi = {
  listWidgetTemplates: () => request<WidgetTemplate[]>("/widget-templates"),
};
