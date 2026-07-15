import { describe, expect, it } from "vitest";
import { notificationWsUrl } from "./notification-url.js";

describe("notificationWsUrl", () => {
  it("strips /api, swaps scheme to wss, and appends the token", () => {
    expect(notificationWsUrl("https://hms.example.org/api", "abc.def")).toBe(
      "wss://hms.example.org/ws/notifications?token=abc.def",
    );
  });

  it("handles http (dev) and a trailing slash", () => {
    expect(notificationWsUrl("http://10.0.2.2:3000/api/", "t")).toBe(
      "ws://10.0.2.2:3000/ws/notifications?token=t",
    );
  });

  it("url-encodes the token", () => {
    expect(notificationWsUrl("https://h/api", "a+b/c=")).toBe(
      "wss://h/ws/notifications?token=a%2Bb%2Fc%3D",
    );
  });
});
