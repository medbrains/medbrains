import { describe, expect, it } from "vitest";
import { notificationWsUrl } from "./notification-url.js";

describe("notificationWsUrl", () => {
  it("strips /api, swaps scheme to wss, and appends the token", () => {
    expect(notificationWsUrl("https://hms.example.org/api", "abc.def")).toBe(
      "wss://hms.example.org/api/ws/notifications?token=abc.def",
    );
  });

  it("handles http (dev) and a trailing slash", () => {
    expect(notificationWsUrl("http://10.0.2.2:3000/api/", "t")).toBe(
      "ws://10.0.2.2:3000/api/ws/notifications?token=t",
    );
  });

  it("url-encodes the token", () => {
    expect(notificationWsUrl("https://h/api", "a+b/c=")).toBe(
      "wss://h/api/ws/notifications?token=a%2Bb%2Fc%3D",
    );
  });
});

describe("the socket path", () => {
  /**
   * `access_token` is set with `Path=/api`, so a socket served outside that
   * prefix never receives it from a browser. At `/ws/notifications` every
   * upgrade arrived with no cookie, answered 401, and the web bell reconnected
   * for ever while mobile — which authenticates with `?token=` — worked fine
   * and hid it.
   */
  it("stays under /api, where the auth cookie is scoped", () => {
    expect(notificationWsUrl("https://hms.example.org/api", "t")).toContain("/api/ws/");
  });
});
