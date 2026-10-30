import type { ErrorEvent } from "@sentry/react";
import { describe, expect, it } from "vitest";
import { hashUserId, scrubBreadcrumb, scrubEvent, scrubUrl } from "./error-tracking-scrub";

const UHID = "MB-2026-000123";

describe("error report scrubbing in the browser", () => {
  it("drops query strings and record ids from URLs, keeps the route", () => {
    expect(scrubUrl(`https://hims.example.in/patients/${UHID}?q=Ramesh#tab`)).toBe(
      "https://hims.example.in/patients/:id",
    );
    expect(scrubUrl("/api/patients/8f14e45f-ceea-467e-a2c2-0f6b4f5c1a01/visits")).toBe(
      "/api/patients/:id/visits",
    );
  });

  it("drops typed text, console lines and clicked-element text from breadcrumbs", () => {
    expect(scrubBreadcrumb({ category: "ui.input", message: "Ramesh" })).toBeNull();
    expect(scrubBreadcrumb({ category: "console", message: "patient 9876543210" })).toBeNull();
    const click = scrubBreadcrumb({ category: "ui.click", message: 'button[aria-label="Ramesh"]' });
    expect(click?.message).toBeUndefined();
    const fetchCrumb = scrubBreadcrumb({
      category: "fetch",
      data: { method: "GET", status_code: 500, url: "/api/search?q=Ramesh", body: "Ramesh" },
    });
    expect(fetchCrumb?.data).toEqual({ method: "GET", status_code: 500, url: "/api/search" });
  });

  it("sends the request as method and path only, and the user as an id hash only", () => {
    const event = scrubEvent({
      type: undefined,
      request: {
        method: "POST",
        url: `https://hims.example.in/patients/${UHID}?q=Ramesh`,
        data: { name: "Ramesh Kumar Iyer" },
        cookies: { mb_session: "secret" },
        headers: { Authorization: "Bearer secret" },
        query_string: "q=Ramesh",
      },
      user: { id: "8f14e45fceea167a5a36dedd4bea2543", email: "ramesh@example.com" },
      extra: { diagnosis: "diabetes" },
    } as ErrorEvent);
    const sent = JSON.stringify(event);
    for (const needle of ["Ramesh", UHID, "secret", "ramesh@example.com", "diabetes"]) {
      expect(sent).not.toContain(needle);
    }
    expect(event.request?.url).toBe("https://hims.example.in/patients/:id");
    expect(event.user).toEqual({ id: "8f14e45fceea167a5a36dedd4bea2543" });
  });

  it("hashes a user id the same way every time, without the id in it", async () => {
    const id = "8f14e45f-ceea-467e-a2c2-0f6b4f5c1a01";
    const hash = await hashUserId(id);
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
    expect(hash).toBe(await hashUserId(id));
    expect(hash).not.toContain("8f14e45f");
  });
});
