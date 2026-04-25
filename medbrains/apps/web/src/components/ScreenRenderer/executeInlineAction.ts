import { getApiBase } from "@medbrains/api";
import { notifications } from "@mantine/notifications";
import type { QueryClient } from "@tanstack/react-query";

interface InlineAction {
  type: string;
  [key: string]: unknown;
}

interface ActionContext {
  navigate: (path: string) => void;
  queryClient: QueryClient;
  screenData: Record<string, unknown>;
}

/**
 * Substitute `:param` and `{{field}}` placeholders with values from context data.
 */
function interpolate(
  template: string,
  data: Record<string, unknown>,
): string {
  return template
    .replace(/:(\w+)/g, (_, key) => String(data[key] ?? `:${key}`))
    .replace(/\{\{(\w+)\}\}/g, (_, key) => String(data[key] ?? ""));
}

/**
 * Execute an inline sidecar action.
 */
export async function executeInlineAction(
  action: Record<string, unknown>,
  ctx: ActionContext,
): Promise<void> {
  const { type } = action as InlineAction;

  switch (type) {
    case "api_call": {
      const endpoint = interpolate(String(action.endpoint ?? ""), ctx.screenData);
      const method = String(action.method ?? "POST");
      const body = action.body ? JSON.stringify(action.body) : undefined;

      const res = await fetch(`${getApiBase()}${endpoint}`, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: method !== "GET" ? body : undefined,
      });

      if (!res.ok) {
        notifications.show({
          title: "Action failed",
          message: `API call returned ${res.status}`,
          color: "red",
        });
      }
      break;
    }

    case "navigate": {
      const route = interpolate(String(action.route ?? "/"), ctx.screenData);
      ctx.navigate(route);
      break;
    }

    case "notification": {
      const colorMap: Record<string, string> = {
        success: "teal",
        error: "red",
        warning: "yellow",
        info: "blue",
      };
      const notifType = String(action.notification_type ?? "success");
      notifications.show({
        title: String(action.title ?? "Notification"),
        message: interpolate(String(action.message ?? ""), ctx.screenData),
        color: colorMap[notifType] ?? "blue",
      });
      break;
    }

    case "refresh_zone": {
      const zoneKey = String(action.zone_key ?? "");
      if (zoneKey) {
        void ctx.queryClient.invalidateQueries({ queryKey: ["zone-data", zoneKey] });
      } else {
        void ctx.queryClient.invalidateQueries({ queryKey: ["zone-data"] });
      }
      break;
    }

    case "set_field":
      // set_field is handled at the SidecarProvider level by updating context state.
      // This is a no-op here; the provider reads the action and patches context directly.
      break;

    case "open_modal":
      // open_modal would need a modal registry — currently a stub.
      notifications.show({
        title: "Modal",
        message: `Would open modal: ${String(action.modal_id ?? "unknown")}`,
        color: "blue",
      });
      break;

    default:
      notifications.show({
        title: "Unknown action",
        message: `Inline action type "${type}" is not supported.`,
        color: "yellow",
      });
  }
}
