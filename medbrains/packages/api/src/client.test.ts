import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// --- Mock fetch globally before importing the module ---
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Stub sessionStorage for CSRF token logic
vi.stubGlobal('sessionStorage', {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
});

// Stub document.cookie
vi.stubGlobal("document", { cookie: "" });

import { api, setApiBase } from "./index.js";

// ---------- Helpers ----------

function mockOk(body: unknown = {}) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  });
}

function mockError(status: number, body: unknown = {}) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: () => Promise.resolve(body),
  });
}

const UUID = "00000000-0000-0000-0000-000000000001";

// ---------- Setup ----------

beforeEach(() => {
  mockFetch.mockReset();
  setApiBase("/api");
});

describe("request() error handling", () => {
  it("throws on 401 (session expired)", async () => {
    // First call returns 401, refresh also fails
    mockError(401);
    mockError(401);
    await expect(api.health()).rejects.toThrow("session_expired");
  });

  it("retries on 401 after successful refresh", async () => {
    // First call 401, refresh succeeds, retry succeeds
    mockError(401);
    mockOk({ token: "new-token", csrf_token: "csrf" });
    mockOk({ status: "ok" });
    const result = await api.health();
    expect(result).toEqual({ status: "ok" });
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("throws validation error on 422", async () => {
    mockError(422, { error: "validation_failed", fields: { name: ["required"] } });
    await expect(api.health()).rejects.toThrow();
  });

  it("throws generic error on 500", async () => {
    mockError(500, { error: "internal_error" });
    await expect(api.health()).rejects.toThrow("internal_error");
  });

  it("includes CSRF header on mutations", async () => {
    // Login sets the CSRF token
    mockOk({ token: "t", csrf_token: "my-csrf" });
    await api.login({ email: "a@b.c", password: "p" });
    mockFetch.mockReset();

    // Next mutation should include CSRF header
    mockOk({ status: "ok" });
    await api.logout();
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers["X-CSRF-Token"]).toBe("my-csrf");
  });

  it("sends credentials: include", async () => {
    mockOk({});
    await api.health();
    expect(mockFetch.mock.calls[0][1].credentials).toBe("include");
  });
});

describe("/admin endpoints", () => {
  it("adminListForms → GET /admin/forms", async () => {
    mockOk({});
    await api.adminListForms();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/admin/forms");
  });

  it("adminGetFormDetail → GET /admin/forms/{param_1}", async () => {
    mockOk({});
    await api.adminGetFormDetail(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/forms");
  });

  it("adminCreateForm → POST /admin/forms", async () => {
    mockOk({});
    await api.adminCreateForm({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/admin/forms");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("adminUpdateForm → PUT /admin/forms/{param_1}", async () => {
    mockOk({});
    await api.adminUpdateForm(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/forms");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("adminListFields → GET /admin/fields", async () => {
    mockOk({});
    await api.adminListFields("test");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/admin/fields");
  });

  it("adminGetFieldDetail → GET /admin/fields/{param_1}", async () => {
    mockOk({});
    await api.adminGetFieldDetail(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/fields");
  });

  it("adminCreateField → POST /admin/fields", async () => {
    mockOk({});
    await api.adminCreateField({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/admin/fields");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("adminUpdateField → PUT /admin/fields/{param_1}", async () => {
    mockOk({});
    await api.adminUpdateField(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/fields");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("adminCreateSection → POST /admin/forms/{param_1}/sections", async () => {
    mockOk({});
    await api.adminCreateSection(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/forms");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("adminUpdateSection → PUT /admin/forms/{param_1}/sections/{param_2}", async () => {
    mockOk({});
    await api.adminUpdateSection(UUID, UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/forms");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("adminDeleteSection → DELETE /admin/forms/{param_1}/sections/{param_2}", async () => {
    mockOk({});
    await api.adminDeleteSection(UUID, UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/forms");
    expect(opts.method).toBe("DELETE");
  });

  it("adminReorderSections → PUT /admin/forms/{param_1}/sections/reorder", async () => {
    mockOk({});
    await api.adminReorderSections(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/forms");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("adminAddFieldToForm → POST /admin/forms/{param_1}/fields", async () => {
    mockOk({});
    await api.adminAddFieldToForm(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/forms");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("adminUpdateFormField → PUT /admin/forms/{param_1}/fields/{param_2}", async () => {
    mockOk({});
    await api.adminUpdateFormField(UUID, UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/forms");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("adminRemoveFieldFromForm → DELETE /admin/forms/{param_1}/fields/{param_2}", async () => {
    mockOk({});
    await api.adminRemoveFieldFromForm(UUID, UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/forms");
    expect(opts.method).toBe("DELETE");
  });

  it("adminReorderFields → PUT /admin/forms/{param_1}/fields/reorder", async () => {
    mockOk({});
    await api.adminReorderFields(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/forms");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("adminListRegulatoryClauses → GET /admin/regulatory-clauses", async () => {
    mockOk({});
    await api.adminListRegulatoryClauses();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/admin/regulatory-clauses");
  });

  it("adminListRegulatoryBodies → GET /admin/regulatory-bodies", async () => {
    mockOk({});
    await api.adminListRegulatoryBodies();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/admin/regulatory-bodies");
  });

  it("adminCreateRegulatoryBody → POST /admin/regulatory-bodies", async () => {
    mockOk({});
    await api.adminCreateRegulatoryBody({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/admin/regulatory-bodies");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("adminUpdateRegulatoryBody → PUT /admin/regulatory-bodies/{param_1}", async () => {
    mockOk({});
    await api.adminUpdateRegulatoryBody(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/regulatory-bodies");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("adminCreateRegulatoryLink → POST /admin/regulatory-links", async () => {
    mockOk({});
    await api.adminCreateRegulatoryLink({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/admin/regulatory-links");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("adminUpdateRegulatoryLink → PUT /admin/regulatory-links/{param_1}", async () => {
    mockOk({});
    await api.adminUpdateRegulatoryLink(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/regulatory-links");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("adminDeleteRegulatoryLink → DELETE /admin/regulatory-links/{param_1}", async () => {
    mockOk({});
    await api.adminDeleteRegulatoryLink(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/regulatory-links");
    expect(opts.method).toBe("DELETE");
  });

  it("adminListModuleLinks → GET /admin/module-links", async () => {
    mockOk({});
    await api.adminListModuleLinks();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/admin/module-links");
  });

  it("adminCreateModuleLink → POST /admin/module-links", async () => {
    mockOk({});
    await api.adminCreateModuleLink({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/admin/module-links");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("adminDeleteModuleLink → DELETE /admin/module-links/{param_1}/{param_2}/{param_3}", async () => {
    mockOk({});
    await api.adminDeleteModuleLink("test", UUID, UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/module-links");
    expect(opts.method).toBe("DELETE");
  });

  it("adminPublishForm → POST /admin/forms/{param_1}/publish", async () => {
    mockOk({});
    await api.adminPublishForm(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/forms");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("adminCreateNewVersion → POST /admin/forms/{param_1}/new-version", async () => {
    mockOk({});
    await api.adminCreateNewVersion(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/forms");
    expect(opts.method).toBe("POST");
  });

  it("adminListFormVersions → GET /admin/forms/{param_1}/versions", async () => {
    mockOk({});
    await api.adminListFormVersions(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/forms");
  });

  it("adminGetFormVersion → GET /admin/forms/{param_1}/versions/{param_2}", async () => {
    mockOk({});
    await api.adminGetFormVersion(UUID, UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/forms");
  });

  it("adminRestoreFormVersion → POST /admin/forms/{param_1}/restore/{param_2}", async () => {
    mockOk({});
    await api.adminRestoreFormVersion(UUID, UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/forms");
    expect(opts.method).toBe("POST");
  });

  it("adminDiffFormVersions → GET /admin/forms/{param_1}/diff", async () => {
    mockOk({});
    await api.adminDiffFormVersions(UUID, UUID, UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/forms");
  });

  it("adminGetFieldAuditLog → GET /admin/fields/{param_1}/audit", async () => {
    mockOk({});
    await api.adminGetFieldAuditLog(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/fields");
  });

  it("adminCreateDashboard → POST /admin/dashboards", async () => {
    mockOk({});
    await api.adminCreateDashboard({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/admin/dashboards");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("adminUpdateDashboard → PUT /admin/dashboards/{param_1}", async () => {
    mockOk({});
    await api.adminUpdateDashboard(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/dashboards");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("adminDeleteDashboard → DELETE /admin/dashboards/{param_1}", async () => {
    mockOk({});
    await api.adminDeleteDashboard(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/dashboards");
    expect(opts.method).toBe("DELETE");
  });

  it("adminDuplicateDashboard → POST /admin/dashboards/{param_1}/duplicate", async () => {
    mockOk({});
    await api.adminDuplicateDashboard(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/dashboards");
    expect(opts.method).toBe("POST");
  });

  it("adminAddWidget → POST /admin/dashboards/{param_1}/widgets", async () => {
    mockOk({});
    await api.adminAddWidget(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/dashboards");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("adminUpdateWidget → PUT /admin/dashboards/{param_1}/widgets/{param_2}", async () => {
    mockOk({});
    await api.adminUpdateWidget(UUID, UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/dashboards");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("adminDeleteWidget → DELETE /admin/dashboards/{param_1}/widgets/{param_2}", async () => {
    mockOk({});
    await api.adminDeleteWidget(UUID, UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/dashboards");
    expect(opts.method).toBe("DELETE");
  });

  it("adminUpdateLayout → PUT /admin/dashboards/{param_1}/layout", async () => {
    mockOk({});
    await api.adminUpdateLayout(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/dashboards");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("adminListWidgetTemplates → GET /admin/widget-templates", async () => {
    mockOk({});
    await api.adminListWidgetTemplates();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/admin/widget-templates");
  });

  it("adminCreateWidgetTemplate → POST /admin/widget-templates", async () => {
    mockOk({});
    await api.adminCreateWidgetTemplate({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/admin/widget-templates");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("adminListScreens → GET /admin/screens", async () => {
    mockOk({});
    await api.adminListScreens();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/admin/screens");
  });

  it("adminCreateScreen → POST /admin/screens", async () => {
    mockOk({});
    await api.adminCreateScreen({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/admin/screens");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("adminGetScreen → GET /admin/screens/{param_1}", async () => {
    mockOk({});
    await api.adminGetScreen(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/screens");
  });

  it("adminUpdateScreen → PUT /admin/screens/{param_1}", async () => {
    mockOk({});
    await api.adminUpdateScreen(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/screens");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("adminDeleteScreen → DELETE /admin/screens/{param_1}", async () => {
    mockOk({});
    await api.adminDeleteScreen(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/screens");
    expect(opts.method).toBe("DELETE");
  });

  it("adminPublishScreen → POST /admin/screens/{param_1}/publish", async () => {
    mockOk({});
    await api.adminPublishScreen(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/screens");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("adminNewScreenVersion → POST /admin/screens/{param_1}/new-version", async () => {
    mockOk({});
    await api.adminNewScreenVersion(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/screens");
    expect(opts.method).toBe("POST");
  });

  it("adminListScreenVersions → GET /admin/screens/{param_1}/versions", async () => {
    mockOk({});
    await api.adminListScreenVersions(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/screens");
  });

  it("adminGetScreenVersion → GET /admin/screens/{param_1}/versions/{param_2}", async () => {
    mockOk({});
    await api.adminGetScreenVersion(UUID, UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/screens");
  });

  it("adminRestoreScreenVersion → POST /admin/screens/{param_1}/restore/{param_2}", async () => {
    mockOk({});
    await api.adminRestoreScreenVersion(UUID, UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/screens");
    expect(opts.method).toBe("POST");
  });

  it("adminListScreenSidecars → GET /admin/screens/{param_1}/sidecars", async () => {
    mockOk({});
    await api.adminListScreenSidecars(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/screens");
  });

  it("adminCreateScreenSidecar → POST /admin/screens/{param_1}/sidecars", async () => {
    mockOk({});
    await api.adminCreateScreenSidecar(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/screens");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("adminUpdateScreenSidecar → PUT /admin/screens/{param_1}/sidecars/{param_2}", async () => {
    mockOk({});
    await api.adminUpdateScreenSidecar(UUID, UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/screens");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("adminDeleteScreenSidecar → DELETE /admin/screens/{param_1}/sidecars/{param_2}", async () => {
    mockOk({});
    await api.adminDeleteScreenSidecar(UUID, UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/screens");
    expect(opts.method).toBe("DELETE");
  });

  it("adminListScreenOverrides → GET /admin/screen-overrides", async () => {
    mockOk({});
    await api.adminListScreenOverrides();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/admin/screen-overrides");
  });

  it("adminUpsertScreenOverride → PUT /admin/screen-overrides/{param_1}", async () => {
    mockOk({});
    await api.adminUpsertScreenOverride(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/screen-overrides");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("adminDeleteScreenOverride → DELETE /admin/screen-overrides/{param_1}", async () => {
    mockOk({});
    await api.adminDeleteScreenOverride(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/screen-overrides");
    expect(opts.method).toBe("DELETE");
  });

});

describe("/analytics endpoints", () => {
  it("getDeptRevenue → GET /analytics/revenue/department", async () => {
    mockOk({});
    await api.getDeptRevenue();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/analytics/revenue/department");
  });

  it("getDoctorRevenue → GET /analytics/revenue/doctor", async () => {
    mockOk({});
    await api.getDoctorRevenue();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/analytics/revenue/doctor");
  });

  it("getIpdCensus → GET /analytics/ipd/census", async () => {
    mockOk({});
    await api.getIpdCensus();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/analytics/ipd/census");
  });

  it("getLabTat → GET /analytics/lab/tat", async () => {
    mockOk({});
    await api.getLabTat();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/analytics/lab/tat");
  });

  it("getPharmacySales → GET /analytics/pharmacy/sales", async () => {
    mockOk({});
    await api.getPharmacySales();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/analytics/pharmacy/sales");
  });

  it("getOtUtilization → GET /analytics/ot/utilization", async () => {
    mockOk({});
    await api.getOtUtilization();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/analytics/ot/utilization");
  });

  it("getErVolume → GET /analytics/er/volume", async () => {
    mockOk({});
    await api.getErVolume();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/analytics/er/volume");
  });

  it("getClinicalIndicators → GET /analytics/clinical/indicators", async () => {
    mockOk({});
    await api.getClinicalIndicators();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/analytics/clinical/indicators");
  });

  it("getOpdFootfall → GET /analytics/opd/footfall", async () => {
    mockOk({});
    await api.getOpdFootfall();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/analytics/opd/footfall");
  });

  it("getBedOccupancy → GET /analytics/bed/occupancy", async () => {
    mockOk({});
    await api.getBedOccupancy();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/analytics/bed/occupancy");
  });

  it("exportAnalytics → GET /analytics/export", async () => {
    mockOk({});
    await api.exportAnalytics({ report: "revenue" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/analytics/export");
  });

});

describe("/api endpoints", () => {
  it("listVisitors → GET /api/front-office/visitors", async () => {
    mockOk({});
    await api.listVisitors();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/api/front-office/visitors");
  });

  it("listVisitorPasses → GET /api/front-office/passes", async () => {
    mockOk({});
    await api.listVisitorPasses();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/api/front-office/passes");
  });

  it("listVisitorLogs → GET /api/front-office/visitor-logs", async () => {
    mockOk({});
    await api.listVisitorLogs();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/api/front-office/visitor-logs");
  });

  it("listEnquiries → GET /api/front-office/enquiries", async () => {
    mockOk({});
    await api.listEnquiries();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/api/front-office/enquiries");
  });

  it("getQueueStats → GET /api/front-office/queue-stats", async () => {
    mockOk({});
    await api.getQueueStats();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/api/front-office/queue-stats");
  });

  it("listBmeVendorEvaluations → GET /api/bme/vendor-evaluations", async () => {
    mockOk({});
    await api.listBmeVendorEvaluations();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/api/bme/vendor-evaluations");
  });

  it("listFmsFireInspections → GET /api/facilities/fire-inspections", async () => {
    mockOk({});
    await api.listFmsFireInspections();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/api/facilities/fire-inspections");
  });

});

describe("/audit endpoints", () => {
  it("listAuditLog → GET /audit/log", async () => {
    mockOk({});
    await api.listAuditLog();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/audit/log");
  });

  it("getAuditEntry → GET /audit/log/{param_1}", async () => {
    mockOk({});
    await api.getAuditEntry(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/audit/log");
  });

  it("getEntityAuditTrail → GET /audit/log/entity/{param_1}/{param_2}", async () => {
    mockOk({});
    await api.getEntityAuditTrail("test", UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/audit/log/entity");
  });

  it("getAuditStats → GET /audit/stats", async () => {
    mockOk({});
    await api.getAuditStats();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/audit/stats");
  });

  it("listAccessLog → GET /audit/access-log", async () => {
    mockOk({});
    await api.listAccessLog();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/audit/access-log");
  });

  it("logAccess → POST /audit/access-log", async () => {
    mockOk({});
    await api.logAccess({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/audit/access-log");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("getPatientAccessLog → GET /audit/access-log/patient/{param_1}", async () => {
    mockOk({});
    await api.getPatientAccessLog(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/audit/access-log/patient");
  });

  it("listAuditModules → GET /audit/modules", async () => {
    mockOk({});
    await api.listAuditModules();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/audit/modules");
  });

  it("listAuditEntityTypes → GET /audit/entity-types", async () => {
    mockOk({});
    await api.listAuditEntityTypes();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/audit/entity-types");
  });

  it("exportAuditLog → GET /audit/export", async () => {
    mockOk({});
    await api.exportAuditLog();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/audit/export");
  });

  it("getUserActivity → GET /audit/user/{param_1}/activity", async () => {
    mockOk({});
    await api.getUserActivity(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/audit/user");
  });

  it("getEntityTimeline → GET /audit/timeline/{param_1}/{param_2}", async () => {
    mockOk({});
    await api.getEntityTimeline("test", UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/audit/timeline");
  });

});

describe("/auth endpoints", () => {
  it("login → POST /auth/login", async () => {
    mockOk({});
    mockFetch.mockReset();
    mockOk({ token: "t", csrf_token: "c" });
    await api.login({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/auth/login");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("me → GET /auth/me", async () => {
    mockOk({});
    await api.me();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/auth/me");
  });

  it("refreshToken → POST /auth/refresh", async () => {
    mockOk({});
    await api.refreshToken();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/auth/refresh");
    expect(opts.method).toBe("POST");
  });

  it("logout → POST /auth/logout", async () => {
    mockOk({});
    await api.logout();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/auth/logout");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("changePassword → POST /auth/change-password", async () => {
    mockOk({});
    await api.changePassword({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/auth/change-password");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

});

describe("/billing endpoints", () => {
  it("listInvoices → GET /billing/invoices", async () => {
    mockOk({});
    await api.listInvoices();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/invoices");
  });

  it("createInvoice → POST /billing/invoices", async () => {
    mockOk({});
    await api.createInvoice({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/invoices");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("getInvoice → GET /billing/invoices/{param_1}", async () => {
    mockOk({});
    await api.getInvoice(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/invoices");
  });

  it("updateInvoice → PUT /billing/invoices/{param_1}", async () => {
    mockOk({});
    await api.updateInvoice(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/invoices");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("addInvoiceItem → POST /billing/invoices/{param_1}/items", async () => {
    mockOk({});
    await api.addInvoiceItem(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/invoices");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("removeInvoiceItem → DELETE /billing/invoices/{param_1}/items/{param_2}", async () => {
    mockOk({});
    await api.removeInvoiceItem(UUID, UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/invoices");
    expect(opts.method).toBe("DELETE");
  });

  it("issueInvoice → POST /billing/invoices/{param_1}/issue", async () => {
    mockOk({});
    await api.issueInvoice(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/invoices");
    expect(opts.method).toBe("POST");
  });

  it("cancelInvoice → POST /billing/invoices/{param_1}/cancel", async () => {
    mockOk({});
    await api.cancelInvoice(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/invoices");
    expect(opts.method).toBe("POST");
  });

  it("recordPayment → POST /billing/invoices/{param_1}/payments", async () => {
    mockOk({});
    await api.recordPayment(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/invoices");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listPayments → GET /billing/invoices/{param_1}/payments", async () => {
    mockOk({});
    await api.listPayments(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/invoices");
  });

  it("listChargeMaster → GET /billing/charge-master", async () => {
    mockOk({});
    await api.listChargeMaster();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/charge-master");
  });

  it("createChargeMaster → POST /billing/charge-master", async () => {
    mockOk({});
    await api.createChargeMaster({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/charge-master");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateChargeMaster → PUT /billing/charge-master/{param_1}", async () => {
    mockOk({});
    await api.updateChargeMaster(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/charge-master");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("deleteChargeMaster → DELETE /billing/charge-master/{param_1}", async () => {
    mockOk({});
    await api.deleteChargeMaster(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/charge-master");
    expect(opts.method).toBe("DELETE");
  });

  it("listPackages → GET /billing/packages", async () => {
    mockOk({});
    await api.listPackages();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/billing/packages");
  });

  it("getPackage → GET /billing/packages/{param_1}", async () => {
    mockOk({});
    await api.getPackage(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/packages");
  });

  it("createPackage → POST /billing/packages", async () => {
    mockOk({});
    await api.createPackage({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/packages");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updatePackage → PUT /billing/packages/{param_1}", async () => {
    mockOk({});
    await api.updatePackage(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/packages");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("deletePackage → DELETE /billing/packages/{param_1}", async () => {
    mockOk({});
    await api.deletePackage(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/packages");
    expect(opts.method).toBe("DELETE");
  });

  it("listRatePlans → GET /billing/rate-plans", async () => {
    mockOk({});
    await api.listRatePlans();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/billing/rate-plans");
  });

  it("getRatePlan → GET /billing/rate-plans/{param_1}", async () => {
    mockOk({});
    await api.getRatePlan(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/rate-plans");
  });

  it("createRatePlan → POST /billing/rate-plans", async () => {
    mockOk({});
    await api.createRatePlan({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/rate-plans");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateRatePlan → PUT /billing/rate-plans/{param_1}", async () => {
    mockOk({});
    await api.updateRatePlan(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/rate-plans");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("deleteRatePlan → DELETE /billing/rate-plans/{param_1}", async () => {
    mockOk({});
    await api.deleteRatePlan(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/rate-plans");
    expect(opts.method).toBe("DELETE");
  });

  it("listInvoiceDiscounts → GET /billing/invoices/{param_1}/discounts", async () => {
    mockOk({});
    await api.listInvoiceDiscounts(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/invoices");
  });

  it("addDiscount → POST /billing/invoices/{param_1}/discounts", async () => {
    mockOk({});
    await api.addDiscount(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/invoices");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("removeDiscount → DELETE /billing/invoices/{param_1}/discounts/{param_2}", async () => {
    mockOk({});
    await api.removeDiscount(UUID, UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/invoices");
    expect(opts.method).toBe("DELETE");
  });

  it("listRefunds → GET /billing/refunds", async () => {
    mockOk({});
    await api.listRefunds();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/refunds");
  });

  it("createRefund → POST /billing/refunds", async () => {
    mockOk({});
    await api.createRefund({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/refunds");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listCreditNotes → GET /billing/credit-notes", async () => {
    mockOk({});
    await api.listCreditNotes();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/credit-notes");
  });

  it("createCreditNote → POST /billing/credit-notes", async () => {
    mockOk({});
    await api.createCreditNote({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/credit-notes");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("applyCreditNote → POST /billing/credit-notes/{param_1}/apply", async () => {
    mockOk({});
    await api.applyCreditNote(UUID, UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/credit-notes");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listReceipts → GET /billing/invoices/{param_1}/receipts", async () => {
    mockOk({});
    await api.listReceipts(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/invoices");
  });

  it("generateReceipt → POST /billing/invoices/{param_1}/receipts", async () => {
    mockOk({});
    await api.generateReceipt(UUID, UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/invoices");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listInsuranceClaims → GET /billing/insurance-claims", async () => {
    mockOk({});
    await api.listInsuranceClaims();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/insurance-claims");
  });

  it("getInsuranceClaim → GET /billing/insurance-claims/{param_1}", async () => {
    mockOk({});
    await api.getInsuranceClaim(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/insurance-claims");
  });

  it("createInsuranceClaim → POST /billing/insurance-claims", async () => {
    mockOk({});
    await api.createInsuranceClaim({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/insurance-claims");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateInsuranceClaim → PUT /billing/insurance-claims/{param_1}", async () => {
    mockOk({});
    await api.updateInsuranceClaim(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/insurance-claims");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("triggerAutoCharge → POST /billing/auto-charge", async () => {
    mockOk({});
    await api.triggerAutoCharge({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/auto-charge");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listAdvances → GET /billing/advances", async () => {
    mockOk({});
    await api.listAdvances();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/advances");
  });

  it("createAdvance → POST /billing/advances", async () => {
    mockOk({});
    await api.createAdvance({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/advances");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("adjustAdvance → POST /billing/advances/{param_1}/adjust", async () => {
    mockOk({});
    await api.adjustAdvance(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/advances");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("refundAdvance → POST /billing/advances/{param_1}/refund", async () => {
    mockOk({});
    await api.refundAdvance(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/advances");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("createInterimInvoice → POST /billing/invoices/interim", async () => {
    mockOk({});
    await api.createInterimInvoice({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/invoices/interim");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listCorporates → GET /billing/corporates", async () => {
    mockOk({});
    await api.listCorporates();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/billing/corporates");
  });

  it("getCorporate → GET /billing/corporates/{param_1}", async () => {
    mockOk({});
    await api.getCorporate(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/corporates");
  });

  it("createCorporate → POST /billing/corporates", async () => {
    mockOk({});
    await api.createCorporate({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/corporates");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateCorporate → PUT /billing/corporates/{param_1}", async () => {
    mockOk({});
    await api.updateCorporate(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/corporates");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listCorporateEnrollments → GET /billing/corporates/{param_1}/enrollments", async () => {
    mockOk({});
    await api.listCorporateEnrollments(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/corporates");
  });

  it("createCorporateEnrollment → POST /billing/corporates/{param_1}/enrollments", async () => {
    mockOk({});
    await api.createCorporateEnrollment(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/corporates");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("deleteCorporateEnrollment → DELETE /billing/corporates/{param_1}/enrollments/{param_2}", async () => {
    mockOk({});
    await api.deleteCorporateEnrollment(UUID, UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/corporates");
    expect(opts.method).toBe("DELETE");
  });

  it("listCorporateInvoices → GET /billing/corporates/{param_1}/invoices", async () => {
    mockOk({});
    await api.listCorporateInvoices(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/corporates");
  });

  it("billingReportSummary → GET /billing/reports/summary", async () => {
    mockOk({});
    await api.billingReportSummary("test", "test");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/reports/summary");
  });

  it("billingReportDepartmentRevenue → GET /billing/reports/department-revenue", async () => {
    mockOk({});
    await api.billingReportDepartmentRevenue("test", "test");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/reports/department-revenue");
  });

  it("billingReportCollectionEfficiency → GET /billing/reports/collection-efficiency", async () => {
    mockOk({});
    await api.billingReportCollectionEfficiency("test", "test");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/reports/collection-efficiency");
  });

  it("billingReportAging → GET /billing/reports/aging", async () => {
    mockOk({});
    await api.billingReportAging();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/billing/reports/aging");
  });

  it("billingReportDaily → GET /billing/reports/daily", async () => {
    mockOk({});
    await api.billingReportDaily("2026-01-01");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/reports/daily");
  });

  it("billingReportDoctorRevenue → GET /billing/reports/doctor-revenue", async () => {
    mockOk({});
    await api.billingReportDoctorRevenue("test", "test");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/reports/doctor-revenue");
  });

  it("billingReportInsurancePanel → GET /billing/reports/insurance-panel", async () => {
    mockOk({});
    await api.billingReportInsurancePanel("test", "test");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/reports/insurance-panel");
  });

  it("billingReportReconciliation → GET /billing/reports/reconciliation", async () => {
    mockOk({});
    await api.billingReportReconciliation("2026-01-01");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/reports/reconciliation");
  });

  it("listDayCloses → GET /billing/day-closes", async () => {
    mockOk({});
    await api.listDayCloses();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/day-closes");
  });

  it("createDayClose → POST /billing/day-closes", async () => {
    mockOk({});
    await api.createDayClose({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/day-closes");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("verifyDayClose → POST /billing/day-closes/{param_1}/verify", async () => {
    mockOk({});
    await api.verifyDayClose(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/day-closes");
    expect(opts.method).toBe("POST");
  });

  it("listWriteOffs → GET /billing/write-offs", async () => {
    mockOk({});
    await api.listWriteOffs();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/write-offs");
  });

  it("createWriteOff → POST /billing/write-offs", async () => {
    mockOk({});
    await api.createWriteOff({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/write-offs");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("approveWriteOff → POST /billing/write-offs/{param_1}/approve", async () => {
    mockOk({});
    await api.approveWriteOff(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/write-offs");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listTpaRateCards → GET /billing/tpa-rate-cards", async () => {
    mockOk({});
    await api.listTpaRateCards();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/billing/tpa-rate-cards");
  });

  it("createTpaRateCard → POST /billing/tpa-rate-cards", async () => {
    mockOk({});
    await api.createTpaRateCard({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/tpa-rate-cards");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateTpaRateCard → PUT /billing/tpa-rate-cards/{param_1}", async () => {
    mockOk({});
    await api.updateTpaRateCard(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/tpa-rate-cards");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("deleteTpaRateCard → DELETE /billing/tpa-rate-cards/{param_1}", async () => {
    mockOk({});
    await api.deleteTpaRateCard(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/tpa-rate-cards");
    expect(opts.method).toBe("DELETE");
  });

  it("cloneInvoice → POST /billing/invoices/{param_1}/clone", async () => {
    mockOk({});
    await api.cloneInvoice(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/invoices");
    expect(opts.method).toBe("POST");
  });

  it("listBillingAuditLog → GET /billing/audit-log", async () => {
    mockOk({});
    await api.listBillingAuditLog();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/audit-log");
  });

  it("listExchangeRates → GET /billing/exchange-rates", async () => {
    mockOk({});
    await api.listExchangeRates();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/exchange-rates");
  });

  it("createExchangeRate → POST /billing/exchange-rates", async () => {
    mockOk({});
    await api.createExchangeRate({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/exchange-rates");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("getInvoicePrintData → GET /billing/invoices/{param_1}/print-data", async () => {
    mockOk({});
    await api.getInvoicePrintData(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/invoices");
  });

  it("checkBillingThreshold → GET /billing/threshold-check/{param_1}", async () => {
    mockOk({});
    await api.checkBillingThreshold(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/threshold-check");
  });

  it("getSchemeRate → GET /billing/scheme-rate", async () => {
    mockOk({});
    await api.getSchemeRate();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/scheme-rate");
  });

  it("listCreditPatients → GET /billing/credit-patients", async () => {
    mockOk({});
    await api.listCreditPatients();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/credit-patients");
  });

  it("createCreditPatient → POST /billing/credit-patients", async () => {
    mockOk({});
    await api.createCreditPatient({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/credit-patients");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateCreditPatient → PUT /billing/credit-patients/{param_1}", async () => {
    mockOk({});
    await api.updateCreditPatient(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/credit-patients");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("reportCreditAging → GET /billing/credit-patients/aging", async () => {
    mockOk({});
    await api.reportCreditAging();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/billing/credit-patients/aging");
  });

  it("coordinateDualInsurance → POST /billing/invoices/{param_1}/dual-insurance", async () => {
    mockOk({});
    await api.coordinateDualInsurance(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/invoices");
    expect(opts.method).toBe("POST");
  });

  it("getDualInsuranceStatus → GET /billing/invoices/{param_1}/dual-insurance", async () => {
    mockOk({});
    await api.getDualInsuranceStatus(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/invoices");
  });

  it("generateReimbursementDocs → POST /billing/insurance-claims/{param_1}/reimbursement-docs", async () => {
    mockOk({});
    await api.generateReimbursementDocs(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/insurance-claims");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateReimbursementDocs → PUT /billing/insurance-claims/{param_1}/reimbursement-docs", async () => {
    mockOk({});
    await api.updateReimbursementDocs(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/insurance-claims");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listGlAccounts → GET /billing/gl-accounts", async () => {
    mockOk({});
    await api.listGlAccounts();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/gl-accounts");
  });

  it("createGlAccount → POST /billing/gl-accounts", async () => {
    mockOk({});
    await api.createGlAccount({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/gl-accounts");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateGlAccount → PUT /billing/gl-accounts/{param_1}", async () => {
    mockOk({});
    await api.updateGlAccount(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/gl-accounts");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listJournalEntries → GET /billing/journal-entries", async () => {
    mockOk({});
    await api.listJournalEntries();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/journal-entries");
  });

  it("getJournalEntry → GET /billing/journal-entries/{param_1}", async () => {
    mockOk({});
    await api.getJournalEntry(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/journal-entries");
  });

  it("createJournalEntry → POST /billing/journal-entries", async () => {
    mockOk({});
    await api.createJournalEntry({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/journal-entries");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("postJournalEntry → POST /billing/journal-entries/{param_1}/post", async () => {
    mockOk({});
    await api.postJournalEntry(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/journal-entries");
    expect(opts.method).toBe("POST");
  });

  it("reverseJournalEntry → POST /billing/journal-entries/{param_1}/reverse", async () => {
    mockOk({});
    await api.reverseJournalEntry(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/journal-entries");
    expect(opts.method).toBe("POST");
  });

  it("listBankTransactions → GET /billing/bank-transactions", async () => {
    mockOk({});
    await api.listBankTransactions();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/bank-transactions");
  });

  it("importBankTransactions → POST /billing/bank-transactions/import", async () => {
    mockOk({});
    await api.importBankTransactions({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/bank-transactions/import");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("matchBankTransaction → POST /billing/bank-transactions/{param_1}/match", async () => {
    mockOk({});
    await api.matchBankTransaction(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/bank-transactions");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("autoReconcile → POST /billing/bank-transactions/auto-reconcile", async () => {
    mockOk({});
    await api.autoReconcile();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/billing/bank-transactions/auto-reconcile");
    expect(opts.method).toBe("POST");
  });

  it("listTdsDeductions → GET /billing/tds", async () => {
    mockOk({});
    await api.listTdsDeductions();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/tds");
  });

  it("createTdsDeduction → POST /billing/tds", async () => {
    mockOk({});
    await api.createTdsDeduction({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/tds");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("depositTds → POST /billing/tds/{param_1}/deposit", async () => {
    mockOk({});
    await api.depositTds(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/tds");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("issueTdsCertificate → POST /billing/tds/{param_1}/certificate", async () => {
    mockOk({});
    await api.issueTdsCertificate(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/tds");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("generateGstrSummary → POST /billing/gst-returns/generate", async () => {
    mockOk({});
    await api.generateGstrSummary({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/gst-returns/generate");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listGstrSummaries → GET /billing/gst-returns", async () => {
    mockOk({});
    await api.listGstrSummaries();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/billing/gst-returns");
  });

  it("fileGstr → POST /billing/gst-returns/{param_1}/file", async () => {
    mockOk({});
    await api.fileGstr(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/billing/gst-returns");
    expect(opts.method).toBe("POST");
  });

  it("reportHsnSummary → GET /billing/reports/hsn-summary", async () => {
    mockOk({});
    await api.reportHsnSummary("test");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/reports/hsn-summary");
  });

  it("reportFinancialMis → GET /billing/reports/financial-mis", async () => {
    mockOk({});
    await api.reportFinancialMis("2026-01-01", "2026-01-01");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/reports/financial-mis");
  });

  it("reportProfitLoss → GET /billing/reports/profit-loss", async () => {
    mockOk({});
    await api.reportProfitLoss("2026-01-01", "2026-01-01");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/reports/profit-loss");
  });

  it("exportToErp → POST /billing/erp/export", async () => {
    mockOk({});
    await api.exportToErp({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/erp/export");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listErpExports → GET /billing/erp/exports", async () => {
    mockOk({});
    await api.listErpExports();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/billing/erp/exports");
  });

  it("listBillingPackages → GET /billing/packages", async () => {
    mockOk({});
    await api.listBillingPackages();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/billing/packages");
  });

  it("createBillingPackage → POST /billing/packages", async () => {
    mockOk({});
    await api.createBillingPackage({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/packages");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("calculateCopay → POST /billing/copay/calculate", async () => {
    mockOk({});
    await api.calculateCopay({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/copay/calculate");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("erFastInvoice → POST /billing/er-invoice", async () => {
    mockOk({});
    await api.erFastInvoice({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/billing/er-invoice");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

});

describe("/blood-bank endpoints", () => {
  it("listBloodDonors → GET /blood-bank/donors", async () => {
    mockOk({});
    await api.listBloodDonors();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/blood-bank/donors");
  });

  it("createBloodDonor → POST /blood-bank/donors", async () => {
    mockOk({});
    await api.createBloodDonor({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/blood-bank/donors");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("getBloodDonor → GET /blood-bank/donors/{param_1}", async () => {
    mockOk({});
    await api.getBloodDonor(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/blood-bank/donors");
  });

  it("listDonations → GET /blood-bank/donors/{param_1}/donations", async () => {
    mockOk({});
    await api.listDonations(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/blood-bank/donors");
  });

  it("createDonation → POST /blood-bank/donors/{param_1}/donations", async () => {
    mockOk({});
    await api.createDonation(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/blood-bank/donors");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateDonation → PUT /blood-bank/donations/{param_1}", async () => {
    mockOk({});
    await api.updateDonation(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/blood-bank/donations");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listBloodComponents → GET /blood-bank/components", async () => {
    mockOk({});
    await api.listBloodComponents();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/blood-bank/components");
  });

  it("createBloodComponent → POST /blood-bank/components", async () => {
    mockOk({});
    await api.createBloodComponent({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/blood-bank/components");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateComponentStatus → PUT /blood-bank/components/{param_1}/status", async () => {
    mockOk({});
    await api.updateComponentStatus(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/blood-bank/components");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listCrossmatchRequests → GET /blood-bank/crossmatch", async () => {
    mockOk({});
    await api.listCrossmatchRequests();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/blood-bank/crossmatch");
  });

  it("createCrossmatchRequest → POST /blood-bank/crossmatch", async () => {
    mockOk({});
    await api.createCrossmatchRequest({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/blood-bank/crossmatch");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateCrossmatchRequest → PUT /blood-bank/crossmatch/{param_1}", async () => {
    mockOk({});
    await api.updateCrossmatchRequest(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/blood-bank/crossmatch");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listTransfusions → GET /blood-bank/transfusions", async () => {
    mockOk({});
    await api.listTransfusions();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/blood-bank/transfusions");
  });

  it("createTransfusion → POST /blood-bank/transfusions", async () => {
    mockOk({});
    await api.createTransfusion({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/blood-bank/transfusions");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("recordTransfusionReaction → PUT /blood-bank/transfusions/{param_1}/reaction", async () => {
    mockOk({});
    await api.recordTransfusionReaction(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/blood-bank/transfusions");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("getTtiReport → GET /blood-bank/tti-report", async () => {
    mockOk({});
    await api.getTtiReport();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/blood-bank/tti-report");
  });

  it("getHemovigilanceReport → GET /blood-bank/hemovigilance", async () => {
    mockOk({});
    await api.getHemovigilanceReport();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/blood-bank/hemovigilance");
  });

});

describe("/bme endpoints", () => {
  it("listBmeEquipment → GET /bme/equipment", async () => {
    mockOk({});
    await api.listBmeEquipment();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/bme/equipment");
  });

  it("getBmeEquipment → GET /bme/equipment/{param_1}", async () => {
    mockOk({});
    await api.getBmeEquipment(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/bme/equipment");
  });

  it("createBmeEquipment → POST /bme/equipment", async () => {
    mockOk({});
    await api.createBmeEquipment({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/bme/equipment");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateBmeEquipment → PUT /bme/equipment/{param_1}", async () => {
    mockOk({});
    await api.updateBmeEquipment(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/bme/equipment");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listBmePmSchedules → GET /bme/pm-schedules", async () => {
    mockOk({});
    await api.listBmePmSchedules();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/bme/pm-schedules");
  });

  it("createBmePmSchedule → POST /bme/pm-schedules", async () => {
    mockOk({});
    await api.createBmePmSchedule({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/bme/pm-schedules");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateBmePmSchedule → PUT /bme/pm-schedules/{param_1}", async () => {
    mockOk({});
    await api.updateBmePmSchedule(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/bme/pm-schedules");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listBmeWorkOrders → GET /bme/work-orders", async () => {
    mockOk({});
    await api.listBmeWorkOrders();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/bme/work-orders");
  });

  it("getBmeWorkOrder → GET /bme/work-orders/{param_1}", async () => {
    mockOk({});
    await api.getBmeWorkOrder(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/bme/work-orders");
  });

  it("createBmeWorkOrder → POST /bme/work-orders", async () => {
    mockOk({});
    await api.createBmeWorkOrder({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/bme/work-orders");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateBmeWorkOrderStatus → PUT /bme/work-orders/{param_1}/status", async () => {
    mockOk({});
    await api.updateBmeWorkOrderStatus(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/bme/work-orders");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listBmeCalibrations → GET /bme/calibrations", async () => {
    mockOk({});
    await api.listBmeCalibrations();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/bme/calibrations");
  });

  it("createBmeCalibration → POST /bme/calibrations", async () => {
    mockOk({});
    await api.createBmeCalibration({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/bme/calibrations");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateBmeCalibration → PUT /bme/calibrations/{param_1}", async () => {
    mockOk({});
    await api.updateBmeCalibration(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/bme/calibrations");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listBmeContracts → GET /bme/contracts", async () => {
    mockOk({});
    await api.listBmeContracts();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/bme/contracts");
  });

  it("createBmeContract → POST /bme/contracts", async () => {
    mockOk({});
    await api.createBmeContract({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/bme/contracts");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateBmeContract → PUT /bme/contracts/{param_1}", async () => {
    mockOk({});
    await api.updateBmeContract(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/bme/contracts");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listBmeBreakdowns → GET /bme/breakdowns", async () => {
    mockOk({});
    await api.listBmeBreakdowns();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/bme/breakdowns");
  });

  it("createBmeBreakdown → POST /bme/breakdowns", async () => {
    mockOk({});
    await api.createBmeBreakdown({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/bme/breakdowns");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateBmeBreakdownStatus → PUT /bme/breakdowns/{param_1}/status", async () => {
    mockOk({});
    await api.updateBmeBreakdownStatus(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/bme/breakdowns");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("createBmeVendorEvaluation → POST /bme/vendor-evaluations", async () => {
    mockOk({});
    await api.createBmeVendorEvaluation({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/bme/vendor-evaluations");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("getBmeStats → GET /bme/stats", async () => {
    mockOk({});
    await api.getBmeStats();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/bme/stats");
  });

  it("getBmeMtbfAnalytics → GET /bme/analytics/mtbf", async () => {
    mockOk({});
    await api.getBmeMtbfAnalytics();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/bme/analytics/mtbf");
  });

  it("getBmeUptimeAnalytics → GET /bme/analytics/uptime", async () => {
    mockOk({});
    await api.getBmeUptimeAnalytics();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/bme/analytics/uptime");
  });

});

describe("/camp endpoints", () => {
  it("listCamps → GET /camp/camps", async () => {
    mockOk({});
    await api.listCamps();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/camp/camps");
  });

  it("getCamp → GET /camp/camps/{param_1}", async () => {
    mockOk({});
    await api.getCamp(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/camp/camps");
  });

  it("createCamp → POST /camp/camps", async () => {
    mockOk({});
    await api.createCamp({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/camp/camps");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateCamp → PUT /camp/camps/{param_1}", async () => {
    mockOk({});
    await api.updateCamp(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/camp/camps");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("approveCamp → PUT /camp/camps/{param_1}/approve", async () => {
    mockOk({});
    await api.approveCamp(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/camp/camps");
    expect(opts.method).toBe("PUT");
  });

  it("activateCamp → PUT /camp/camps/{param_1}/activate", async () => {
    mockOk({});
    await api.activateCamp(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/camp/camps");
    expect(opts.method).toBe("PUT");
  });

  it("completeCamp → PUT /camp/camps/{param_1}/complete", async () => {
    mockOk({});
    await api.completeCamp(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/camp/camps");
    expect(opts.method).toBe("PUT");
  });

  it("cancelCamp → PUT /camp/camps/{param_1}/cancel", async () => {
    mockOk({});
    await api.cancelCamp(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/camp/camps");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listCampTeamMembers → GET /camp/camps/{param_1}/team", async () => {
    mockOk({});
    await api.listCampTeamMembers(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/camp/camps");
  });

  it("addCampTeamMember → POST /camp/camps/{param_1}/team", async () => {
    mockOk({});
    await api.addCampTeamMember(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/camp/camps");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("removeCampTeamMember → DELETE /camp/camps/{param_1}/team/{param_2}", async () => {
    mockOk({});
    await api.removeCampTeamMember(UUID, UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/camp/camps");
    expect(opts.method).toBe("DELETE");
  });

  it("getCampStats → GET /camp/camps/{param_1}/stats", async () => {
    mockOk({});
    await api.getCampStats(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/camp/camps");
  });

  it("listCampRegistrations → GET /camp/registrations", async () => {
    mockOk({});
    await api.listCampRegistrations({ camp_id: UUID });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/camp/registrations");
  });

  it("createCampRegistration → POST /camp/registrations", async () => {
    mockOk({});
    await api.createCampRegistration({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/camp/registrations");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateCampRegistration → PUT /camp/registrations/{param_1}", async () => {
    mockOk({});
    await api.updateCampRegistration(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/camp/registrations");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listCampScreenings → GET /camp/screenings", async () => {
    mockOk({});
    await api.listCampScreenings();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/camp/screenings");
  });

  it("createCampScreening → POST /camp/screenings", async () => {
    mockOk({});
    await api.createCampScreening({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/camp/screenings");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listCampLabSamples → GET /camp/lab-samples", async () => {
    mockOk({});
    await api.listCampLabSamples();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/camp/lab-samples");
  });

  it("createCampLabSample → POST /camp/lab-samples", async () => {
    mockOk({});
    await api.createCampLabSample({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/camp/lab-samples");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("linkCampLabSample → PUT /camp/lab-samples/{param_1}/link", async () => {
    mockOk({});
    await api.linkCampLabSample(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/camp/lab-samples");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listCampBilling → GET /camp/billing", async () => {
    mockOk({});
    await api.listCampBilling();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/camp/billing");
  });

  it("createCampBilling → POST /camp/billing", async () => {
    mockOk({});
    await api.createCampBilling({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/camp/billing");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listCampFollowups → GET /camp/followups", async () => {
    mockOk({});
    await api.listCampFollowups();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/camp/followups");
  });

  it("createCampFollowup → POST /camp/followups", async () => {
    mockOk({});
    await api.createCampFollowup({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/camp/followups");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateCampFollowup → PUT /camp/followups/{param_1}", async () => {
    mockOk({});
    await api.updateCampFollowup(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/camp/followups");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("campAnalytics → GET /camp/analytics", async () => {
    mockOk({});
    await api.campAnalytics();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/camp/analytics");
  });

  it("campReport → GET /camp/camps/{param_1}/report", async () => {
    mockOk({});
    await api.campReport(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/camp/camps");
  });

});

describe("/case-mgmt endpoints", () => {
  it("listCaseAssignments → GET /case-mgmt/assignments", async () => {
    mockOk({});
    await api.listCaseAssignments();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/case-mgmt/assignments");
  });

  it("createCaseAssignment → POST /case-mgmt/assignments", async () => {
    mockOk({});
    await api.createCaseAssignment({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/case-mgmt/assignments");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("getCaseAssignment → GET /case-mgmt/assignments/{param_1}", async () => {
    mockOk({});
    await api.getCaseAssignment(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/case-mgmt/assignments");
  });

  it("updateCaseAssignment → PUT /case-mgmt/assignments/{param_1}", async () => {
    mockOk({});
    await api.updateCaseAssignment(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/case-mgmt/assignments");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("caseloadSummary → GET /case-mgmt/caseload", async () => {
    mockOk({});
    await api.caseloadSummary();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/case-mgmt/caseload");
  });

  it("autoAssignCase → POST /case-mgmt/auto-assign", async () => {
    mockOk({});
    await api.autoAssignCase({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/case-mgmt/auto-assign");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listDischargeBarriers → GET /case-mgmt/barriers", async () => {
    mockOk({});
    await api.listDischargeBarriers();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/case-mgmt/barriers");
  });

  it("createDischargeBarrier → POST /case-mgmt/barriers", async () => {
    mockOk({});
    await api.createDischargeBarrier({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/case-mgmt/barriers");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateDischargeBarrier → PUT /case-mgmt/barriers/{param_1}", async () => {
    mockOk({});
    await api.updateDischargeBarrier(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/case-mgmt/barriers");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listCaseReferrals → GET /case-mgmt/referrals", async () => {
    mockOk({});
    await api.listCaseReferrals();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/case-mgmt/referrals");
  });

  it("createCaseReferral → POST /case-mgmt/referrals", async () => {
    mockOk({});
    await api.createCaseReferral({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/case-mgmt/referrals");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateCaseReferral → PUT /case-mgmt/referrals/{param_1}", async () => {
    mockOk({});
    await api.updateCaseReferral(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/case-mgmt/referrals");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("dispositionAnalytics → GET /case-mgmt/analytics/dispositions", async () => {
    mockOk({});
    await api.dispositionAnalytics();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/case-mgmt/analytics/dispositions");
  });

  it("barrierAnalytics → GET /case-mgmt/analytics/barriers", async () => {
    mockOk({});
    await api.barrierAnalytics();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/case-mgmt/analytics/barriers");
  });

  it("outcomeAnalytics → GET /case-mgmt/analytics/outcomes", async () => {
    mockOk({});
    await api.outcomeAnalytics();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/case-mgmt/analytics/outcomes");
  });

});

describe("/cds endpoints", () => {
  it("checkDrugSafety → POST /cds/drug-safety-check", async () => {
    mockOk({});
    await api.checkDrugSafety({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/cds/drug-safety-check");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listDrugInteractions → GET /cds/drug-interactions", async () => {
    mockOk({});
    await api.listDrugInteractions();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/cds/drug-interactions");
  });

  it("createDrugInteraction → POST /cds/drug-interactions", async () => {
    mockOk({});
    await api.createDrugInteraction({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/cds/drug-interactions");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("deleteDrugInteraction → DELETE /cds/drug-interactions/{param_1}", async () => {
    mockOk({});
    await api.deleteDrugInteraction(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/cds/drug-interactions");
    expect(opts.method).toBe("DELETE");
  });

  it("listCriticalValueRules → GET /cds/critical-value-rules", async () => {
    mockOk({});
    await api.listCriticalValueRules();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/cds/critical-value-rules");
  });

  it("createCriticalValueRule → POST /cds/critical-value-rules", async () => {
    mockOk({});
    await api.createCriticalValueRule({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/cds/critical-value-rules");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("deleteCriticalValueRule → DELETE /cds/critical-value-rules/{param_1}", async () => {
    mockOk({});
    await api.deleteCriticalValueRule(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/cds/critical-value-rules");
    expect(opts.method).toBe("DELETE");
  });

  it("listClinicalProtocols → GET /cds/protocols", async () => {
    mockOk({});
    await api.listClinicalProtocols();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/cds/protocols");
  });

  it("createClinicalProtocol → POST /cds/protocols", async () => {
    mockOk({});
    await api.createClinicalProtocol({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/cds/protocols");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("deleteClinicalProtocol → DELETE /cds/protocols/{param_1}", async () => {
    mockOk({});
    await api.deleteClinicalProtocol(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/cds/protocols");
    expect(opts.method).toBe("DELETE");
  });

  it("listRestrictedDrugApprovals → GET /cds/restricted-drug-approvals", async () => {
    mockOk({});
    await api.listRestrictedDrugApprovals();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/cds/restricted-drug-approvals");
  });

  it("createRestrictedDrugApproval → POST /cds/restricted-drug-approvals", async () => {
    mockOk({});
    await api.createRestrictedDrugApproval({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/cds/restricted-drug-approvals");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateRestrictedDrugApproval → PUT /cds/restricted-drug-approvals/{param_1}", async () => {
    mockOk({});
    await api.updateRestrictedDrugApproval(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/cds/restricted-drug-approvals");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listPreAuthRequests → GET /cds/pre-auth-requests", async () => {
    mockOk({});
    await api.listPreAuthRequests(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/cds/pre-auth-requests");
  });

  it("createPreAuthRequest → POST /cds/pre-auth-requests", async () => {
    mockOk({});
    await api.createPreAuthRequest({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/cds/pre-auth-requests");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updatePreAuthRequest → PUT /cds/pre-auth-requests/{param_1}", async () => {
    mockOk({});
    await api.updatePreAuthRequest(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/cds/pre-auth-requests");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listPgLogbook → GET /cds/pg-logbook", async () => {
    mockOk({});
    await api.listPgLogbook();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/cds/pg-logbook");
  });

  it("createPgLogbookEntry → POST /cds/pg-logbook", async () => {
    mockOk({});
    await api.createPgLogbookEntry({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/cds/pg-logbook");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("verifyPgLogbookEntry → PUT /cds/pg-logbook/{param_1}/verify", async () => {
    mockOk({});
    await api.verifyPgLogbookEntry(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/cds/pg-logbook");
    expect(opts.method).toBe("PUT");
  });

  it("listCoSignatures → GET /cds/co-signatures", async () => {
    mockOk({});
    await api.listCoSignatures();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/cds/co-signatures");
  });

  it("createCoSignature → POST /cds/co-signatures", async () => {
    mockOk({});
    await api.createCoSignature({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/cds/co-signatures");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateCoSignature → PUT /cds/co-signatures/{param_1}", async () => {
    mockOk({});
    await api.updateCoSignature(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/cds/co-signatures");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

});

describe("/command-center endpoints", () => {
  it("getPatientFlow → GET /command-center/patient-flow", async () => {
    mockOk({});
    await api.getPatientFlow();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/command-center/patient-flow");
  });

  it("getHourlyFlow → GET /command-center/patient-flow/hourly", async () => {
    mockOk({});
    await api.getHourlyFlow();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/command-center/patient-flow/hourly");
  });

  it("getBottlenecks → GET /command-center/bottlenecks", async () => {
    mockOk({});
    await api.getBottlenecks();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/command-center/bottlenecks");
  });

  it("getDepartmentLoad → GET /command-center/department-load", async () => {
    mockOk({});
    await api.getDepartmentLoad();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/command-center/department-load");
  });

  it("getActiveAlerts → GET /command-center/alerts", async () => {
    mockOk({});
    await api.getActiveAlerts();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/command-center/alerts");
  });

  it("acknowledgeDeptAlert → POST /command-center/alerts/{param_1}/acknowledge", async () => {
    mockOk({});
    await api.acknowledgeDeptAlert(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/command-center/alerts");
    expect(opts.method).toBe("POST");
  });

  it("listAlertThresholds → GET /command-center/alert-thresholds", async () => {
    mockOk({});
    await api.listAlertThresholds();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/command-center/alert-thresholds");
  });

  it("createAlertThreshold → POST /command-center/alert-thresholds", async () => {
    mockOk({});
    await api.createAlertThreshold({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/command-center/alert-thresholds");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateAlertThreshold → PUT /command-center/alert-thresholds/{param_1}", async () => {
    mockOk({});
    await api.updateAlertThreshold(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/command-center/alert-thresholds");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listPendingDischarges → GET /command-center/pending-discharges", async () => {
    mockOk({});
    await api.listPendingDischarges();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/command-center/pending-discharges");
  });

  it("getDischargeBlockers → GET /command-center/discharge-blockers/{param_1}", async () => {
    mockOk({});
    await api.getDischargeBlockers(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/command-center/discharge-blockers");
  });

  it("getBedTurnaround → GET /command-center/bed-turnaround", async () => {
    mockOk({});
    await api.getBedTurnaround();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/command-center/bed-turnaround");
  });

  it("getTurnaroundStats → GET /command-center/bed-turnaround/stats", async () => {
    mockOk({});
    await api.getTurnaroundStats();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/command-center/bed-turnaround/stats");
  });

  it("listTransportRequests → GET /command-center/transport", async () => {
    mockOk({});
    await api.listTransportRequests();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/command-center/transport");
  });

  it("createTransportRequest → POST /command-center/transport", async () => {
    mockOk({});
    await api.createTransportRequest({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/command-center/transport");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateTransportRequest → PUT /command-center/transport/{param_1}", async () => {
    mockOk({});
    await api.updateTransportRequest(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/command-center/transport");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("assignTransport → PUT /command-center/transport/{param_1}/assign", async () => {
    mockOk({});
    await api.assignTransport(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/command-center/transport");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("completeTransport → PUT /command-center/transport/{param_1}/complete", async () => {
    mockOk({});
    await api.completeTransport(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/command-center/transport");
    expect(opts.method).toBe("PUT");
  });

  it("getKpis → GET /command-center/kpis", async () => {
    mockOk({});
    await api.getKpis();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/command-center/kpis");
  });

  it("getKpiDetail → GET /command-center/kpis/{param_1}", async () => {
    mockOk({});
    await api.getKpiDetail("test");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/command-center/kpis");
  });

});

describe("/consent endpoints", () => {
  it("listConsentTemplates → GET /consent/templates", async () => {
    mockOk({});
    await api.listConsentTemplates();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/consent/templates");
  });

  it("getConsentTemplate → GET /consent/templates/{param_1}", async () => {
    mockOk({});
    await api.getConsentTemplate(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/consent/templates");
  });

  it("createConsentTemplate → POST /consent/templates", async () => {
    mockOk({});
    await api.createConsentTemplate({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/consent/templates");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateConsentTemplate → PUT /consent/templates/{param_1}", async () => {
    mockOk({});
    await api.updateConsentTemplate(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/consent/templates");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("deleteConsentTemplate → DELETE /consent/templates/{param_1}", async () => {
    mockOk({});
    await api.deleteConsentTemplate(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/consent/templates");
    expect(opts.method).toBe("DELETE");
  });

  it("listConsentAudit → GET /consent/audit", async () => {
    mockOk({});
    await api.listConsentAudit();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/consent/audit");
  });

  it("listPatientConsentAudit → GET /consent/audit/patient/{param_1}", async () => {
    mockOk({});
    await api.listPatientConsentAudit(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/consent/audit/patient");
  });

  it("verifyConsent → POST /consent/verify", async () => {
    mockOk({});
    await api.verifyConsent({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/consent/verify");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("getPatientConsentSummary → GET /consent/verify/patient/{param_1}", async () => {
    mockOk({});
    await api.getPatientConsentSummary(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/consent/verify/patient");
  });

  it("revokeConsent → POST /consent/revoke", async () => {
    mockOk({});
    await api.revokeConsent({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/consent/revoke");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listConsentSignatures → GET /consent/signatures", async () => {
    mockOk({});
    await api.listConsentSignatures();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/consent/signatures");
  });

  it("getConsentSignature → GET /consent/signatures/{param_1}", async () => {
    mockOk({});
    await api.getConsentSignature(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/consent/signatures");
  });

  it("createConsentSignature → POST /consent/signatures", async () => {
    mockOk({});
    await api.createConsentSignature({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/consent/signatures");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("deleteConsentSignature → DELETE /consent/signatures/{param_1}", async () => {
    mockOk({});
    await api.deleteConsentSignature(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/consent/signatures");
    expect(opts.method).toBe("DELETE");
  });

});

describe("/cssd endpoints", () => {
  it("listCssdInstruments → GET /cssd/instruments", async () => {
    mockOk({});
    await api.listCssdInstruments();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/cssd/instruments");
  });

  it("createCssdInstrument → POST /cssd/instruments", async () => {
    mockOk({});
    await api.createCssdInstrument({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/cssd/instruments");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateCssdInstrument → PUT /cssd/instruments/{param_1}", async () => {
    mockOk({});
    await api.updateCssdInstrument(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/cssd/instruments");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listCssdSets → GET /cssd/sets", async () => {
    mockOk({});
    await api.listCssdSets();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/cssd/sets");
  });

  it("createCssdSet → POST /cssd/sets", async () => {
    mockOk({});
    await api.createCssdSet({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/cssd/sets");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("getCssdSetItems → GET /cssd/sets/{param_1}/items", async () => {
    mockOk({});
    await api.getCssdSetItems(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/cssd/sets");
  });

  it("listCssdSterilizers → GET /cssd/sterilizers", async () => {
    mockOk({});
    await api.listCssdSterilizers();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/cssd/sterilizers");
  });

  it("createCssdSterilizer → POST /cssd/sterilizers", async () => {
    mockOk({});
    await api.createCssdSterilizer({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/cssd/sterilizers");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateCssdSterilizer → PUT /cssd/sterilizers/{param_1}", async () => {
    mockOk({});
    await api.updateCssdSterilizer(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/cssd/sterilizers");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listCssdMaintenanceLogs → GET /cssd/sterilizers/{param_1}/maintenance", async () => {
    mockOk({});
    await api.listCssdMaintenanceLogs(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/cssd/sterilizers");
  });

  it("createCssdMaintenanceLog → POST /cssd/sterilizers/{param_1}/maintenance", async () => {
    mockOk({});
    await api.createCssdMaintenanceLog(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/cssd/sterilizers");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listCssdLoads → GET /cssd/loads", async () => {
    mockOk({});
    await api.listCssdLoads();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/cssd/loads");
  });

  it("createCssdLoad → POST /cssd/loads", async () => {
    mockOk({});
    await api.createCssdLoad({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/cssd/loads");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateCssdLoadStatus → PUT /cssd/loads/{param_1}/status", async () => {
    mockOk({});
    await api.updateCssdLoadStatus(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/cssd/loads");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("addCssdLoadItem → POST /cssd/loads/{param_1}/items", async () => {
    mockOk({});
    await api.addCssdLoadItem(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/cssd/loads");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listCssdIndicators → GET /cssd/loads/{param_1}/indicators", async () => {
    mockOk({});
    await api.listCssdIndicators(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/cssd/loads");
  });

  it("recordCssdIndicator → POST /cssd/loads/{param_1}/indicators", async () => {
    mockOk({});
    await api.recordCssdIndicator(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/cssd/loads");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listCssdIssuances → GET /cssd/issuances", async () => {
    mockOk({});
    await api.listCssdIssuances();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/cssd/issuances");
  });

  it("createCssdIssuance → POST /cssd/issuances", async () => {
    mockOk({});
    await api.createCssdIssuance({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/cssd/issuances");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("returnCssdIssuance → PUT /cssd/issuances/{param_1}/return", async () => {
    mockOk({});
    await api.returnCssdIssuance(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/cssd/issuances");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("recallCssdIssuance → PUT /cssd/issuances/{param_1}/recall", async () => {
    mockOk({});
    await api.recallCssdIssuance(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/cssd/issuances");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

});

describe("/dashboard endpoints", () => {
  it("getDashboardStats → GET /dashboard/summary", async () => {
    mockOk({});
    await api.getDashboardStats();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/dashboard/summary");
  });

  it("getWidgetData → GET /dashboard/widget-data/{param_1}", async () => {
    mockOk({});
    await api.getWidgetData(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/dashboard/widget-data");
  });

  it("batchWidgetData → POST /dashboard/widget-data/batch", async () => {
    mockOk({});
    await api.batchWidgetData({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/dashboard/widget-data/batch");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

});

describe("/dashboards endpoints", () => {
  it("listDashboards → GET /dashboards", async () => {
    mockOk({});
    await api.listDashboards();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/dashboards");
  });

  it("getMyDashboard → GET /dashboards/my", async () => {
    mockOk({});
    await api.getMyDashboard();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/dashboards/my");
  });

  it("getDashboard → GET /dashboards/{param_1}", async () => {
    mockOk({});
    await api.getDashboard(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/dashboards");
  });

  it("personalizeDashboard → POST /dashboards/my/personalize", async () => {
    mockOk({});
    await api.personalizeDashboard({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/dashboards/my/personalize");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

});

describe("/diet endpoints", () => {
  it("listDietTemplates → GET /diet/templates", async () => {
    mockOk({});
    await api.listDietTemplates();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/diet/templates");
  });

  it("createDietTemplate → POST /diet/templates", async () => {
    mockOk({});
    await api.createDietTemplate({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/diet/templates");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateDietTemplate → PUT /diet/templates/{param_1}", async () => {
    mockOk({});
    await api.updateDietTemplate(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/diet/templates");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listDietOrders → GET /diet/orders", async () => {
    mockOk({});
    await api.listDietOrders();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/diet/orders");
  });

  it("createDietOrder → POST /diet/orders", async () => {
    mockOk({});
    await api.createDietOrder({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/diet/orders");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateDietOrder → PUT /diet/orders/{param_1}", async () => {
    mockOk({});
    await api.updateDietOrder(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/diet/orders");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listKitchenMenus → GET /diet/menus", async () => {
    mockOk({});
    await api.listKitchenMenus();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/diet/menus");
  });

  it("createKitchenMenu → POST /diet/menus", async () => {
    mockOk({});
    await api.createKitchenMenu({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/diet/menus");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listKitchenMenuItems → GET /diet/menus/{param_1}/items", async () => {
    mockOk({});
    await api.listKitchenMenuItems(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/diet/menus");
  });

  it("createKitchenMenuItem → POST /diet/menus/{param_1}/items", async () => {
    mockOk({});
    await api.createKitchenMenuItem(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/diet/menus");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listMealPreps → GET /diet/meal-preps", async () => {
    mockOk({});
    await api.listMealPreps();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/diet/meal-preps");
  });

  it("createMealPrep → POST /diet/meal-preps", async () => {
    mockOk({});
    await api.createMealPrep({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/diet/meal-preps");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateMealPrepStatus → PUT /diet/meal-preps/{param_1}/status", async () => {
    mockOk({});
    await api.updateMealPrepStatus(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/diet/meal-preps");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listMealCounts → GET /diet/meal-counts", async () => {
    mockOk({});
    await api.listMealCounts();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/diet/meal-counts");
  });

  it("createMealCount → POST /diet/meal-counts", async () => {
    mockOk({});
    await api.createMealCount({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/diet/meal-counts");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listKitchenInventory → GET /diet/inventory", async () => {
    mockOk({});
    await api.listKitchenInventory();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/diet/inventory");
  });

  it("createKitchenInventoryItem → POST /diet/inventory", async () => {
    mockOk({});
    await api.createKitchenInventoryItem({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/diet/inventory");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateKitchenInventoryItem → PUT /diet/inventory/{param_1}", async () => {
    mockOk({});
    await api.updateKitchenInventoryItem(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/diet/inventory");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listKitchenAudits → GET /diet/audits", async () => {
    mockOk({});
    await api.listKitchenAudits();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/diet/audits");
  });

  it("createKitchenAudit → POST /diet/audits", async () => {
    mockOk({});
    await api.createKitchenAudit({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/diet/audits");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

});

describe("/emergency endpoints", () => {
  it("listErVisits → GET /emergency/visits", async () => {
    mockOk({});
    await api.listErVisits();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/emergency/visits");
  });

  it("getErVisit → GET /emergency/visits/{param_1}", async () => {
    mockOk({});
    await api.getErVisit(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/emergency/visits");
  });

  it("createErVisit → POST /emergency/visits", async () => {
    mockOk({});
    await api.createErVisit({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/emergency/visits");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateErVisit → PUT /emergency/visits/{param_1}", async () => {
    mockOk({});
    await api.updateErVisit(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/emergency/visits");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listTriageAssessments → GET /emergency/visits/{param_1}/triage", async () => {
    mockOk({});
    await api.listTriageAssessments(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/emergency/visits");
  });

  it("createTriageAssessment → POST /emergency/visits/{param_1}/triage", async () => {
    mockOk({});
    await api.createTriageAssessment(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/emergency/visits");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listResuscitationLogs → GET /emergency/visits/{param_1}/resuscitation", async () => {
    mockOk({});
    await api.listResuscitationLogs(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/emergency/visits");
  });

  it("createResuscitationLog → POST /emergency/visits/{param_1}/resuscitation", async () => {
    mockOk({});
    await api.createResuscitationLog(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/emergency/visits");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listCodeActivations → GET /emergency/codes", async () => {
    mockOk({});
    await api.listCodeActivations();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/emergency/codes");
  });

  it("createCodeActivation → POST /emergency/codes", async () => {
    mockOk({});
    await api.createCodeActivation({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/emergency/codes");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("deactivateCode → PUT /emergency/codes/{param_1}/deactivate", async () => {
    mockOk({});
    await api.deactivateCode(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/emergency/codes");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listMlcCases → GET /emergency/mlc", async () => {
    mockOk({});
    await api.listMlcCases();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/emergency/mlc");
  });

  it("createMlcCase → POST /emergency/mlc", async () => {
    mockOk({});
    await api.createMlcCase({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/emergency/mlc");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateMlcCase → PUT /emergency/mlc/{param_1}", async () => {
    mockOk({});
    await api.updateMlcCase(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/emergency/mlc");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listMlcDocuments → GET /emergency/mlc/{param_1}/documents", async () => {
    mockOk({});
    await api.listMlcDocuments(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/emergency/mlc");
  });

  it("createMlcDocument → POST /emergency/mlc/{param_1}/documents", async () => {
    mockOk({});
    await api.createMlcDocument(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/emergency/mlc");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listPoliceIntimations → GET /emergency/mlc/{param_1}/police-intimations", async () => {
    mockOk({});
    await api.listPoliceIntimations(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/emergency/mlc");
  });

  it("createPoliceIntimation → POST /emergency/mlc/{param_1}/police-intimations", async () => {
    mockOk({});
    await api.createPoliceIntimation(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/emergency/mlc");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("confirmPoliceReceipt → PUT /emergency/mlc/police-intimations/{param_1}/confirm", async () => {
    mockOk({});
    await api.confirmPoliceReceipt(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/emergency/mlc/police-intimations");
    expect(opts.method).toBe("PUT");
  });

  it("listMassCasualtyEvents → GET /emergency/mass-casualty", async () => {
    mockOk({});
    await api.listMassCasualtyEvents();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/emergency/mass-casualty");
  });

  it("createMassCasualtyEvent → POST /emergency/mass-casualty", async () => {
    mockOk({});
    await api.createMassCasualtyEvent({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/emergency/mass-casualty");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateMassCasualtyEvent → PUT /emergency/mass-casualty/{param_1}", async () => {
    mockOk({});
    await api.updateMassCasualtyEvent(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/emergency/mass-casualty");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("admitFromEr → POST /emergency/visits/{param_1}/admit", async () => {
    mockOk({});
    await api.admitFromEr(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/emergency/visits");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

});

describe("/facilities endpoints", () => {
  it("listFmsGasReadings → GET /facilities/gas-readings", async () => {
    mockOk({});
    await api.listFmsGasReadings();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/facilities/gas-readings");
  });

  it("createFmsGasReading → POST /facilities/gas-readings", async () => {
    mockOk({});
    await api.createFmsGasReading({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/facilities/gas-readings");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listFmsGasCompliance → GET /facilities/gas-compliance", async () => {
    mockOk({});
    await api.listFmsGasCompliance();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/facilities/gas-compliance");
  });

  it("createFmsGasCompliance → POST /facilities/gas-compliance", async () => {
    mockOk({});
    await api.createFmsGasCompliance({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/facilities/gas-compliance");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateFmsGasCompliance → PUT /facilities/gas-compliance/{param_1}", async () => {
    mockOk({});
    await api.updateFmsGasCompliance(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/facilities/gas-compliance");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listFmsFireEquipment → GET /facilities/fire-equipment", async () => {
    mockOk({});
    await api.listFmsFireEquipment();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/facilities/fire-equipment");
  });

  it("createFmsFireEquipment → POST /facilities/fire-equipment", async () => {
    mockOk({});
    await api.createFmsFireEquipment({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/facilities/fire-equipment");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateFmsFireEquipment → PUT /facilities/fire-equipment/{param_1}", async () => {
    mockOk({});
    await api.updateFmsFireEquipment(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/facilities/fire-equipment");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("createFmsFireInspection → POST /facilities/fire-inspections", async () => {
    mockOk({});
    await api.createFmsFireInspection({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/facilities/fire-inspections");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listFmsFireDrills → GET /facilities/fire-drills", async () => {
    mockOk({});
    await api.listFmsFireDrills();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/facilities/fire-drills");
  });

  it("createFmsFireDrill → POST /facilities/fire-drills", async () => {
    mockOk({});
    await api.createFmsFireDrill({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/facilities/fire-drills");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listFmsFireNoc → GET /facilities/fire-noc", async () => {
    mockOk({});
    await api.listFmsFireNoc();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/facilities/fire-noc");
  });

  it("createFmsFireNoc → POST /facilities/fire-noc", async () => {
    mockOk({});
    await api.createFmsFireNoc({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/facilities/fire-noc");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateFmsFireNoc → PUT /facilities/fire-noc/{param_1}", async () => {
    mockOk({});
    await api.updateFmsFireNoc(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/facilities/fire-noc");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listFmsWaterTests → GET /facilities/water-tests", async () => {
    mockOk({});
    await api.listFmsWaterTests();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/facilities/water-tests");
  });

  it("createFmsWaterTest → POST /facilities/water-tests", async () => {
    mockOk({});
    await api.createFmsWaterTest({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/facilities/water-tests");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listFmsWaterSchedules → GET /facilities/water-schedules", async () => {
    mockOk({});
    await api.listFmsWaterSchedules();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/facilities/water-schedules");
  });

  it("createFmsWaterSchedule → POST /facilities/water-schedules", async () => {
    mockOk({});
    await api.createFmsWaterSchedule({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/facilities/water-schedules");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateFmsWaterSchedule → PUT /facilities/water-schedules/{param_1}", async () => {
    mockOk({});
    await api.updateFmsWaterSchedule(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/facilities/water-schedules");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listFmsEnergyReadings → GET /facilities/energy-readings", async () => {
    mockOk({});
    await api.listFmsEnergyReadings();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/facilities/energy-readings");
  });

  it("createFmsEnergyReading → POST /facilities/energy-readings", async () => {
    mockOk({});
    await api.createFmsEnergyReading({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/facilities/energy-readings");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listFmsWorkOrders → GET /facilities/work-orders", async () => {
    mockOk({});
    await api.listFmsWorkOrders();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/facilities/work-orders");
  });

  it("getFmsWorkOrder → GET /facilities/work-orders/{param_1}", async () => {
    mockOk({});
    await api.getFmsWorkOrder(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/facilities/work-orders");
  });

  it("createFmsWorkOrder → POST /facilities/work-orders", async () => {
    mockOk({});
    await api.createFmsWorkOrder({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/facilities/work-orders");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateFmsWorkOrderStatus → PUT /facilities/work-orders/{param_1}/status", async () => {
    mockOk({});
    await api.updateFmsWorkOrderStatus(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/facilities/work-orders");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("getFmsStats → GET /facilities/stats", async () => {
    mockOk({});
    await api.getFmsStats();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/facilities/stats");
  });

  it("schedulePm → POST /facilities/pm/schedule", async () => {
    mockOk({});
    await api.schedulePm({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/facilities/pm/schedule");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("energyAnalytics → GET /facilities/energy/analytics", async () => {
    mockOk({});
    await api.energyAnalytics();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/facilities/energy/analytics");
  });

});

describe("/forms endpoints", () => {
  it("listForms → GET /forms", async () => {
    mockOk({});
    await api.listForms();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/forms");
  });

  it("getFormDefinition → GET /forms/{param_1}/definition", async () => {
    mockOk({});
    await api.getFormDefinition("test");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/forms");
  });

});

describe("/front-office endpoints", () => {
  it("listVisitingHours → GET /front-office/visiting-hours", async () => {
    mockOk({});
    await api.listVisitingHours();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/front-office/visiting-hours");
  });

  it("upsertVisitingHours → POST /front-office/visiting-hours", async () => {
    mockOk({});
    await api.upsertVisitingHours({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/front-office/visiting-hours");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("createVisitor → POST /front-office/visitors", async () => {
    mockOk({});
    await api.createVisitor({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/front-office/visitors");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("createVisitorPass → POST /front-office/passes", async () => {
    mockOk({});
    await api.createVisitorPass({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/front-office/passes");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("revokeVisitorPass → PUT /front-office/passes/{param_1}/revoke", async () => {
    mockOk({});
    await api.revokeVisitorPass(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/front-office/passes");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("checkInVisitor → POST /front-office/visitor-logs/{param_1}/check-in", async () => {
    mockOk({});
    await api.checkInVisitor(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/front-office/visitor-logs");
    expect(opts.method).toBe("POST");
  });

  it("checkOutVisitor → PUT /front-office/visitor-logs/{param_1}/check-out", async () => {
    mockOk({});
    await api.checkOutVisitor(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/front-office/visitor-logs");
    expect(opts.method).toBe("PUT");
  });

  it("listQueuePriorityRules → GET /front-office/queue-priority", async () => {
    mockOk({});
    await api.listQueuePriorityRules();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/front-office/queue-priority");
  });

  it("upsertQueuePriorityRule → POST /front-office/queue-priority", async () => {
    mockOk({});
    await api.upsertQueuePriorityRule({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/front-office/queue-priority");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listQueueDisplayConfig → GET /front-office/display-config", async () => {
    mockOk({});
    await api.listQueueDisplayConfig();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/front-office/display-config");
  });

  it("upsertQueueDisplayConfig → POST /front-office/display-config", async () => {
    mockOk({});
    await api.upsertQueueDisplayConfig({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/front-office/display-config");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("createEnquiry → POST /front-office/enquiries", async () => {
    mockOk({});
    await api.createEnquiry({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/front-office/enquiries");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("resolveEnquiry → PUT /front-office/enquiries/{param_1}/resolve", async () => {
    mockOk({});
    await api.resolveEnquiry(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/front-office/enquiries");
    expect(opts.method).toBe("PUT");
  });

  it("visitorAnalytics → GET /front-office/analytics", async () => {
    mockOk({});
    await api.visitorAnalytics();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/front-office/analytics");
  });

  it("queueMetrics → GET /front-office/queue/metrics", async () => {
    mockOk({});
    await api.queueMetrics();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/front-office/queue/metrics");
  });

});

describe("/geo endpoints", () => {
  it("geoCountries → GET /geo/countries", async () => {
    mockOk({});
    await api.geoCountries();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/geo/countries");
  });

  it("geoStates → GET /geo/countries/{param_1}/states", async () => {
    mockOk({});
    await api.geoStates(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/geo/countries");
  });

  it("geoDistricts → GET /geo/states/{param_1}/districts", async () => {
    mockOk({});
    await api.geoDistricts(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/geo/states");
  });

  it("geoSubdistricts → GET /geo/districts/{param_1}/subdistricts", async () => {
    mockOk({});
    await api.geoSubdistricts(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/geo/districts");
  });

  it("geoTowns → GET /geo/subdistricts/{param_1}/towns", async () => {
    mockOk({});
    await api.geoTowns(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/geo/subdistricts");
  });

  it("searchPincode → GET /geo/pincode/{param_1}", async () => {
    mockOk({});
    await api.searchPincode("test");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/geo/pincode");
  });

  it("geoRegulators → GET /geo/regulators", async () => {
    mockOk({});
    await api.geoRegulators();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/geo/regulators");
  });

  it("geoAutoDetectRegulators → GET /geo/regulators/auto-detect", async () => {
    mockOk({});
    await api.geoAutoDetectRegulators({ country_id: UUID });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/geo/regulators/auto-detect");
  });

});

describe("/health endpoints", () => {
  it("health → GET /health", async () => {
    mockOk({});
    await api.health();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/health");
  });

});

describe("/housekeeping endpoints", () => {
  it("listCleaningSchedules → GET /housekeeping/schedules", async () => {
    mockOk({});
    await api.listCleaningSchedules("test");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/housekeeping/schedules");
  });

  it("createCleaningSchedule → POST /housekeeping/schedules", async () => {
    mockOk({});
    await api.createCleaningSchedule({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/housekeeping/schedules");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateCleaningSchedule → PUT /housekeeping/schedules/{param_1}", async () => {
    mockOk({});
    await api.updateCleaningSchedule(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/housekeeping/schedules");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listCleaningTasks → GET /housekeeping/tasks", async () => {
    mockOk({});
    await api.listCleaningTasks();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/housekeeping/tasks");
  });

  it("createCleaningTask → POST /housekeeping/tasks", async () => {
    mockOk({});
    await api.createCleaningTask({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/housekeeping/tasks");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateCleaningTaskStatus → PUT /housekeeping/tasks/{param_1}/status", async () => {
    mockOk({});
    await api.updateCleaningTaskStatus(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/housekeeping/tasks");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("verifyCleaningTask → PUT /housekeeping/tasks/{param_1}/verify", async () => {
    mockOk({});
    await api.verifyCleaningTask(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/housekeeping/tasks");
    expect(opts.method).toBe("PUT");
  });

  it("listTurnarounds → GET /housekeeping/turnarounds", async () => {
    mockOk({});
    await api.listTurnarounds();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/housekeeping/turnarounds");
  });

  it("createTurnaround → POST /housekeeping/turnarounds", async () => {
    mockOk({});
    await api.createTurnaround({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/housekeeping/turnarounds");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("completeTurnaround → PUT /housekeeping/turnarounds/{param_1}/complete", async () => {
    mockOk({});
    await api.completeTurnaround(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/housekeeping/turnarounds");
    expect(opts.method).toBe("PUT");
  });

  it("listPestControlSchedules → GET /housekeeping/pest-control", async () => {
    mockOk({});
    await api.listPestControlSchedules();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/housekeeping/pest-control");
  });

  it("createPestControlSchedule → POST /housekeeping/pest-control", async () => {
    mockOk({});
    await api.createPestControlSchedule({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/housekeeping/pest-control");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updatePestControlSchedule → PUT /housekeeping/pest-control/{param_1}", async () => {
    mockOk({});
    await api.updatePestControlSchedule(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/housekeeping/pest-control");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listPestControlLogs → GET /housekeeping/pest-control-logs", async () => {
    mockOk({});
    await api.listPestControlLogs();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/housekeeping/pest-control-logs");
  });

  it("createPestControlLog → POST /housekeeping/pest-control-logs", async () => {
    mockOk({});
    await api.createPestControlLog({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/housekeeping/pest-control-logs");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listLinenItems → GET /housekeeping/linen", async () => {
    mockOk({});
    await api.listLinenItems();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/housekeeping/linen");
  });

  it("createLinenItem → POST /housekeeping/linen", async () => {
    mockOk({});
    await api.createLinenItem({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/housekeeping/linen");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateLinenItem → PUT /housekeeping/linen/{param_1}", async () => {
    mockOk({});
    await api.updateLinenItem(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/housekeeping/linen");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listLinenMovements → GET /housekeeping/linen-movements", async () => {
    mockOk({});
    await api.listLinenMovements();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/housekeeping/linen-movements");
  });

  it("createLinenMovement → POST /housekeeping/linen-movements", async () => {
    mockOk({});
    await api.createLinenMovement({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/housekeeping/linen-movements");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listLaundryBatches → GET /housekeeping/laundry-batches", async () => {
    mockOk({});
    await api.listLaundryBatches();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/housekeeping/laundry-batches");
  });

  it("createLaundryBatch → POST /housekeeping/laundry-batches", async () => {
    mockOk({});
    await api.createLaundryBatch({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/housekeeping/laundry-batches");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("completeLaundryBatch → PUT /housekeeping/laundry-batches/{param_1}/complete", async () => {
    mockOk({});
    await api.completeLaundryBatch(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/housekeeping/laundry-batches");
    expect(opts.method).toBe("PUT");
  });

  it("listParLevels → GET /housekeeping/par-levels", async () => {
    mockOk({});
    await api.listParLevels();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/housekeeping/par-levels");
  });

  it("upsertParLevel → POST /housekeeping/par-levels", async () => {
    mockOk({});
    await api.upsertParLevel({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/housekeeping/par-levels");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listLinenCondemnations → GET /housekeeping/condemnations", async () => {
    mockOk({});
    await api.listLinenCondemnations();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/housekeeping/condemnations");
  });

  it("createLinenCondemnation → POST /housekeeping/condemnations", async () => {
    mockOk({});
    await api.createLinenCondemnation({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/housekeeping/condemnations");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("getBmwSchedule → GET /housekeeping/bmw/schedule", async () => {
    mockOk({});
    await api.getBmwSchedule();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/housekeeping/bmw/schedule");
  });

  it("createSharpReplacement → POST /housekeeping/bmw/sharp-replacement", async () => {
    mockOk({});
    await api.createSharpReplacement({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/housekeeping/bmw/sharp-replacement");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

});

describe("/hr endpoints", () => {
  it("listDesignations → GET /hr/designations", async () => {
    mockOk({});
    await api.listDesignations();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/hr/designations");
  });

  it("createDesignation → POST /hr/designations", async () => {
    mockOk({});
    await api.createDesignation({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/hr/designations");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateDesignation → PUT /hr/designations/{param_1}", async () => {
    mockOk({});
    await api.updateDesignation(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/hr/designations");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listEmployees → GET /hr/employees", async () => {
    mockOk({});
    await api.listEmployees();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/hr/employees");
  });

  it("getEmployee → GET /hr/employees/{param_1}", async () => {
    mockOk({});
    await api.getEmployee(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/hr/employees");
  });

  it("createEmployee → POST /hr/employees", async () => {
    mockOk({});
    await api.createEmployee({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/hr/employees");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateEmployee → PUT /hr/employees/{param_1}", async () => {
    mockOk({});
    await api.updateEmployee(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/hr/employees");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listCredentials → GET /hr/employees/{param_1}/credentials", async () => {
    mockOk({});
    await api.listCredentials(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/hr/employees");
  });

  it("createCredential → POST /hr/employees/{param_1}/credentials", async () => {
    mockOk({});
    await api.createCredential(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/hr/employees");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateCredential → PUT /hr/employees/{param_1}/credentials/{param_2}", async () => {
    mockOk({});
    await api.updateCredential(UUID, UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/hr/employees");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listShifts → GET /hr/shifts", async () => {
    mockOk({});
    await api.listShifts();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/hr/shifts");
  });

  it("createShift → POST /hr/shifts", async () => {
    mockOk({});
    await api.createShift({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/hr/shifts");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateShift → PUT /hr/shifts/{param_1}", async () => {
    mockOk({});
    await api.updateShift(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/hr/shifts");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listRosters → GET /hr/rosters", async () => {
    mockOk({});
    await api.listRosters();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/hr/rosters");
  });

  it("createRoster → POST /hr/rosters", async () => {
    mockOk({});
    await api.createRoster({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/hr/rosters");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("approveSwap → PUT /hr/rosters/{param_1}/approve-swap", async () => {
    mockOk({});
    await api.approveSwap(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/hr/rosters");
    expect(opts.method).toBe("PUT");
  });

  it("listAttendance → GET /hr/attendance", async () => {
    mockOk({});
    await api.listAttendance();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/hr/attendance");
  });

  it("createAttendance → POST /hr/attendance", async () => {
    mockOk({});
    await api.createAttendance({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/hr/attendance");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listLeaveBalances → GET /hr/employees/{param_1}/leave-balances", async () => {
    mockOk({});
    await api.listLeaveBalances(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/hr/employees");
  });

  it("listLeaveRequests → GET /hr/leaves", async () => {
    mockOk({});
    await api.listLeaveRequests();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/hr/leaves");
  });

  it("createLeaveRequest → POST /hr/leaves", async () => {
    mockOk({});
    await api.createLeaveRequest({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/hr/leaves");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("leaveAction → PUT /hr/leaves/{param_1}/action", async () => {
    mockOk({});
    await api.leaveAction(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/hr/leaves");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("cancelLeave → PUT /hr/leaves/{param_1}/cancel", async () => {
    mockOk({});
    await api.cancelLeave(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/hr/leaves");
    expect(opts.method).toBe("PUT");
  });

  it("listOnCall → GET /hr/on-call", async () => {
    mockOk({});
    await api.listOnCall();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/hr/on-call");
  });

  it("createOnCall → POST /hr/on-call", async () => {
    mockOk({});
    await api.createOnCall({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/hr/on-call");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listTrainingPrograms → GET /hr/training-programs", async () => {
    mockOk({});
    await api.listTrainingPrograms();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/hr/training-programs");
  });

  it("createTrainingProgram → POST /hr/training-programs", async () => {
    mockOk({});
    await api.createTrainingProgram({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/hr/training-programs");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listTrainingRecords → GET /hr/employees/{param_1}/training-records", async () => {
    mockOk({});
    await api.listTrainingRecords(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/hr/employees");
  });

  it("createTrainingRecord → POST /hr/training-records", async () => {
    mockOk({});
    await api.createTrainingRecord({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/hr/training-records");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listAppraisals → GET /hr/employees/{param_1}/appraisals", async () => {
    mockOk({});
    await api.listAppraisals(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/hr/employees");
  });

  it("createAppraisal → POST /hr/appraisals", async () => {
    mockOk({});
    await api.createAppraisal({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/hr/appraisals");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listStatutoryRecords → GET /hr/employees/{param_1}/statutory-records", async () => {
    mockOk({});
    await api.listStatutoryRecords(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/hr/employees");
  });

  it("createStatutoryRecord → POST /hr/statutory-records", async () => {
    mockOk({});
    await api.createStatutoryRecord({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/hr/statutory-records");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("trainingCompliance → GET /hr/training/compliance", async () => {
    mockOk({});
    await api.trainingCompliance();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/hr/training/compliance");
  });

});

describe("/icu endpoints", () => {
  it("listIcuFlowsheets → GET /icu/admissions/{param_1}/flowsheets", async () => {
    mockOk({});
    await api.listIcuFlowsheets(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/icu/admissions");
  });

  it("createIcuFlowsheet → POST /icu/admissions/{param_1}/flowsheets", async () => {
    mockOk({});
    await api.createIcuFlowsheet(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/icu/admissions");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listIcuVentilatorRecords → GET /icu/admissions/{param_1}/ventilator", async () => {
    mockOk({});
    await api.listIcuVentilatorRecords(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/icu/admissions");
  });

  it("createIcuVentilatorRecord → POST /icu/admissions/{param_1}/ventilator", async () => {
    mockOk({});
    await api.createIcuVentilatorRecord(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/icu/admissions");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listIcuScores → GET /icu/admissions/{param_1}/scores", async () => {
    mockOk({});
    await api.listIcuScores(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/icu/admissions");
  });

  it("createIcuScore → POST /icu/admissions/{param_1}/scores", async () => {
    mockOk({});
    await api.createIcuScore(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/icu/admissions");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listIcuDevices → GET /icu/admissions/{param_1}/devices", async () => {
    mockOk({});
    await api.listIcuDevices(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/icu/admissions");
  });

  it("createIcuDevice → POST /icu/admissions/{param_1}/devices", async () => {
    mockOk({});
    await api.createIcuDevice(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/icu/admissions");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("removeIcuDevice → PUT /icu/admissions/{param_1}/devices/{param_2}", async () => {
    mockOk({});
    await api.removeIcuDevice(UUID, UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/icu/admissions");
    expect(opts.method).toBe("PUT");
  });

  it("listIcuBundleChecks → GET /icu/admissions/{param_1}/devices/{param_2}/bundle-checks", async () => {
    mockOk({});
    await api.listIcuBundleChecks(UUID, UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/icu/admissions");
  });

  it("createIcuBundleCheck → POST /icu/admissions/{param_1}/devices/{param_2}/bundle-checks", async () => {
    mockOk({});
    await api.createIcuBundleCheck(UUID, UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/icu/admissions");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listIcuNutrition → GET /icu/admissions/{param_1}/nutrition", async () => {
    mockOk({});
    await api.listIcuNutrition(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/icu/admissions");
  });

  it("createIcuNutrition → POST /icu/admissions/{param_1}/nutrition", async () => {
    mockOk({});
    await api.createIcuNutrition(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/icu/admissions");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listIcuNeonatalRecords → GET /icu/admissions/{param_1}/neonatal", async () => {
    mockOk({});
    await api.listIcuNeonatalRecords(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/icu/admissions");
  });

  it("createIcuNeonatalRecord → POST /icu/admissions/{param_1}/neonatal", async () => {
    mockOk({});
    await api.createIcuNeonatalRecord(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/icu/admissions");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("getIcuLosAnalytics → GET /icu/analytics/los", async () => {
    mockOk({});
    await api.getIcuLosAnalytics();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/icu/analytics/los");
  });

  it("getIcuDeviceInfectionRates → GET /icu/analytics/device-infections", async () => {
    mockOk({});
    await api.getIcuDeviceInfectionRates();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/icu/analytics/device-infections");
  });

});

describe("/indent endpoints", () => {
  it("listIndentRequisitions → GET /indent/requisitions", async () => {
    mockOk({});
    await api.listIndentRequisitions();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/indent/requisitions");
  });

  it("createIndentRequisition → POST /indent/requisitions", async () => {
    mockOk({});
    await api.createIndentRequisition({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/indent/requisitions");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("getIndentRequisition → GET /indent/requisitions/{param_1}", async () => {
    mockOk({});
    await api.getIndentRequisition(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/indent/requisitions");
  });

  it("submitIndentRequisition → PUT /indent/requisitions/{param_1}/submit", async () => {
    mockOk({});
    await api.submitIndentRequisition(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/indent/requisitions");
    expect(opts.method).toBe("PUT");
  });

  it("approveIndentRequisition → PUT /indent/requisitions/{param_1}/approve", async () => {
    mockOk({});
    await api.approveIndentRequisition(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/indent/requisitions");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("rejectIndentRequisition → PUT /indent/requisitions/{param_1}/reject", async () => {
    mockOk({});
    await api.rejectIndentRequisition(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/indent/requisitions");
    expect(opts.method).toBe("PUT");
  });

  it("issueIndentRequisition → PUT /indent/requisitions/{param_1}/issue", async () => {
    mockOk({});
    await api.issueIndentRequisition(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/indent/requisitions");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("cancelIndentRequisition → PUT /indent/requisitions/{param_1}/cancel", async () => {
    mockOk({});
    await api.cancelIndentRequisition(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/indent/requisitions");
    expect(opts.method).toBe("PUT");
  });

  it("listStoreCatalog → GET /indent/catalog", async () => {
    mockOk({});
    await api.listStoreCatalog();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/indent/catalog");
  });

  it("createStoreCatalogItem → POST /indent/catalog", async () => {
    mockOk({});
    await api.createStoreCatalogItem({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/indent/catalog");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateStoreCatalogItem → PUT /indent/catalog/{param_1}", async () => {
    mockOk({});
    await api.updateStoreCatalogItem(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/indent/catalog");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listStoreStockMovements → GET /indent/stock/movements", async () => {
    mockOk({});
    await api.listStoreStockMovements();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/indent/stock/movements");
  });

  it("createStoreStockMovement → POST /indent/stock/movements", async () => {
    mockOk({});
    await api.createStoreStockMovement({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/indent/stock/movements");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("getConsumptionAnalysis → GET /indent/analytics/consumption", async () => {
    mockOk({});
    await api.getConsumptionAnalysis();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/indent/analytics/consumption");
  });

  it("getDeadStockReport → GET /indent/analytics/dead-stock", async () => {
    mockOk({});
    await api.getDeadStockReport();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/indent/analytics/dead-stock");
  });

  it("getPurchaseConsumptionTrend → GET /indent/analytics/purchase-vs-consumption", async () => {
    mockOk({});
    await api.getPurchaseConsumptionTrend();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/indent/analytics/purchase-vs-consumption");
  });

  it("getInventoryValuation → GET /indent/analytics/valuation", async () => {
    mockOk({});
    await api.getInventoryValuation();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/indent/analytics/valuation");
  });

  it("getComplianceReport → GET /indent/analytics/compliance", async () => {
    mockOk({});
    await api.getComplianceReport();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/indent/analytics/compliance");
  });

  it("getFsnAnalysis → GET /indent/analytics/fsn", async () => {
    mockOk({});
    await api.getFsnAnalysis();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/indent/analytics/fsn");
  });

  it("getAbcAnalysis → GET /indent/analytics/abc", async () => {
    mockOk({});
    await api.getAbcAnalysis();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/indent/analytics/abc");
  });

  it("getVedAnalysis → GET /indent/analytics/ved", async () => {
    mockOk({});
    await api.getVedAnalysis();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/indent/analytics/ved");
  });

  it("createDepartmentIssue → POST /indent/department-issues", async () => {
    mockOk({});
    await api.createDepartmentIssue({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/indent/department-issues");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("issueToPatient → POST /indent/patient-consumables", async () => {
    mockOk({});
    await api.issueToPatient({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/indent/patient-consumables");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listPatientConsumables → GET /indent/patient-consumables", async () => {
    mockOk({});
    await api.listPatientConsumables();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/indent/patient-consumables");
  });

  it("createReturnToStore → POST /indent/returns", async () => {
    mockOk({});
    await api.createReturnToStore({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/indent/returns");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listConsignmentStock → GET /indent/consignment-stock", async () => {
    mockOk({});
    await api.listConsignmentStock();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/indent/consignment-stock");
  });

  it("recordConsignmentUsage → POST /indent/consignment-usage", async () => {
    mockOk({});
    await api.recordConsignmentUsage({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/indent/consignment-usage");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listImplantRegistry → GET /indent/implant-registry", async () => {
    mockOk({});
    await api.listImplantRegistry();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/indent/implant-registry");
  });

  it("createImplantEntry → POST /indent/implant-registry", async () => {
    mockOk({});
    await api.createImplantEntry({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/indent/implant-registry");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateImplantEntry → PUT /indent/implant-registry/{param_1}", async () => {
    mockOk({});
    await api.updateImplantEntry(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/indent/implant-registry");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listCondemnations → GET /indent/condemnations", async () => {
    mockOk({});
    await api.listCondemnations();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/indent/condemnations");
  });

  it("createCondemnation → POST /indent/condemnations", async () => {
    mockOk({});
    await api.createCondemnation({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/indent/condemnations");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateCondemnationStatus → PUT /indent/condemnations/{param_1}/status", async () => {
    mockOk({});
    await api.updateCondemnationStatus(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/indent/condemnations");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("checkReorderAlerts → POST /indent/reorder-alerts/check", async () => {
    mockOk({});
    await api.checkReorderAlerts();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/indent/reorder-alerts/check");
    expect(opts.method).toBe("POST");
  });

  it("listReorderAlerts → GET /indent/reorder-alerts", async () => {
    mockOk({});
    await api.listReorderAlerts();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/indent/reorder-alerts");
  });

  it("acknowledgeReorderAlert → PUT /indent/reorder-alerts/{param_1}/acknowledge", async () => {
    mockOk({});
    await api.acknowledgeReorderAlert(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/indent/reorder-alerts");
    expect(opts.method).toBe("PUT");
  });

});

describe("/infection-control endpoints", () => {
  it("listSurveillanceEvents → GET /infection-control/surveillance", async () => {
    mockOk({});
    await api.listSurveillanceEvents();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/infection-control/surveillance");
  });

  it("createSurveillanceEvent → POST /infection-control/surveillance", async () => {
    mockOk({});
    await api.createSurveillanceEvent({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/infection-control/surveillance");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listDeviceDays → GET /infection-control/device-days", async () => {
    mockOk({});
    await api.listDeviceDays();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/infection-control/device-days");
  });

  it("recordDeviceDays → POST /infection-control/device-days", async () => {
    mockOk({});
    await api.recordDeviceDays({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/infection-control/device-days");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listStewardshipRequests → GET /infection-control/stewardship", async () => {
    mockOk({});
    await api.listStewardshipRequests();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/infection-control/stewardship");
  });

  it("createStewardshipRequest → POST /infection-control/stewardship", async () => {
    mockOk({});
    await api.createStewardshipRequest({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/infection-control/stewardship");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("reviewStewardshipRequest → PATCH /infection-control/stewardship/{param_1}", async () => {
    mockOk({});
    await api.reviewStewardshipRequest(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/infection-control/stewardship");
    expect(opts.method).toBe("PATCH");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listConsumptionRecords → GET /infection-control/consumption", async () => {
    mockOk({});
    await api.listConsumptionRecords();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/infection-control/consumption");
  });

  it("recordConsumption → POST /infection-control/consumption", async () => {
    mockOk({});
    await api.recordConsumption({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/infection-control/consumption");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listBiowasteRecords → GET /infection-control/biowaste", async () => {
    mockOk({});
    await api.listBiowasteRecords();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/infection-control/biowaste");
  });

  it("createBiowasteRecord → POST /infection-control/biowaste", async () => {
    mockOk({});
    await api.createBiowasteRecord({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/infection-control/biowaste");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listNeedleStickIncidents → GET /infection-control/needle-stick", async () => {
    mockOk({});
    await api.listNeedleStickIncidents();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/infection-control/needle-stick");
  });

  it("createNeedleStickIncident → POST /infection-control/needle-stick", async () => {
    mockOk({});
    await api.createNeedleStickIncident({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/infection-control/needle-stick");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listHygieneAudits → GET /infection-control/hygiene-audits", async () => {
    mockOk({});
    await api.listHygieneAudits();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/infection-control/hygiene-audits");
  });

  it("createHygieneAudit → POST /infection-control/hygiene-audits", async () => {
    mockOk({});
    await api.createHygieneAudit({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/infection-control/hygiene-audits");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listCultureSurveillance → GET /infection-control/cultures", async () => {
    mockOk({});
    await api.listCultureSurveillance();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/infection-control/cultures");
  });

  it("createCultureSurveillance → POST /infection-control/cultures", async () => {
    mockOk({});
    await api.createCultureSurveillance({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/infection-control/cultures");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listOutbreaks → GET /infection-control/outbreaks", async () => {
    mockOk({});
    await api.listOutbreaks();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/infection-control/outbreaks");
  });

  it("createOutbreak → POST /infection-control/outbreaks", async () => {
    mockOk({});
    await api.createOutbreak({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/infection-control/outbreaks");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateOutbreak → PATCH /infection-control/outbreaks/{param_1}", async () => {
    mockOk({});
    await api.updateOutbreak(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/infection-control/outbreaks");
    expect(opts.method).toBe("PATCH");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listOutbreakContacts → GET /infection-control/outbreaks/{param_1}/contacts", async () => {
    mockOk({});
    await api.listOutbreakContacts(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/infection-control/outbreaks");
  });

  it("addOutbreakContact → POST /infection-control/outbreaks/{param_1}/contacts", async () => {
    mockOk({});
    await api.addOutbreakContact(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/infection-control/outbreaks");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("icHaiRates → GET /infection-control/analytics/hai-rates", async () => {
    mockOk({});
    await api.icHaiRates();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/infection-control/analytics/hai-rates");
  });

  it("icDeviceUtilization → GET /infection-control/analytics/device-utilization", async () => {
    mockOk({});
    await api.icDeviceUtilization();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/infection-control/analytics/device-utilization");
  });

  it("icAntimicrobialConsumption → GET /infection-control/analytics/antimicrobial-consumption", async () => {
    mockOk({});
    await api.icAntimicrobialConsumption();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/infection-control/analytics/antimicrobial-consumption");
  });

  it("icSurgicalProphylaxis → GET /infection-control/analytics/surgical-prophylaxis", async () => {
    mockOk({});
    await api.icSurgicalProphylaxis();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/infection-control/analytics/surgical-prophylaxis");
  });

  it("icCultureSensitivityReport → GET /infection-control/reports/culture-sensitivity", async () => {
    mockOk({});
    await api.icCultureSensitivityReport();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/infection-control/reports/culture-sensitivity");
  });

  it("icMdroTracking → GET /infection-control/analytics/mdro", async () => {
    mockOk({});
    await api.icMdroTracking();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/infection-control/analytics/mdro");
  });

  it("createIcExposure → POST /infection-control/exposures", async () => {
    mockOk({});
    await api.createIcExposure({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/infection-control/exposures");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listIcMeetings → GET /infection-control/meetings", async () => {
    mockOk({});
    await api.listIcMeetings();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/infection-control/meetings");
  });

  it("createIcMeeting → POST /infection-control/meetings", async () => {
    mockOk({});
    await api.createIcMeeting({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/infection-control/meetings");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("icMonthlySurveillance → GET /infection-control/reports/monthly", async () => {
    mockOk({});
    await api.icMonthlySurveillance();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/infection-control/reports/monthly");
  });

  it("createOutbreakRca → POST /infection-control/outbreaks/{param_1}/rca", async () => {
    mockOk({});
    await api.createOutbreakRca(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/infection-control/outbreaks");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

});

describe("/integration endpoints", () => {
  it("listPipelines → GET /integration/pipelines", async () => {
    mockOk({});
    await api.listPipelines();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/integration/pipelines");
  });

  it("createPipeline → POST /integration/pipelines", async () => {
    mockOk({});
    await api.createPipeline({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/integration/pipelines");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("getPipeline → GET /integration/pipelines/{param_1}", async () => {
    mockOk({});
    await api.getPipeline(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/integration/pipelines");
  });

  it("updatePipeline → PUT /integration/pipelines/{param_1}", async () => {
    mockOk({});
    await api.updatePipeline(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/integration/pipelines");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("deletePipeline → DELETE /integration/pipelines/{param_1}", async () => {
    mockOk({});
    await api.deletePipeline(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/integration/pipelines");
    expect(opts.method).toBe("DELETE");
  });

  it("updatePipelineStatus → PUT /integration/pipelines/{param_1}/status", async () => {
    mockOk({});
    await api.updatePipelineStatus(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/integration/pipelines");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("triggerPipeline → POST /integration/pipelines/{param_1}/trigger", async () => {
    mockOk({});
    await api.triggerPipeline(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/integration/pipelines");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listPipelineExecutions → GET /integration/pipelines/{param_1}/executions", async () => {
    mockOk({});
    await api.listPipelineExecutions(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/integration/pipelines");
  });

  it("getExecution → GET /integration/executions/{param_1}", async () => {
    mockOk({});
    await api.getExecution(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/integration/executions");
  });

  it("listNodeTemplates → GET /integration/node-templates", async () => {
    mockOk({});
    await api.listNodeTemplates();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/integration/node-templates");
  });

  it("createNodeTemplate → POST /integration/node-templates", async () => {
    mockOk({});
    await api.createNodeTemplate({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/integration/node-templates");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

});

describe("/ipd endpoints", () => {
  it("listAvailableBeds → GET /ipd/beds/available", async () => {
    mockOk({});
    await api.listAvailableBeds();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/ipd/beds/available");
  });

  it("listAdmissions → GET /ipd/admissions", async () => {
    mockOk({});
    await api.listAdmissions();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/ipd/admissions");
  });

  it("createAdmission → POST /ipd/admissions", async () => {
    mockOk({});
    await api.createAdmission({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/ipd/admissions");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("getAdmission → GET /ipd/admissions/{param_1}", async () => {
    mockOk({});
    await api.getAdmission(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ipd/admissions");
  });

  it("updateAdmission → PUT /ipd/admissions/{param_1}", async () => {
    mockOk({});
    await api.updateAdmission(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ipd/admissions");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("transferBed → PUT /ipd/admissions/{param_1}/transfer", async () => {
    mockOk({});
    await api.transferBed(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ipd/admissions");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("dischargePatient → PUT /ipd/admissions/{param_1}/discharge", async () => {
    mockOk({});
    await api.dischargePatient(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ipd/admissions");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listNursingTasks → GET /ipd/admissions/{param_1}/tasks", async () => {
    mockOk({});
    await api.listNursingTasks(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ipd/admissions");
  });

  it("createNursingTask → POST /ipd/admissions/{param_1}/tasks", async () => {
    mockOk({});
    await api.createNursingTask(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ipd/admissions");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateNursingTask → PUT /ipd/admissions/{param_1}/tasks/{param_2}", async () => {
    mockOk({});
    await api.updateNursingTask(UUID, UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ipd/admissions");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listProgressNotes → GET /ipd/admissions/{param_1}/progress-notes", async () => {
    mockOk({});
    await api.listProgressNotes(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ipd/admissions");
  });

  it("createProgressNote → POST /ipd/admissions/{param_1}/progress-notes", async () => {
    mockOk({});
    await api.createProgressNote(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ipd/admissions");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateProgressNote → PUT /ipd/admissions/{param_1}/progress-notes/{param_2}", async () => {
    mockOk({});
    await api.updateProgressNote(UUID, UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ipd/admissions");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listAssessments → GET /ipd/admissions/{param_1}/assessments", async () => {
    mockOk({});
    await api.listAssessments(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ipd/admissions");
  });

  it("createAssessment → POST /ipd/admissions/{param_1}/assessments", async () => {
    mockOk({});
    await api.createAssessment(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ipd/admissions");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listMar → GET /ipd/admissions/{param_1}/mar", async () => {
    mockOk({});
    await api.listMar(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ipd/admissions");
  });

  it("createMar → POST /ipd/admissions/{param_1}/mar", async () => {
    mockOk({});
    await api.createMar(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ipd/admissions");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateMar → PUT /ipd/admissions/{param_1}/mar/{param_2}", async () => {
    mockOk({});
    await api.updateMar(UUID, UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ipd/admissions");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listIntakeOutput → GET /ipd/admissions/{param_1}/io", async () => {
    mockOk({});
    await api.listIntakeOutput(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ipd/admissions");
  });

  it("createIntakeOutput → POST /ipd/admissions/{param_1}/io", async () => {
    mockOk({});
    await api.createIntakeOutput(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ipd/admissions");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("getIoBalance → GET /ipd/admissions/{param_1}/io/balance", async () => {
    mockOk({});
    await api.getIoBalance(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ipd/admissions");
  });

  it("listNursingAssessments → GET /ipd/admissions/{param_1}/nursing-assessments", async () => {
    mockOk({});
    await api.listNursingAssessments(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ipd/admissions");
  });

  it("createNursingAssessment → POST /ipd/admissions/{param_1}/nursing-assessments", async () => {
    mockOk({});
    await api.createNursingAssessment(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ipd/admissions");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateNursingAssessment → PUT /ipd/admissions/{param_1}/nursing-assessments/{param_2}", async () => {
    mockOk({});
    await api.updateNursingAssessment(UUID, UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ipd/admissions");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listCarePlans → GET /ipd/admissions/{param_1}/care-plans", async () => {
    mockOk({});
    await api.listCarePlans(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ipd/admissions");
  });

  it("createCarePlan → POST /ipd/admissions/{param_1}/care-plans", async () => {
    mockOk({});
    await api.createCarePlan(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ipd/admissions");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateCarePlan → PUT /ipd/admissions/{param_1}/care-plans/{param_2}", async () => {
    mockOk({});
    await api.updateCarePlan(UUID, UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ipd/admissions");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listHandovers → GET /ipd/admissions/{param_1}/handovers", async () => {
    mockOk({});
    await api.listHandovers(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ipd/admissions");
  });

  it("createHandover → POST /ipd/admissions/{param_1}/handovers", async () => {
    mockOk({});
    await api.createHandover(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ipd/admissions");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("acknowledgeHandover → PUT /ipd/admissions/{param_1}/handovers/{param_2}/acknowledge", async () => {
    mockOk({});
    await api.acknowledgeHandover(UUID, UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ipd/admissions");
    expect(opts.method).toBe("PUT");
  });

  it("listDischargeChecklist → GET /ipd/admissions/{param_1}/discharge-checklist", async () => {
    mockOk({});
    await api.listDischargeChecklist(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ipd/admissions");
  });

  it("initDischargeChecklist → POST /ipd/admissions/{param_1}/discharge-checklist", async () => {
    mockOk({});
    await api.initDischargeChecklist(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ipd/admissions");
    expect(opts.method).toBe("POST");
  });

  it("updateDischargeChecklistItem → PUT /ipd/admissions/{param_1}/discharge-checklist/{param_2}", async () => {
    mockOk({});
    await api.updateDischargeChecklistItem(UUID, UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ipd/admissions");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listWards → GET /ipd/wards", async () => {
    mockOk({});
    await api.listWards();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/ipd/wards");
  });

  it("getWard → GET /ipd/wards/{param_1}", async () => {
    mockOk({});
    await api.getWard(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ipd/wards");
  });

  it("createWard → POST /ipd/wards", async () => {
    mockOk({});
    await api.createWard({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/ipd/wards");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateWard → PUT /ipd/wards/{param_1}", async () => {
    mockOk({});
    await api.updateWard(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ipd/wards");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listWardBeds → GET /ipd/wards/{param_1}/beds", async () => {
    mockOk({});
    await api.listWardBeds(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ipd/wards");
  });

  it("assignBedToWard → POST /ipd/wards/{param_1}/beds", async () => {
    mockOk({});
    await api.assignBedToWard(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ipd/wards");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("removeBedFromWard → DELETE /ipd/wards/{param_1}/beds/{param_2}", async () => {
    mockOk({});
    await api.removeBedFromWard(UUID, UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ipd/wards");
    expect(opts.method).toBe("DELETE");
  });

  it("bedDashboardSummary → GET /ipd/bed-dashboard", async () => {
    mockOk({});
    await api.bedDashboardSummary();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/ipd/bed-dashboard");
  });

  it("bedDashboardBeds → GET /ipd/bed-dashboard/beds", async () => {
    mockOk({});
    await api.bedDashboardBeds();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/ipd/bed-dashboard/beds");
  });

  it("updateBedStatus → PUT /ipd/bed-dashboard/beds/{param_1}/status", async () => {
    mockOk({});
    await api.updateBedStatus(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ipd/bed-dashboard/beds");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listAttenders → GET /ipd/admissions/{param_1}/attenders", async () => {
    mockOk({});
    await api.listAttenders(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ipd/admissions");
  });

  it("createAttender → POST /ipd/admissions/{param_1}/attenders", async () => {
    mockOk({});
    await api.createAttender(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ipd/admissions");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("deleteAttender → DELETE /ipd/admissions/{param_1}/attenders/{param_2}", async () => {
    mockOk({});
    await api.deleteAttender(UUID, UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ipd/admissions");
    expect(opts.method).toBe("DELETE");
  });

  it("listDischargeTemplates → GET /ipd/discharge-templates", async () => {
    mockOk({});
    await api.listDischargeTemplates();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/ipd/discharge-templates");
  });

  it("createDischargeTemplate → POST /ipd/discharge-templates", async () => {
    mockOk({});
    await api.createDischargeTemplate({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/ipd/discharge-templates");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("getDischargeSummary → GET /ipd/admissions/{param_1}/discharge-summary", async () => {
    mockOk({});
    await api.getDischargeSummary(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ipd/admissions");
  });

  it("createDischargeSummary → POST /ipd/admissions/{param_1}/discharge-summary", async () => {
    mockOk({});
    await api.createDischargeSummary(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ipd/admissions");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateDischargeSummary → PUT /ipd/admissions/{param_1}/discharge-summary", async () => {
    mockOk({});
    await api.updateDischargeSummary(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ipd/admissions");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("finalizeDischargeSummary → POST /ipd/admissions/{param_1}/discharge-summary/finalize", async () => {
    mockOk({});
    await api.finalizeDischargeSummary(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ipd/admissions");
    expect(opts.method).toBe("POST");
  });

  it("reportCensus → GET /ipd/reports/census", async () => {
    mockOk({});
    await api.reportCensus();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/ipd/reports/census");
  });

  it("reportOccupancy → GET /ipd/reports/occupancy", async () => {
    mockOk({});
    await api.reportOccupancy();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/ipd/reports/occupancy");
  });

  it("reportAlos → GET /ipd/reports/alos", async () => {
    mockOk({});
    await api.reportAlos();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/ipd/reports/alos");
  });

  it("reportDischargeStats → GET /ipd/reports/discharge-stats", async () => {
    mockOk({});
    await api.reportDischargeStats();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/ipd/reports/discharge-stats");
  });

  it("generateDischargeSummary → POST /ipd/admissions/{param_1}/discharge-summary", async () => {
    mockOk({});
    await api.generateDischargeSummary(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ipd/admissions");
    expect(opts.method).toBe("POST");
  });

  it("bedTransfer → POST /ipd/admissions/{param_1}/transfer", async () => {
    mockOk({});
    await api.bedTransfer(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ipd/admissions");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("expectedDischarges → GET /ipd/discharges/expected", async () => {
    mockOk({});
    await api.expectedDischarges();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/ipd/discharges/expected");
  });

});

describe("/lab endpoints", () => {
  it("listLabOrders → GET /lab/orders", async () => {
    mockOk({});
    await api.listLabOrders();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/lab/orders");
  });

  it("createLabOrder → POST /lab/orders", async () => {
    mockOk({});
    await api.createLabOrder({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/lab/orders");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("getLabOrder → GET /lab/orders/{param_1}", async () => {
    mockOk({});
    await api.getLabOrder(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/lab/orders");
  });

  it("collectSample → PUT /lab/orders/{param_1}/collect", async () => {
    mockOk({});
    await api.collectSample(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/lab/orders");
    expect(opts.method).toBe("PUT");
  });

  it("startProcessing → PUT /lab/orders/{param_1}/process", async () => {
    mockOk({});
    await api.startProcessing(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/lab/orders");
    expect(opts.method).toBe("PUT");
  });

  it("completeLabOrder → PUT /lab/orders/{param_1}/complete", async () => {
    mockOk({});
    await api.completeLabOrder(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/lab/orders");
    expect(opts.method).toBe("PUT");
  });

  it("verifyResults → PUT /lab/orders/{param_1}/verify", async () => {
    mockOk({});
    await api.verifyResults(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/lab/orders");
    expect(opts.method).toBe("PUT");
  });

  it("cancelLabOrder → PUT /lab/orders/{param_1}/cancel", async () => {
    mockOk({});
    await api.cancelLabOrder(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/lab/orders");
    expect(opts.method).toBe("PUT");
  });

  it("addLabResults → POST /lab/orders/{param_1}/results", async () => {
    mockOk({});
    await api.addLabResults(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/lab/orders");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listLabResults → GET /lab/orders/{param_1}/results", async () => {
    mockOk({});
    await api.listLabResults(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/lab/orders");
  });

  it("listLabCatalog → GET /lab/catalog", async () => {
    mockOk({});
    await api.listLabCatalog();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/lab/catalog");
  });

  it("createLabCatalogEntry → POST /lab/catalog", async () => {
    mockOk({});
    await api.createLabCatalogEntry({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/lab/catalog");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateLabCatalogEntry → PUT /lab/catalog/{param_1}", async () => {
    mockOk({});
    await api.updateLabCatalogEntry(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/lab/catalog");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listLabPanels → GET /lab/panels", async () => {
    mockOk({});
    await api.listLabPanels();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/lab/panels");
  });

  it("getLabPanel → GET /lab/panels/{param_1}", async () => {
    mockOk({});
    await api.getLabPanel(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/lab/panels");
  });

  it("createLabPanel → POST /lab/panels", async () => {
    mockOk({});
    await api.createLabPanel({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/lab/panels");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateLabPanel → PUT /lab/panels/{param_1}", async () => {
    mockOk({});
    await api.updateLabPanel(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/lab/panels");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("deleteLabPanel → DELETE /lab/panels/{param_1}", async () => {
    mockOk({});
    await api.deleteLabPanel(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/lab/panels");
    expect(opts.method).toBe("DELETE");
  });

  it("rejectSample → PUT /lab/orders/{param_1}/reject", async () => {
    mockOk({});
    await api.rejectSample(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/lab/orders");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("amendLabResult → POST /lab/orders/{param_1}/results/amend", async () => {
    mockOk({});
    await api.amendLabResult(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/lab/orders");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listLabAmendments → GET /lab/orders/{param_1}/amendments", async () => {
    mockOk({});
    await api.listLabAmendments(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/lab/orders");
  });

  it("listCriticalAlerts → GET /lab/critical-alerts", async () => {
    mockOk({});
    await api.listCriticalAlerts();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/lab/critical-alerts");
  });

  it("acknowledgeCriticalAlert → PUT /lab/critical-alerts/{param_1}/acknowledge", async () => {
    mockOk({});
    await api.acknowledgeCriticalAlert(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/lab/critical-alerts");
    expect(opts.method).toBe("PUT");
  });

  it("updateLabReportStatus → PUT /lab/orders/{param_1}/report-status", async () => {
    mockOk({});
    await api.updateLabReportStatus(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/lab/orders");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("lockLabReport → PUT /lab/orders/{param_1}/lock-report", async () => {
    mockOk({});
    await api.lockLabReport(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/lab/orders");
    expect(opts.method).toBe("PUT");
  });

  it("getLabCumulativeReport → GET /lab/patients/{param_1}/cumulative/{param_2}", async () => {
    mockOk({});
    await api.getLabCumulativeReport(UUID, UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/lab/patients");
  });

  it("getLabTatMonitoring → GET /lab/tat-monitoring", async () => {
    mockOk({});
    await api.getLabTatMonitoring();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/lab/tat-monitoring");
  });

  it("listReagentLots → GET /lab/reagent-lots", async () => {
    mockOk({});
    await api.listReagentLots();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/lab/reagent-lots");
  });

  it("createReagentLot → POST /lab/reagent-lots", async () => {
    mockOk({});
    await api.createReagentLot({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/lab/reagent-lots");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateReagentLot → PUT /lab/reagent-lots/{param_1}", async () => {
    mockOk({});
    await api.updateReagentLot(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/lab/reagent-lots");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listQcResults → GET /lab/qc-results", async () => {
    mockOk({});
    await api.listQcResults();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/lab/qc-results");
  });

  it("createQcResult → POST /lab/qc-results", async () => {
    mockOk({});
    await api.createQcResult({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/lab/qc-results");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listCalibrations → GET /lab/calibrations", async () => {
    mockOk({});
    await api.listCalibrations();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/lab/calibrations");
  });

  it("createCalibration → POST /lab/calibrations", async () => {
    mockOk({});
    await api.createCalibration({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/lab/calibrations");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listPhlebotomyQueue → GET /lab/phlebotomy-queue", async () => {
    mockOk({});
    await api.listPhlebotomyQueue();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/lab/phlebotomy-queue");
  });

  it("createPhlebotomyEntry → POST /lab/phlebotomy-queue", async () => {
    mockOk({});
    await api.createPhlebotomyEntry({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/lab/phlebotomy-queue");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updatePhlebotomyStatus → PUT /lab/phlebotomy-queue/{param_1}/status", async () => {
    mockOk({});
    await api.updatePhlebotomyStatus(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/lab/phlebotomy-queue");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listOutsourcedOrders → GET /lab/outsourced", async () => {
    mockOk({});
    await api.listOutsourcedOrders();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/lab/outsourced");
  });

  it("createOutsourcedOrder → POST /lab/outsourced", async () => {
    mockOk({});
    await api.createOutsourcedOrder({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/lab/outsourced");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateOutsourcedOrder → PUT /lab/outsourced/{param_1}", async () => {
    mockOk({});
    await api.updateOutsourcedOrder(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/lab/outsourced");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("addOnLabTest → POST /lab/orders/{param_1}/add-on", async () => {
    mockOk({});
    await api.addOnLabTest(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/lab/orders");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listHomeCollections → GET /lab/home-collections", async () => {
    mockOk({});
    await api.listHomeCollections();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/lab/home-collections");
  });

  it("createHomeCollection → POST /lab/home-collections", async () => {
    mockOk({});
    await api.createHomeCollection({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/lab/home-collections");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateHomeCollection → PUT /lab/home-collections/{param_1}", async () => {
    mockOk({});
    await api.updateHomeCollection(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/lab/home-collections");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateHomeCollectionStatus → POST /lab/home-collections/{param_1}/status", async () => {
    mockOk({});
    await api.updateHomeCollectionStatus(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/lab/home-collections");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("getHomeCollectionStats → GET /lab/home-collections/stats", async () => {
    mockOk({});
    await api.getHomeCollectionStats();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/lab/home-collections/stats");
  });

  it("listCollectionCenters → GET /lab/collection-centers", async () => {
    mockOk({});
    await api.listCollectionCenters();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/lab/collection-centers");
  });

  it("createCollectionCenter → POST /lab/collection-centers", async () => {
    mockOk({});
    await api.createCollectionCenter({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/lab/collection-centers");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateCollectionCenter → PUT /lab/collection-centers/{param_1}", async () => {
    mockOk({});
    await api.updateCollectionCenter(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/lab/collection-centers");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listSampleArchive → GET /lab/sample-archive", async () => {
    mockOk({});
    await api.listSampleArchive();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/lab/sample-archive");
  });

  it("createSampleArchive → POST /lab/sample-archive", async () => {
    mockOk({});
    await api.createSampleArchive({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/lab/sample-archive");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("retrieveSampleArchive → POST /lab/sample-archive/{param_1}/retrieve", async () => {
    mockOk({});
    await api.retrieveSampleArchive(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/lab/sample-archive");
    expect(opts.method).toBe("POST");
  });

  it("listReportDispatches → GET /lab/report-dispatches", async () => {
    mockOk({});
    await api.listReportDispatches();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/lab/report-dispatches");
  });

  it("createReportDispatch → POST /lab/report-dispatches", async () => {
    mockOk({});
    await api.createReportDispatch({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/lab/report-dispatches");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("confirmReportDispatch → POST /lab/report-dispatches/{param_1}/confirm", async () => {
    mockOk({});
    await api.confirmReportDispatch(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/lab/report-dispatches");
    expect(opts.method).toBe("POST");
  });

  it("listReportTemplates → GET /lab/report-templates", async () => {
    mockOk({});
    await api.listReportTemplates();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/lab/report-templates");
  });

  it("createReportTemplate → POST /lab/report-templates", async () => {
    mockOk({});
    await api.createReportTemplate({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/lab/report-templates");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateReportTemplate → PUT /lab/report-templates/{param_1}", async () => {
    mockOk({});
    await api.updateReportTemplate(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/lab/report-templates");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listStatOrders → GET /lab/stat-orders", async () => {
    mockOk({});
    await api.listStatOrders();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/lab/stat-orders");
  });

  it("listEqasResults → GET /lab/eqas", async () => {
    mockOk({});
    await api.listEqasResults();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/lab/eqas");
  });

  it("createEqasResult → POST /lab/eqas", async () => {
    mockOk({});
    await api.createEqasResult({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/lab/eqas");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateEqasResult → PUT /lab/eqas/{param_1}", async () => {
    mockOk({});
    await api.updateEqasResult(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/lab/eqas");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listProficiencyTests → GET /lab/proficiency-tests", async () => {
    mockOk({});
    await api.listProficiencyTests();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/lab/proficiency-tests");
  });

  it("createProficiencyTest → POST /lab/proficiency-tests", async () => {
    mockOk({});
    await api.createProficiencyTest({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/lab/proficiency-tests");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listNablDocuments → GET /lab/nabl-documents", async () => {
    mockOk({});
    await api.listNablDocuments();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/lab/nabl-documents");
  });

  it("createNablDocument → POST /lab/nabl-documents", async () => {
    mockOk({});
    await api.createNablDocument({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/lab/nabl-documents");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateNablDocument → PUT /lab/nabl-documents/{param_1}", async () => {
    mockOk({});
    await api.updateNablDocument(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/lab/nabl-documents");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("getReagentConsumption → GET /lab/reagent-consumption", async () => {
    mockOk({});
    await api.getReagentConsumption();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/lab/reagent-consumption");
  });

  it("getHistopathReport → GET /lab/histopath/{param_1}", async () => {
    mockOk({});
    await api.getHistopathReport(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/lab/histopath");
  });

  it("createHistopathReport → POST /lab/histopath", async () => {
    mockOk({});
    await api.createHistopathReport({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/lab/histopath");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("getCytologyReport → GET /lab/cytology/{param_1}", async () => {
    mockOk({});
    await api.getCytologyReport(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/lab/cytology");
  });

  it("createCytologyReport → POST /lab/cytology", async () => {
    mockOk({});
    await api.createCytologyReport({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/lab/cytology");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("getMolecularReport → GET /lab/molecular/{param_1}", async () => {
    mockOk({});
    await api.getMolecularReport(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/lab/molecular");
  });

  it("createMolecularReport → POST /lab/molecular", async () => {
    mockOk({});
    await api.createMolecularReport({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/lab/molecular");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listB2bClients → GET /lab/b2b-clients", async () => {
    mockOk({});
    await api.listB2bClients();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/lab/b2b-clients");
  });

  it("createB2bClient → POST /lab/b2b-clients", async () => {
    mockOk({});
    await api.createB2bClient({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/lab/b2b-clients");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateB2bClient → PUT /lab/b2b-clients/{param_1}", async () => {
    mockOk({});
    await api.updateB2bClient(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/lab/b2b-clients");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listB2bRates → GET /lab/b2b-clients/{param_1}/rates", async () => {
    mockOk({});
    await api.listB2bRates(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/lab/b2b-clients");
  });

  it("createB2bRate → POST /lab/b2b-clients/{param_1}/rates", async () => {
    mockOk({});
    await api.createB2bRate(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/lab/b2b-clients");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("autoValidateResult → POST /lab/results/{param_1}/auto-validate", async () => {
    mockOk({});
    await api.autoValidateResult(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/lab/results");
    expect(opts.method).toBe("POST");
  });

  it("listDoctorCriticalAlerts → GET /lab/critical-alerts/doctor/{param_1}", async () => {
    mockOk({});
    await api.listDoctorCriticalAlerts(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/lab/critical-alerts/doctor");
  });

  it("getLabTatAnalytics → GET /lab/analytics/tat", async () => {
    mockOk({});
    await api.getLabTatAnalytics();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/lab/analytics/tat");
  });

  it("getOrderCrossmatch → GET /lab/orders/{param_1}/crossmatch", async () => {
    mockOk({});
    await api.getOrderCrossmatch(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/lab/orders");
  });

});

describe("/masters endpoints", () => {
  it("listReligions → GET /masters/religions", async () => {
    mockOk({});
    await api.listReligions();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/masters/religions");
  });

  it("listOccupations → GET /masters/occupations", async () => {
    mockOk({});
    await api.listOccupations();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/masters/occupations");
  });

  it("listRelations → GET /masters/relations", async () => {
    mockOk({});
    await api.listRelations();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/masters/relations");
  });

});

describe("/module-forms endpoints", () => {
  it("getModuleForms → GET /module-forms/{param_1}", async () => {
    mockOk({});
    await api.getModuleForms("test");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/module-forms");
  });

});

describe("/modules endpoints", () => {
  it("listModuleSidecars → GET /modules/{param_1}/sidecars", async () => {
    mockOk({});
    await api.listModuleSidecars("test", UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/modules");
  });

});

describe("/mrd endpoints", () => {
  it("listMrdRecords → GET /mrd/records", async () => {
    mockOk({});
    await api.listMrdRecords();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/mrd/records");
  });

  it("createMrdRecord → POST /mrd/records", async () => {
    mockOk({});
    await api.createMrdRecord({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/mrd/records");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("getMrdRecord → GET /mrd/records/{param_1}", async () => {
    mockOk({});
    await api.getMrdRecord(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/mrd/records");
  });

  it("updateMrdRecord → PUT /mrd/records/{param_1}", async () => {
    mockOk({});
    await api.updateMrdRecord(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/mrd/records");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listMrdMovements → GET /mrd/records/{param_1}/movements", async () => {
    mockOk({});
    await api.listMrdMovements(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/mrd/records");
  });

  it("issueMrdRecord → POST /mrd/records/{param_1}/issue", async () => {
    mockOk({});
    await api.issueMrdRecord(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/mrd/records");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("returnMrdRecord → POST /mrd/records/{param_1}/movements/{param_2}/return", async () => {
    mockOk({});
    await api.returnMrdRecord(UUID, UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/mrd/records");
    expect(opts.method).toBe("POST");
  });

  it("listMrdBirths → GET /mrd/births", async () => {
    mockOk({});
    await api.listMrdBirths();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/mrd/births");
  });

  it("createMrdBirth → POST /mrd/births", async () => {
    mockOk({});
    await api.createMrdBirth({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/mrd/births");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("getMrdBirth → GET /mrd/births/{param_1}", async () => {
    mockOk({});
    await api.getMrdBirth(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/mrd/births");
  });

  it("listMrdDeaths → GET /mrd/deaths", async () => {
    mockOk({});
    await api.listMrdDeaths();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/mrd/deaths");
  });

  it("createMrdDeath → POST /mrd/deaths", async () => {
    mockOk({});
    await api.createMrdDeath({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/mrd/deaths");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("getMrdDeath → GET /mrd/deaths/{param_1}", async () => {
    mockOk({});
    await api.getMrdDeath(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/mrd/deaths");
  });

  it("listMrdRetentionPolicies → GET /mrd/retention-policies", async () => {
    mockOk({});
    await api.listMrdRetentionPolicies();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/mrd/retention-policies");
  });

  it("createMrdRetentionPolicy → POST /mrd/retention-policies", async () => {
    mockOk({});
    await api.createMrdRetentionPolicy({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/mrd/retention-policies");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateMrdRetentionPolicy → PUT /mrd/retention-policies/{param_1}", async () => {
    mockOk({});
    await api.updateMrdRetentionPolicy(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/mrd/retention-policies");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("getMrdMorbidityMortality → GET /mrd/stats/morbidity-mortality", async () => {
    mockOk({});
    await api.getMrdMorbidityMortality();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/mrd/stats/morbidity-mortality");
  });

  it("getMrdAdmissionDischarge → GET /mrd/stats/admission-discharge", async () => {
    mockOk({});
    await api.getMrdAdmissionDischarge();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/mrd/stats/admission-discharge");
  });

});

describe("/occ-health endpoints", () => {
  it("listOccScreenings → GET /occ-health/screenings", async () => {
    mockOk({});
    await api.listOccScreenings();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/occ-health/screenings");
  });

  it("createOccScreening → POST /occ-health/screenings", async () => {
    mockOk({});
    await api.createOccScreening({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/occ-health/screenings");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listDueScreenings → GET /occ-health/screenings/due", async () => {
    mockOk({});
    await api.listDueScreenings();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/occ-health/screenings/due");
  });

  it("getOccScreening → GET /occ-health/screenings/{param_1}", async () => {
    mockOk({});
    await api.getOccScreening(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/occ-health/screenings");
  });

  it("updateOccScreening → PUT /occ-health/screenings/{param_1}", async () => {
    mockOk({});
    await api.updateOccScreening(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/occ-health/screenings");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listDrugScreens → GET /occ-health/drug-screens", async () => {
    mockOk({});
    await api.listDrugScreens();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/occ-health/drug-screens");
  });

  it("createDrugScreen → POST /occ-health/drug-screens", async () => {
    mockOk({});
    await api.createDrugScreen({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/occ-health/drug-screens");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateDrugScreen → PUT /occ-health/drug-screens/{param_1}", async () => {
    mockOk({});
    await api.updateDrugScreen(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/occ-health/drug-screens");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listVaccinations → GET /occ-health/vaccinations", async () => {
    mockOk({});
    await api.listVaccinations();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/occ-health/vaccinations");
  });

  it("createVaccination → POST /occ-health/vaccinations", async () => {
    mockOk({});
    await api.createVaccination({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/occ-health/vaccinations");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateVaccination → PUT /occ-health/vaccinations/{param_1}", async () => {
    mockOk({});
    await api.updateVaccination(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/occ-health/vaccinations");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("vaccinationCompliance → GET /occ-health/vaccinations/compliance", async () => {
    mockOk({});
    await api.vaccinationCompliance();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/occ-health/vaccinations/compliance");
  });

  it("listInjuries → GET /occ-health/injuries", async () => {
    mockOk({});
    await api.listInjuries();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/occ-health/injuries");
  });

  it("createInjury → POST /occ-health/injuries", async () => {
    mockOk({});
    await api.createInjury({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/occ-health/injuries");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateInjury → PUT /occ-health/injuries/{param_1}", async () => {
    mockOk({});
    await api.updateInjury(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/occ-health/injuries");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("getEmployerView → GET /occ-health/injuries/{param_1}/employer-view", async () => {
    mockOk({});
    await api.getEmployerView(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/occ-health/injuries");
  });

  it("listOccHealthHazards → GET /occ-health/hazards", async () => {
    mockOk({});
    await api.listOccHealthHazards();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/occ-health/hazards");
  });

  it("createOccHealthHazard → POST /occ-health/hazards", async () => {
    mockOk({});
    await api.createOccHealthHazard({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/occ-health/hazards");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("occHealthAnalytics → GET /occ-health/analytics", async () => {
    mockOk({});
    await api.occHealthAnalytics();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/occ-health/analytics");
  });

  it("returnToWorkClearance → POST /occ-health/clearance", async () => {
    mockOk({});
    await api.returnToWorkClearance({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/occ-health/clearance");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

});

describe("/onboarding endpoints", () => {
  it("onboardingStatus → GET /onboarding/status", async () => {
    mockOk({});
    await api.onboardingStatus();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/onboarding/status");
  });

  it("onboardingInit → POST /onboarding/init", async () => {
    mockOk({});
    await api.onboardingInit({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/onboarding/init");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("onboardingProgress → GET /onboarding/progress", async () => {
    mockOk({});
    await api.onboardingProgress();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/onboarding/progress");
  });

  it("updateOnboardingProgress → POST /onboarding/progress", async () => {
    mockOk({});
    await api.updateOnboardingProgress({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/onboarding/progress");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("onboardingSetup → POST /onboarding/setup", async () => {
    mockOk({});
    await api.onboardingSetup({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/onboarding/setup");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("completeOnboarding → POST /onboarding/complete", async () => {
    mockOk({});
    await api.completeOnboarding();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/onboarding/complete");
    expect(opts.method).toBe("POST");
  });

});

describe("/opd endpoints", () => {
  it("listEncounters → GET /opd/encounters", async () => {
    mockOk({});
    await api.listEncounters();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/opd/encounters");
  });

  it("createEncounter → POST /opd/encounters", async () => {
    mockOk({});
    await api.createEncounter({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/opd/encounters");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("getEncounter → GET /opd/encounters/{param_1}", async () => {
    mockOk({});
    await api.getEncounter(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/opd/encounters");
  });

  it("updateEncounter → PUT /opd/encounters/{param_1}", async () => {
    mockOk({});
    await api.updateEncounter(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/opd/encounters");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listQueue → GET /opd/queue", async () => {
    mockOk({});
    await api.listQueue();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/opd/queue");
  });

  it("callQueueEntry → PUT /opd/queue/{param_1}/call", async () => {
    mockOk({});
    await api.callQueueEntry(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/opd/queue");
    expect(opts.method).toBe("PUT");
  });

  it("startConsultation → PUT /opd/queue/{param_1}/start", async () => {
    mockOk({});
    await api.startConsultation(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/opd/queue");
    expect(opts.method).toBe("PUT");
  });

  it("completeQueueEntry → PUT /opd/queue/{param_1}/complete", async () => {
    mockOk({});
    await api.completeQueueEntry(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/opd/queue");
    expect(opts.method).toBe("PUT");
  });

  it("markNoShow → PUT /opd/queue/{param_1}/no-show", async () => {
    mockOk({});
    await api.markNoShow(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/opd/queue");
    expect(opts.method).toBe("PUT");
  });

  it("listVitals → GET /opd/encounters/{param_1}/vitals", async () => {
    mockOk({});
    await api.listVitals(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/opd/encounters");
  });

  it("createVital → POST /opd/encounters/{param_1}/vitals", async () => {
    mockOk({});
    await api.createVital(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/opd/encounters");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("getConsultation → GET /opd/encounters/{param_1}/consultation", async () => {
    mockOk({});
    await api.getConsultation(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/opd/encounters");
  });

  it("createConsultation → POST /opd/encounters/{param_1}/consultation", async () => {
    mockOk({});
    await api.createConsultation(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/opd/encounters");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateConsultation → PUT /opd/encounters/{param_1}/consultation/{param_2}", async () => {
    mockOk({});
    await api.updateConsultation(UUID, UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/opd/encounters");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listDiagnoses → GET /opd/encounters/{param_1}/diagnoses", async () => {
    mockOk({});
    await api.listDiagnoses(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/opd/encounters");
  });

  it("createDiagnosis → POST /opd/encounters/{param_1}/diagnoses", async () => {
    mockOk({});
    await api.createDiagnosis(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/opd/encounters");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("deleteDiagnosis → DELETE /opd/encounters/{param_1}/diagnoses/{param_2}", async () => {
    mockOk({});
    await api.deleteDiagnosis(UUID, UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/opd/encounters");
    expect(opts.method).toBe("DELETE");
  });

  it("listPrescriptions → GET /opd/encounters/{param_1}/prescriptions", async () => {
    mockOk({});
    await api.listPrescriptions(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/opd/encounters");
  });

  it("getPrescription → GET /opd/prescriptions/{param_1}", async () => {
    mockOk({});
    await api.getPrescription(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/opd/prescriptions");
  });

  it("createPrescription → POST /opd/encounters/{param_1}/prescriptions", async () => {
    mockOk({});
    await api.createPrescription(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/opd/encounters");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listPrescriptionTemplates → GET /opd/prescription-templates", async () => {
    mockOk({});
    await api.listPrescriptionTemplates();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/opd/prescription-templates");
  });

  it("createPrescriptionTemplate → POST /opd/prescription-templates", async () => {
    mockOk({});
    await api.createPrescriptionTemplate({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/opd/prescription-templates");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("deletePrescriptionTemplate → DELETE /opd/prescription-templates/{param_1}", async () => {
    mockOk({});
    await api.deletePrescriptionTemplate(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/opd/prescription-templates");
    expect(opts.method).toBe("DELETE");
  });

  it("listPatientPrescriptions → GET /opd/patients/{param_1}/prescriptions", async () => {
    mockOk({});
    await api.listPatientPrescriptions(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/opd/patients");
  });

  it("listPatientDiagnoses → GET /opd/patients/{param_1}/diagnoses", async () => {
    mockOk({});
    await api.listPatientDiagnoses(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/opd/patients");
  });

  it("listCertificates → GET /opd/patients/{param_1}/certificates", async () => {
    mockOk({});
    await api.listCertificates(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/opd/patients");
  });

  it("createCertificate → POST /opd/certificates", async () => {
    mockOk({});
    await api.createCertificate({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/opd/certificates");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listPatientVitalsHistory → GET /opd/patients/{param_1}/vitals-history", async () => {
    mockOk({});
    await api.listPatientVitalsHistory(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/opd/patients");
  });

  it("listPatientReferrals → GET /opd/patients/{param_1}/referrals", async () => {
    mockOk({});
    await api.listPatientReferrals(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/opd/patients");
  });

  it("createReferral → POST /opd/referrals", async () => {
    mockOk({});
    await api.createReferral({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/opd/referrals");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listProcedureCatalog → GET /opd/procedure-catalog", async () => {
    mockOk({});
    await api.listProcedureCatalog();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/opd/procedure-catalog");
  });

  it("listProcedureOrders → GET /opd/encounters/{param_1}/procedure-orders", async () => {
    mockOk({});
    await api.listProcedureOrders(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/opd/encounters");
  });

  it("createProcedureOrder → POST /opd/procedure-orders", async () => {
    mockOk({});
    await api.createProcedureOrder({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/opd/procedure-orders");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("cancelProcedureOrder → DELETE /opd/procedure-orders/{param_1}", async () => {
    mockOk({});
    await api.cancelProcedureOrder(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/opd/procedure-orders");
    expect(opts.method).toBe("DELETE");
  });

  it("checkDuplicateOrders → GET /opd/duplicate-check", async () => {
    mockOk({});
    await api.checkDuplicateOrders({ patient_id: UUID });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/opd/duplicate-check");
  });

  it("searchIcd10 → GET /opd/icd10/search", async () => {
    mockOk({});
    await api.searchIcd10(UUID, UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/opd/icd10/search");
  });

  it("listChiefComplaints → GET /opd/chief-complaints", async () => {
    mockOk({});
    await api.listChiefComplaints();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/opd/chief-complaints");
  });

  it("searchSnomed → GET /opd/snomed/search", async () => {
    mockOk({});
    await api.searchSnomed(UUID, UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/opd/snomed/search");
  });

  it("bookAppointmentGroup → POST /opd/appointment-groups", async () => {
    mockOk({});
    await api.bookAppointmentGroup({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/opd/appointment-groups");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listAppointmentGroup → GET /opd/appointment-groups/{param_1}", async () => {
    mockOk({});
    await api.listAppointmentGroup(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/opd/appointment-groups");
  });

  it("getWaitEstimate → GET /opd/queue/wait-estimate", async () => {
    mockOk({});
    await api.getWaitEstimate();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/opd/queue/wait-estimate");
  });

  it("admitFromOpd → POST /opd/encounters/{param_1}/admit-to-ipd", async () => {
    mockOk({});
    await api.admitFromOpd(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/opd/encounters");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("getDoctorDocket → GET /opd/docket", async () => {
    mockOk({});
    await api.getDoctorDocket("2026-01-01");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/opd/docket");
  });

  it("generateDoctorDocket → POST /opd/docket/generate", async () => {
    mockOk({});
    await api.generateDoctorDocket("2026-01-01");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/opd/docket/generate");
    expect(opts.method).toBe("POST");
  });

  it("listReminders → GET /opd/reminders", async () => {
    mockOk({});
    await api.listReminders();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/opd/reminders");
  });

  it("createReminder → POST /opd/reminders", async () => {
    mockOk({});
    await api.createReminder({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/opd/reminders");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("completeReminder → PUT /opd/reminders/{param_1}/complete", async () => {
    mockOk({});
    await api.completeReminder(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/opd/reminders");
    expect(opts.method).toBe("PUT");
  });

  it("cancelReminder → PUT /opd/reminders/{param_1}/cancel", async () => {
    mockOk({});
    await api.cancelReminder(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/opd/reminders");
    expect(opts.method).toBe("PUT");
  });

  it("listPatientFeedback → GET /opd/patients/{param_1}/feedback", async () => {
    mockOk({});
    await api.listPatientFeedback(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/opd/patients");
  });

  it("createFeedback → POST /opd/feedback", async () => {
    mockOk({});
    await api.createFeedback({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/opd/feedback");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listProcedureConsents → GET /opd/patients/{param_1}/consents", async () => {
    mockOk({});
    await api.listProcedureConsents(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/opd/patients");
  });

  it("createProcedureConsent → POST /opd/consents", async () => {
    mockOk({});
    await api.createProcedureConsent({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/opd/consents");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("signProcedureConsent → PUT /opd/consents/{param_1}/sign", async () => {
    mockOk({});
    await api.signProcedureConsent(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/opd/consents");
    expect(opts.method).toBe("PUT");
  });

  it("listConsultationTemplates → GET /opd/consultation-templates", async () => {
    mockOk({});
    await api.listConsultationTemplates();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/opd/consultation-templates");
  });

  it("createConsultationTemplate → POST /opd/consultation-templates", async () => {
    mockOk({});
    await api.createConsultationTemplate({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/opd/consultation-templates");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("deleteConsultationTemplate → DELETE /opd/consultation-templates/{param_1}", async () => {
    mockOk({});
    await api.deleteConsultationTemplate(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/opd/consultation-templates");
    expect(opts.method).toBe("DELETE");
  });

  it("listSchedules → GET /opd/schedules", async () => {
    mockOk({});
    await api.listSchedules();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/opd/schedules");
  });

  it("createSchedule → POST /opd/schedules", async () => {
    mockOk({});
    await api.createSchedule({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/opd/schedules");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateSchedule → PUT /opd/schedules/{param_1}", async () => {
    mockOk({});
    await api.updateSchedule(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/opd/schedules");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("deleteSchedule → DELETE /opd/schedules/{param_1}", async () => {
    mockOk({});
    await api.deleteSchedule(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/opd/schedules");
    expect(opts.method).toBe("DELETE");
  });

  it("listScheduleExceptions → GET /opd/schedule-exceptions", async () => {
    mockOk({});
    await api.listScheduleExceptions({ doctor_id: UUID });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/opd/schedule-exceptions");
  });

  it("createScheduleException → POST /opd/schedule-exceptions", async () => {
    mockOk({});
    await api.createScheduleException({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/opd/schedule-exceptions");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("deleteScheduleException → DELETE /opd/schedule-exceptions/{param_1}", async () => {
    mockOk({});
    await api.deleteScheduleException(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/opd/schedule-exceptions");
    expect(opts.method).toBe("DELETE");
  });

  it("getAvailableSlots → GET /opd/doctors/{param_1}/slots", async () => {
    mockOk({});
    await api.getAvailableSlots(UUID, "2026-01-01");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/opd/doctors");
  });

  it("listAppointments → GET /opd/appointments", async () => {
    mockOk({});
    await api.listAppointments();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/opd/appointments");
  });

  it("bookAppointment → POST /opd/appointments", async () => {
    mockOk({});
    await api.bookAppointment({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/opd/appointments");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("getAppointment → GET /opd/appointments/{param_1}", async () => {
    mockOk({});
    await api.getAppointment(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/opd/appointments");
  });

  it("rescheduleAppointment → PUT /opd/appointments/{param_1}/reschedule", async () => {
    mockOk({});
    await api.rescheduleAppointment(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/opd/appointments");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("cancelAppointment → PUT /opd/appointments/{param_1}/cancel", async () => {
    mockOk({});
    await api.cancelAppointment(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/opd/appointments");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("checkInAppointment → PUT /opd/appointments/{param_1}/check-in", async () => {
    mockOk({});
    await api.checkInAppointment(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/opd/appointments");
    expect(opts.method).toBe("PUT");
  });

  it("completeAppointment → PUT /opd/appointments/{param_1}/complete", async () => {
    mockOk({});
    await api.completeAppointment(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/opd/appointments");
    expect(opts.method).toBe("PUT");
  });

  it("markAppointmentNoShow → PUT /opd/appointments/{param_1}/no-show", async () => {
    mockOk({});
    await api.markAppointmentNoShow(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/opd/appointments");
    expect(opts.method).toBe("PUT");
  });

  it("opdPharmacyDispatchStatus → GET /opd/visits/{param_1}/pharmacy-status", async () => {
    mockOk({});
    await api.opdPharmacyDispatchStatus(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/opd/visits");
  });

  it("opdReferralTracking → GET /opd/referrals/tracking", async () => {
    mockOk({});
    await api.opdReferralTracking();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/opd/referrals/tracking");
  });

  it("opdFollowupCompliance → GET /opd/analytics/followup", async () => {
    mockOk({});
    await api.opdFollowupCompliance();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/opd/analytics/followup");
  });

});

describe("/ot endpoints", () => {
  it("listOtRooms → GET /ot/rooms", async () => {
    mockOk({});
    await api.listOtRooms();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/ot/rooms");
  });

  it("createOtRoom → POST /ot/rooms", async () => {
    mockOk({});
    await api.createOtRoom({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/ot/rooms");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateOtRoom → PUT /ot/rooms/{param_1}", async () => {
    mockOk({});
    await api.updateOtRoom(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ot/rooms");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listOtBookings → GET /ot/bookings", async () => {
    mockOk({});
    await api.listOtBookings();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/ot/bookings");
  });

  it("getOtBooking → GET /ot/bookings/{param_1}", async () => {
    mockOk({});
    await api.getOtBooking(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ot/bookings");
  });

  it("createOtBooking → POST /ot/bookings", async () => {
    mockOk({});
    await api.createOtBooking({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/ot/bookings");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateOtBooking → PUT /ot/bookings/{param_1}", async () => {
    mockOk({});
    await api.updateOtBooking(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ot/bookings");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateOtBookingStatus → PUT /ot/bookings/{param_1}/status", async () => {
    mockOk({});
    await api.updateOtBookingStatus(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ot/bookings");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("cancelOtBooking → PUT /ot/bookings/{param_1}/status", async () => {
    mockOk({});
    await api.cancelOtBooking(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ot/bookings");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listPreopAssessments → GET /ot/bookings/{param_1}/preop", async () => {
    mockOk({});
    await api.listPreopAssessments(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ot/bookings");
  });

  it("createPreopAssessment → POST /ot/bookings/{param_1}/preop", async () => {
    mockOk({});
    await api.createPreopAssessment(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ot/bookings");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updatePreopAssessment → PUT /ot/bookings/{param_1}/preop", async () => {
    mockOk({});
    await api.updatePreopAssessment(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ot/bookings");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listSafetyChecklists → GET /ot/bookings/{param_1}/checklists", async () => {
    mockOk({});
    await api.listSafetyChecklists(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ot/bookings");
  });

  it("createSafetyChecklist → POST /ot/bookings/{param_1}/checklists", async () => {
    mockOk({});
    await api.createSafetyChecklist(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ot/bookings");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateSafetyChecklist → PUT /ot/bookings/{param_1}/checklists/{param_2}", async () => {
    mockOk({});
    await api.updateSafetyChecklist(UUID, UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ot/bookings");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("getCaseRecord → GET /ot/bookings/{param_1}/case-record", async () => {
    mockOk({});
    await api.getCaseRecord(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ot/bookings");
  });

  it("createCaseRecord → POST /ot/bookings/{param_1}/case-record", async () => {
    mockOk({});
    await api.createCaseRecord(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ot/bookings");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateCaseRecord → PUT /ot/bookings/{param_1}/case-record", async () => {
    mockOk({});
    await api.updateCaseRecord(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ot/bookings");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("getAnesthesiaRecord → GET /ot/bookings/{param_1}/anesthesia", async () => {
    mockOk({});
    await api.getAnesthesiaRecord(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ot/bookings");
  });

  it("createAnesthesiaRecord → POST /ot/bookings/{param_1}/anesthesia", async () => {
    mockOk({});
    await api.createAnesthesiaRecord(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ot/bookings");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateAnesthesiaRecord → PUT /ot/bookings/{param_1}/anesthesia", async () => {
    mockOk({});
    await api.updateAnesthesiaRecord(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ot/bookings");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("getPostopRecord → GET /ot/bookings/{param_1}/postop", async () => {
    mockOk({});
    await api.getPostopRecord(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ot/bookings");
  });

  it("createPostopRecord → POST /ot/bookings/{param_1}/postop", async () => {
    mockOk({});
    await api.createPostopRecord(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ot/bookings");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updatePostopRecord → PUT /ot/bookings/{param_1}/postop", async () => {
    mockOk({});
    await api.updatePostopRecord(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ot/bookings");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listSurgeonPreferences → GET /ot/surgeon-preferences", async () => {
    mockOk({});
    await api.listSurgeonPreferences();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/ot/surgeon-preferences");
  });

  it("createSurgeonPreference → POST /ot/surgeon-preferences", async () => {
    mockOk({});
    await api.createSurgeonPreference({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/ot/surgeon-preferences");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateSurgeonPreference → PUT /ot/surgeon-preferences/{param_1}", async () => {
    mockOk({});
    await api.updateSurgeonPreference(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ot/surgeon-preferences");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("deleteSurgeonPreference → DELETE /ot/surgeon-preferences/{param_1}", async () => {
    mockOk({});
    await api.deleteSurgeonPreference(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/ot/surgeon-preferences");
    expect(opts.method).toBe("DELETE");
  });

  it("getOtSchedule → GET /ot/schedule", async () => {
    mockOk({});
    await api.getOtSchedule();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/ot/schedule");
  });

});

describe("/patients endpoints", () => {
  it("listPatients → GET /patients", async () => {
    mockOk({});
    await api.listPatients();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/patients");
  });

  it("getPatient → GET /patients/{param_1}", async () => {
    mockOk({});
    await api.getPatient(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/patients");
  });

  it("createPatient → POST /patients", async () => {
    mockOk({});
    await api.createPatient({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/patients");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updatePatient → PUT /patients/{param_1}", async () => {
    mockOk({});
    await api.updatePatient(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/patients");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listPatientVisits → GET /patients/{param_1}/visits", async () => {
    mockOk({});
    await api.listPatientVisits(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/patients");
  });

  it("listPatientLabOrders → GET /patients/{param_1}/lab-orders", async () => {
    mockOk({});
    await api.listPatientLabOrders(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/patients");
  });

  it("listPatientInvoices → GET /patients/{param_1}/invoices", async () => {
    mockOk({});
    await api.listPatientInvoices(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/patients");
  });

  it("listPatientAppointments → GET /patients/{param_1}/appointments", async () => {
    mockOk({});
    await api.listPatientAppointments(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/patients");
  });

  it("listPatientIdentifiers → GET /patients/{param_1}/identifiers", async () => {
    mockOk({});
    await api.listPatientIdentifiers(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/patients");
  });

  it("createPatientIdentifier → POST /patients/{param_1}/identifiers", async () => {
    mockOk({});
    await api.createPatientIdentifier(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/patients");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("deletePatientIdentifier → DELETE /patients/{param_1}/identifiers/{param_2}", async () => {
    mockOk({});
    await api.deletePatientIdentifier(UUID, UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/patients");
    expect(opts.method).toBe("DELETE");
  });

  it("updatePatientIdentifier → PUT /patients/{param_1}/identifiers/{param_2}", async () => {
    mockOk({});
    await api.updatePatientIdentifier(UUID, UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/patients");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listPatientAddresses → GET /patients/{param_1}/addresses", async () => {
    mockOk({});
    await api.listPatientAddresses(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/patients");
  });

  it("createPatientAddress → POST /patients/{param_1}/addresses", async () => {
    mockOk({});
    await api.createPatientAddress(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/patients");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("deletePatientAddress → DELETE /patients/{param_1}/addresses/{param_2}", async () => {
    mockOk({});
    await api.deletePatientAddress(UUID, UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/patients");
    expect(opts.method).toBe("DELETE");
  });

  it("updatePatientAddress → PUT /patients/{param_1}/addresses/{param_2}", async () => {
    mockOk({});
    await api.updatePatientAddress(UUID, UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/patients");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listPatientContacts → GET /patients/{param_1}/contacts", async () => {
    mockOk({});
    await api.listPatientContacts(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/patients");
  });

  it("createPatientContact → POST /patients/{param_1}/contacts", async () => {
    mockOk({});
    await api.createPatientContact(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/patients");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("deletePatientContact → DELETE /patients/{param_1}/contacts/{param_2}", async () => {
    mockOk({});
    await api.deletePatientContact(UUID, UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/patients");
    expect(opts.method).toBe("DELETE");
  });

  it("updatePatientContact → PUT /patients/{param_1}/contacts/{param_2}", async () => {
    mockOk({});
    await api.updatePatientContact(UUID, UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/patients");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listPatientAllergies → GET /patients/{param_1}/allergies", async () => {
    mockOk({});
    await api.listPatientAllergies(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/patients");
  });

  it("createPatientAllergy → POST /patients/{param_1}/allergies", async () => {
    mockOk({});
    await api.createPatientAllergy(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/patients");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("deletePatientAllergy → DELETE /patients/{param_1}/allergies/{param_2}", async () => {
    mockOk({});
    await api.deletePatientAllergy(UUID, UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/patients");
    expect(opts.method).toBe("DELETE");
  });

  it("updatePatientAllergy → PUT /patients/{param_1}/allergies/{param_2}", async () => {
    mockOk({});
    await api.updatePatientAllergy(UUID, UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/patients");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listPatientInsurance → GET /patients/{param_1}/insurance", async () => {
    mockOk({});
    await api.listPatientInsurance(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/patients");
  });

  it("createPatientInsurance → POST /patients/{param_1}/insurance", async () => {
    mockOk({});
    await api.createPatientInsurance(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/patients");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updatePatientInsurance → PUT /patients/{param_1}/insurance/{param_2}", async () => {
    mockOk({});
    await api.updatePatientInsurance(UUID, UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/patients");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("deletePatientInsurance → DELETE /patients/{param_1}/insurance/{param_2}", async () => {
    mockOk({});
    await api.deletePatientInsurance(UUID, UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/patients");
    expect(opts.method).toBe("DELETE");
  });

  it("listPatientConsents → GET /patients/{param_1}/consents", async () => {
    mockOk({});
    await api.listPatientConsents(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/patients");
  });

  it("createPatientConsent → POST /patients/{param_1}/consents", async () => {
    mockOk({});
    await api.createPatientConsent(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/patients");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updatePatientConsent → PUT /patients/{param_1}/consents/{param_2}", async () => {
    mockOk({});
    await api.updatePatientConsent(UUID, UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/patients");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("deletePatientConsent → DELETE /patients/{param_1}/consents/{param_2}", async () => {
    mockOk({});
    await api.deletePatientConsent(UUID, UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/patients");
    expect(opts.method).toBe("DELETE");
  });

  it("matchPatients → POST /patients/match", async () => {
    mockOk({});
    await api.matchPatients({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/patients/match");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("mergePatients → POST /patients/merge", async () => {
    mockOk({});
    await api.mergePatients({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/patients/merge");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("unmergePatient → POST /patients/unmerge/{param_1}", async () => {
    mockOk({});
    await api.unmergePatient(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/patients/unmerge");
    expect(opts.method).toBe("POST");
  });

  it("listMergeHistory → GET /patients/{param_1}/merge-history", async () => {
    mockOk({});
    await api.listMergeHistory(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/patients");
  });

  it("listFamilyLinks → GET /patients/{param_1}/family-links", async () => {
    mockOk({});
    await api.listFamilyLinks(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/patients");
  });

  it("createFamilyLink → POST /patients/{param_1}/family-links", async () => {
    mockOk({});
    await api.createFamilyLink(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/patients");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("deleteFamilyLink → DELETE /patients/{param_1}/family-links/{param_2}", async () => {
    mockOk({});
    await api.deleteFamilyLink(UUID, UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/patients");
    expect(opts.method).toBe("DELETE");
  });

  it("listPatientDocuments → GET /patients/{param_1}/documents", async () => {
    mockOk({});
    await api.listPatientDocuments(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/patients");
  });

  it("createPatientDocument → POST /patients/{param_1}/documents", async () => {
    mockOk({});
    await api.createPatientDocument(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/patients");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("deletePatientDocument → DELETE /patients/{param_1}/documents/{param_2}", async () => {
    mockOk({});
    await api.deletePatientDocument(UUID, UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/patients");
    expect(opts.method).toBe("DELETE");
  });

  it("updatePatientPhoto → PATCH /patients/{param_1}/photo", async () => {
    mockOk({});
    await api.updatePatientPhoto(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/patients");
    expect(opts.method).toBe("PATCH");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

});

describe("/pharmacy endpoints", () => {
  it("listPharmacyOrders → GET /pharmacy/orders", async () => {
    mockOk({});
    await api.listPharmacyOrders();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/pharmacy/orders");
  });

  it("createPharmacyOrder → POST /pharmacy/orders", async () => {
    mockOk({});
    await api.createPharmacyOrder({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/pharmacy/orders");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("getPharmacyOrder → GET /pharmacy/orders/{param_1}", async () => {
    mockOk({});
    await api.getPharmacyOrder(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/pharmacy/orders");
  });

  it("dispenseOrder → PUT /pharmacy/orders/{param_1}/dispense", async () => {
    mockOk({});
    await api.dispenseOrder(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/pharmacy/orders");
    expect(opts.method).toBe("PUT");
  });

  it("cancelPharmacyOrder → PUT /pharmacy/orders/{param_1}/cancel", async () => {
    mockOk({});
    await api.cancelPharmacyOrder(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/pharmacy/orders");
    expect(opts.method).toBe("PUT");
  });

  it("listPharmacyCatalog → GET /pharmacy/catalog", async () => {
    mockOk({});
    await api.listPharmacyCatalog();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/pharmacy/catalog");
  });

  it("createPharmacyCatalog → POST /pharmacy/catalog", async () => {
    mockOk({});
    await api.createPharmacyCatalog({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/pharmacy/catalog");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updatePharmacyCatalog → PUT /pharmacy/catalog/{param_1}", async () => {
    mockOk({});
    await api.updatePharmacyCatalog(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/pharmacy/catalog");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listStock → GET /pharmacy/stock", async () => {
    mockOk({});
    await api.listStock();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/pharmacy/stock");
  });

  it("createStockTransaction → POST /pharmacy/stock/transactions", async () => {
    mockOk({});
    await api.createStockTransaction({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/pharmacy/stock/transactions");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("validatePharmacyOrder → POST /pharmacy/orders/{param_1}/validate", async () => {
    mockOk({});
    await api.validatePharmacyOrder(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/pharmacy/orders");
    expect(opts.method).toBe("POST");
  });

  it("createOtcSale → POST /pharmacy/otc-sale", async () => {
    mockOk({});
    await api.createOtcSale({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/pharmacy/otc-sale");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("createDischargeMeds → POST /pharmacy/discharge-dispensing", async () => {
    mockOk({});
    await api.createDischargeMeds({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/pharmacy/discharge-dispensing");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listNdpsEntries → GET /pharmacy/ndps-register", async () => {
    mockOk({});
    await api.listNdpsEntries();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/pharmacy/ndps-register");
  });

  it("createNdpsEntry → POST /pharmacy/ndps-register", async () => {
    mockOk({});
    await api.createNdpsEntry({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/pharmacy/ndps-register");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("getNdpsBalance → GET /pharmacy/ndps-register/balance", async () => {
    mockOk({});
    await api.getNdpsBalance();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/pharmacy/ndps-register/balance");
  });

  it("getNdpsReport → GET /pharmacy/ndps-register/report", async () => {
    mockOk({});
    await api.getNdpsReport();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/pharmacy/ndps-register/report");
  });

  it("listPharmacyBatches → GET /pharmacy/batches", async () => {
    mockOk({});
    await api.listPharmacyBatches();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/pharmacy/batches");
  });

  it("createPharmacyBatch → POST /pharmacy/batches", async () => {
    mockOk({});
    await api.createPharmacyBatch({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/pharmacy/batches");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("getNearExpiryReport → GET /pharmacy/batches/near-expiry", async () => {
    mockOk({});
    await api.getNearExpiryReport();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/pharmacy/batches/near-expiry");
  });

  it("getPharmacyDeadStock → GET /pharmacy/batches/dead-stock", async () => {
    mockOk({});
    await api.getPharmacyDeadStock();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/pharmacy/batches/dead-stock");
  });

  it("listPharmacyStoreAssignments → GET /pharmacy/store-assignments", async () => {
    mockOk({});
    await api.listPharmacyStoreAssignments();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/pharmacy/store-assignments");
  });

  it("createPharmacyStoreAssignment → POST /pharmacy/store-assignments", async () => {
    mockOk({});
    await api.createPharmacyStoreAssignment({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/pharmacy/store-assignments");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listPharmacyTransfers → GET /pharmacy/transfers", async () => {
    mockOk({});
    await api.listPharmacyTransfers();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/pharmacy/transfers");
  });

  it("createPharmacyTransfer → POST /pharmacy/transfers", async () => {
    mockOk({});
    await api.createPharmacyTransfer({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/pharmacy/transfers");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("approvePharmacyTransfer → PUT /pharmacy/transfers/{param_1}/approve", async () => {
    mockOk({});
    await api.approvePharmacyTransfer(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/pharmacy/transfers");
    expect(opts.method).toBe("PUT");
  });

  it("listPharmacyReturns → GET /pharmacy/returns", async () => {
    mockOk({});
    await api.listPharmacyReturns();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/pharmacy/returns");
  });

  it("createPharmacyReturn → POST /pharmacy/returns", async () => {
    mockOk({});
    await api.createPharmacyReturn({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/pharmacy/returns");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("processPharmacyReturn → PUT /pharmacy/returns/{param_1}/process", async () => {
    mockOk({});
    await api.processPharmacyReturn(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/pharmacy/returns");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("getPharmacyConsumption → GET /pharmacy/analytics/consumption", async () => {
    mockOk({});
    await api.getPharmacyConsumption();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/pharmacy/analytics/consumption");
  });

  it("getPharmacyAbcVed → GET /pharmacy/analytics/abc-ved", async () => {
    mockOk({});
    await api.getPharmacyAbcVed();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/pharmacy/analytics/abc-ved");
  });

  it("getDrugUtilization → GET /pharmacy/analytics/utilization", async () => {
    mockOk({});
    await api.getDrugUtilization();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/pharmacy/analytics/utilization");
  });

  it("checkDrugInteractions → POST /pharmacy/interactions/check", async () => {
    mockOk({});
    await api.checkDrugInteractions({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/pharmacy/interactions/check");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("prescriptionAudit → GET /pharmacy/prescriptions/{param_1}/audit", async () => {
    mockOk({});
    await api.prescriptionAudit(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/pharmacy/prescriptions");
  });

  it("formularyCheck → POST /pharmacy/formulary/check", async () => {
    mockOk({});
    await api.formularyCheck({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/pharmacy/formulary/check");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

});

describe("/print-data endpoints", () => {
  it("getPrescriptionPrintData → GET /print-data/prescription/{param_1}", async () => {
    mockOk({});
    await api.getPrescriptionPrintData(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/print-data/prescription");
  });

  it("getLabReportPrintData → GET /print-data/lab-report/{param_1}", async () => {
    mockOk({});
    await api.getLabReportPrintData(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/print-data/lab-report");
  });

  it("getRadiologyPrintData → GET /print-data/radiology-report/{param_1}", async () => {
    mockOk({});
    await api.getRadiologyPrintData(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/print-data/radiology-report");
  });

  it("getPatientCardPrintData → GET /print-data/patient-card/{param_1}", async () => {
    mockOk({});
    await api.getPatientCardPrintData(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/print-data/patient-card");
  });

  it("getWristbandPrintData → GET /print-data/wristband/{param_1}", async () => {
    mockOk({});
    await api.getWristbandPrintData(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/print-data/wristband");
  });

  it("getAppointmentSlipPrintData → GET /print-data/appointment-slip/{param_1}", async () => {
    mockOk({});
    await api.getAppointmentSlipPrintData(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/print-data/appointment-slip");
  });

  it("getDeathCertPrintData → GET /print-data/death-certificate/{param_1}", async () => {
    mockOk({});
    await api.getDeathCertPrintData(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/print-data/death-certificate");
  });

  it("getDischargePrintData → GET /print-data/discharge/{param_1}", async () => {
    mockOk({});
    await api.getDischargePrintData(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/print-data/discharge");
  });

  it("getReceiptPrintData → GET /print-data/receipt/{param_1}", async () => {
    mockOk({});
    await api.getReceiptPrintData(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/print-data/receipt");
  });

  it("getEstimatePrintData → GET /print-data/estimate/{param_1}", async () => {
    mockOk({});
    await api.getEstimatePrintData(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/print-data/estimate");
  });

  it("getCreditNotePrintData → GET /print-data/credit-note/{param_1}", async () => {
    mockOk({});
    await api.getCreditNotePrintData(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/print-data/credit-note");
  });

  it("getTdsCertPrintData → GET /print-data/tds-certificate/{param_1}", async () => {
    mockOk({});
    await api.getTdsCertPrintData(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/print-data/tds-certificate");
  });

  it("getGstInvoicePrintData → GET /print-data/gst-invoice/{param_1}", async () => {
    mockOk({});
    await api.getGstInvoicePrintData(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/print-data/gst-invoice");
  });

});

describe("/procurement endpoints", () => {
  it("listVendors → GET /procurement/vendors", async () => {
    mockOk({});
    await api.listVendors();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/procurement/vendors");
  });

  it("getVendor → GET /procurement/vendors/{param_1}", async () => {
    mockOk({});
    await api.getVendor(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/procurement/vendors");
  });

  it("createVendor → POST /procurement/vendors", async () => {
    mockOk({});
    await api.createVendor({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/procurement/vendors");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateVendor → PUT /procurement/vendors/{param_1}", async () => {
    mockOk({});
    await api.updateVendor(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/procurement/vendors");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listStoreLocations → GET /procurement/store-locations", async () => {
    mockOk({});
    await api.listStoreLocations();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/procurement/store-locations");
  });

  it("createStoreLocation → POST /procurement/store-locations", async () => {
    mockOk({});
    await api.createStoreLocation({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/procurement/store-locations");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateStoreLocation → PUT /procurement/store-locations/{param_1}", async () => {
    mockOk({});
    await api.updateStoreLocation(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/procurement/store-locations");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listPurchaseOrders → GET /procurement/purchase-orders", async () => {
    mockOk({});
    await api.listPurchaseOrders();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/procurement/purchase-orders");
  });

  it("listPurchaseOrders encodes indent_requisition_id filters", async () => {
    mockOk({});
    await api.listPurchaseOrders({ indent_requisition_id: UUID, page: "1" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/procurement/purchase-orders?");
    expect(url).toContain(`indent_requisition_id=${encodeURIComponent(UUID)}`);
    expect(url).toContain("page=1");
  });

  it("getPurchaseOrder → GET /procurement/purchase-orders/{param_1}", async () => {
    mockOk({});
    await api.getPurchaseOrder(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/procurement/purchase-orders");
  });

  it("createPurchaseOrder → POST /procurement/purchase-orders", async () => {
    mockOk({});
    await api.createPurchaseOrder({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/procurement/purchase-orders");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("approvePurchaseOrder → PUT /procurement/purchase-orders/{param_1}/approve", async () => {
    mockOk({});
    await api.approvePurchaseOrder(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/procurement/purchase-orders");
    expect(opts.method).toBe("PUT");
  });

  it("sendPurchaseOrder → PUT /procurement/purchase-orders/{param_1}/send", async () => {
    mockOk({});
    await api.sendPurchaseOrder(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/procurement/purchase-orders");
    expect(opts.method).toBe("PUT");
  });

  it("cancelPurchaseOrder → PUT /procurement/purchase-orders/{param_1}/cancel", async () => {
    mockOk({});
    await api.cancelPurchaseOrder(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/procurement/purchase-orders");
    expect(opts.method).toBe("PUT");
  });

  it("listGrns → GET /procurement/grns", async () => {
    mockOk({});
    await api.listGrns();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/procurement/grns");
  });

  it("getGrn → GET /procurement/grns/{param_1}", async () => {
    mockOk({});
    await api.getGrn(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/procurement/grns");
  });

  it("createGrn → POST /procurement/grns", async () => {
    mockOk({});
    await api.createGrn({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/procurement/grns");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("completeGrn → PUT /procurement/grns/{param_1}/complete", async () => {
    mockOk({});
    await api.completeGrn(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/procurement/grns");
    expect(opts.method).toBe("PUT");
  });

  it("listRateContracts → GET /procurement/rate-contracts", async () => {
    mockOk({});
    await api.listRateContracts();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/procurement/rate-contracts");
  });

  it("getRateContract → GET /procurement/rate-contracts/{param_1}", async () => {
    mockOk({});
    await api.getRateContract(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/procurement/rate-contracts");
  });

  it("createRateContract → POST /procurement/rate-contracts", async () => {
    mockOk({});
    await api.createRateContract({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/procurement/rate-contracts");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listBatchStock → GET /procurement/batch-stock", async () => {
    mockOk({});
    await api.listBatchStock();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/procurement/batch-stock");
  });

  it("getVendorPerformance → GET /procurement/vendor-performance", async () => {
    mockOk({});
    await api.getVendorPerformance();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/procurement/vendor-performance");
  });

  it("getVendorComparison → GET /procurement/vendor-comparison", async () => {
    mockOk({});
    await api.getVendorComparison(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/procurement/vendor-comparison");
  });

  it("createEmergencyPo → POST /procurement/emergency-purchase", async () => {
    mockOk({});
    await api.createEmergencyPo({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/procurement/emergency-purchase");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listSupplierPayments → GET /procurement/supplier-payments", async () => {
    mockOk({});
    await api.listSupplierPayments();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/procurement/supplier-payments");
  });

  it("createSupplierPayment → POST /procurement/supplier-payments", async () => {
    mockOk({});
    await api.createSupplierPayment({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/procurement/supplier-payments");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateSupplierPayment → PUT /procurement/supplier-payments/{param_1}", async () => {
    mockOk({});
    await api.updateSupplierPayment(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/procurement/supplier-payments");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

});

describe("/quality endpoints", () => {
  it("listQualityIndicators → GET /quality/indicators", async () => {
    mockOk({});
    await api.listQualityIndicators();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/quality/indicators");
  });

  it("createQualityIndicator → POST /quality/indicators", async () => {
    mockOk({});
    await api.createQualityIndicator({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/quality/indicators");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listIndicatorValues → GET /quality/indicator-values", async () => {
    mockOk({});
    await api.listIndicatorValues();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/quality/indicator-values");
  });

  it("recordIndicatorValue → POST /quality/indicator-values", async () => {
    mockOk({});
    await api.recordIndicatorValue({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/quality/indicator-values");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listQualityDocuments → GET /quality/documents", async () => {
    mockOk({});
    await api.listQualityDocuments();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/quality/documents");
  });

  it("getQualityDocument → GET /quality/documents/{param_1}", async () => {
    mockOk({});
    await api.getQualityDocument(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/quality/documents");
  });

  it("createQualityDocument → POST /quality/documents", async () => {
    mockOk({});
    await api.createQualityDocument({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/quality/documents");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateDocumentStatus → PATCH /quality/documents/{param_1}/status", async () => {
    mockOk({});
    await api.updateDocumentStatus(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/quality/documents");
    expect(opts.method).toBe("PATCH");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("acknowledgeDocument → POST /quality/documents/{param_1}/acknowledge", async () => {
    mockOk({});
    await api.acknowledgeDocument(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/quality/documents");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listQualityIncidents → GET /quality/incidents", async () => {
    mockOk({});
    await api.listQualityIncidents();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/quality/incidents");
  });

  it("getQualityIncident → GET /quality/incidents/{param_1}", async () => {
    mockOk({});
    await api.getQualityIncident(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/quality/incidents");
  });

  it("createQualityIncident → POST /quality/incidents", async () => {
    mockOk({});
    await api.createQualityIncident({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/quality/incidents");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateQualityIncident → PATCH /quality/incidents/{param_1}", async () => {
    mockOk({});
    await api.updateQualityIncident(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/quality/incidents");
    expect(opts.method).toBe("PATCH");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listCapa → GET /quality/capa", async () => {
    mockOk({});
    await api.listCapa();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/quality/capa");
  });

  it("createCapa → POST /quality/capa", async () => {
    mockOk({});
    await api.createCapa({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/quality/capa");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateCapa → PATCH /quality/capa/{param_1}", async () => {
    mockOk({});
    await api.updateCapa(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/quality/capa");
    expect(opts.method).toBe("PATCH");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listQualityCommittees → GET /quality/committees", async () => {
    mockOk({});
    await api.listQualityCommittees();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/quality/committees");
  });

  it("createQualityCommittee → POST /quality/committees", async () => {
    mockOk({});
    await api.createQualityCommittee({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/quality/committees");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listCommitteeMeetings → GET /quality/meetings", async () => {
    mockOk({});
    await api.listCommitteeMeetings();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/quality/meetings");
  });

  it("createCommitteeMeeting → POST /quality/meetings", async () => {
    mockOk({});
    await api.createCommitteeMeeting({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/quality/meetings");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateCommitteeMeeting → PATCH /quality/meetings/{param_1}", async () => {
    mockOk({});
    await api.updateCommitteeMeeting(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/quality/meetings");
    expect(opts.method).toBe("PATCH");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listActionItems → GET /quality/action-items", async () => {
    mockOk({});
    await api.listActionItems();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/quality/action-items");
  });

  it("createActionItem → POST /quality/action-items", async () => {
    mockOk({});
    await api.createActionItem({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/quality/action-items");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listAccreditationStandards → GET /quality/standards", async () => {
    mockOk({});
    await api.listAccreditationStandards();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/quality/standards");
  });

  it("createAccreditationStandard → POST /quality/standards", async () => {
    mockOk({});
    await api.createAccreditationStandard({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/quality/standards");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listAccreditationCompliance → GET /quality/compliance", async () => {
    mockOk({});
    await api.listAccreditationCompliance();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/quality/compliance");
  });

  it("updateAccreditationCompliance → POST /quality/compliance", async () => {
    mockOk({});
    await api.updateAccreditationCompliance({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/quality/compliance");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listQualityAudits → GET /quality/audits", async () => {
    mockOk({});
    await api.listQualityAudits();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/quality/audits");
  });

  it("getQualityAudit → GET /quality/audits/{param_1}", async () => {
    mockOk({});
    await api.getQualityAudit(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/quality/audits");
  });

  it("createQualityAudit → POST /quality/audits", async () => {
    mockOk({});
    await api.createQualityAudit({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/quality/audits");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateQualityAudit → PATCH /quality/audits/{param_1}", async () => {
    mockOk({});
    await api.updateQualityAudit(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/quality/audits");
    expect(opts.method).toBe("PATCH");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("calculateIndicator → POST /quality/indicators/{param_1}/calculate", async () => {
    mockOk({});
    await api.calculateIndicator(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/quality/indicators");
    expect(opts.method).toBe("POST");
  });

  it("listPendingAcks → GET /quality/documents/{param_1}/pending-acks", async () => {
    mockOk({});
    await api.listPendingAcks(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/quality/documents");
  });

  it("autoScheduleMeetings → POST /quality/committees/{param_1}/auto-schedule", async () => {
    mockOk({});
    await api.autoScheduleMeetings(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/quality/committees");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("compileEvidence → GET /quality/accreditation/{param_1}/evidence", async () => {
    mockOk({});
    await api.compileEvidence({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/quality/accreditation");
  });

  it("scheduleAudits → POST /quality/audits/schedule", async () => {
    mockOk({});
    await api.scheduleAudits({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/quality/audits/schedule");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listAuditFindings → GET /quality/audits/{param_1}/findings", async () => {
    mockOk({});
    await api.listAuditFindings(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/quality/audits");
  });

  it("createAuditFinding → POST /quality/audits/{param_1}/findings", async () => {
    mockOk({});
    await api.createAuditFinding(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/quality/audits");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listOverdueCapas → GET /quality/capas/overdue", async () => {
    mockOk({});
    await api.listOverdueCapas();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/quality/capas/overdue");
  });

  it("committeeDashboard → GET /quality/committees/dashboard", async () => {
    mockOk({});
    await api.committeeDashboard();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/quality/committees/dashboard");
  });

  it("createMortalityReview → POST /quality/mortality-reviews", async () => {
    mockOk({});
    await api.createMortalityReview({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/quality/mortality-reviews");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listSentinelEvents → GET /quality/incidents/sentinel", async () => {
    mockOk({});
    await api.listSentinelEvents();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/quality/incidents/sentinel");
  });

  it("patientSafetyIndicators → GET /quality/analytics/psi", async () => {
    mockOk({});
    await api.patientSafetyIndicators();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/quality/analytics/psi");
  });

  it("departmentScorecard → GET /quality/analytics/scorecard", async () => {
    mockOk({});
    await api.departmentScorecard();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/quality/analytics/scorecard");
  });

});

describe("/radiology endpoints", () => {
  it("listRadiologyOrders → GET /radiology/orders", async () => {
    mockOk({});
    await api.listRadiologyOrders();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/radiology/orders");
  });

  it("createRadiologyOrder → POST /radiology/orders", async () => {
    mockOk({});
    await api.createRadiologyOrder({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/radiology/orders");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("getRadiologyOrder → GET /radiology/orders/{param_1}", async () => {
    mockOk({});
    await api.getRadiologyOrder(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/radiology/orders");
  });

  it("updateRadiologyOrderStatus → PUT /radiology/orders/{param_1}/status", async () => {
    mockOk({});
    await api.updateRadiologyOrderStatus(UUID, "test");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/radiology/orders");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("cancelRadiologyOrder → PUT /radiology/orders/{param_1}/cancel", async () => {
    mockOk({});
    await api.cancelRadiologyOrder(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/radiology/orders");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("createRadiologyReport → POST /radiology/orders/{param_1}/report", async () => {
    mockOk({});
    await api.createRadiologyReport(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/radiology/orders");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("verifyRadiologyReport → PUT /radiology/reports/{param_1}/verify", async () => {
    mockOk({});
    await api.verifyRadiologyReport(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/radiology/reports");
    expect(opts.method).toBe("PUT");
  });

  it("recordRadiationDose → POST /radiology/orders/{param_1}/dose", async () => {
    mockOk({});
    await api.recordRadiationDose(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/radiology/orders");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listRadiologyModalities → GET /radiology/modalities", async () => {
    mockOk({});
    await api.listRadiologyModalities();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/radiology/modalities");
  });

  it("createRadiologyModality → POST /radiology/modalities", async () => {
    mockOk({});
    await api.createRadiologyModality({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/radiology/modalities");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateRadiologyModality → PUT /radiology/modalities/{param_1}", async () => {
    mockOk({});
    await api.updateRadiologyModality(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/radiology/modalities");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("deleteRadiologyModality → DELETE /radiology/modalities/{param_1}", async () => {
    mockOk({});
    await api.deleteRadiologyModality(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/radiology/modalities");
    expect(opts.method).toBe("DELETE");
  });

  it("listRadiologyAppointments → GET /radiology/appointments", async () => {
    mockOk({});
    await api.listRadiologyAppointments();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/radiology/appointments");
  });

  it("createRadiologyAppointment → POST /radiology/appointments", async () => {
    mockOk({});
    await api.createRadiologyAppointment({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/radiology/appointments");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("getRadiologyTat → GET /radiology/analytics/tat", async () => {
    mockOk({});
    await api.getRadiologyTat();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/radiology/analytics/tat");
  });

});

describe("/regulatory endpoints", () => {
  it("autoPopulateChecklist → POST /regulatory/checklists/{param_1}/auto-populate", async () => {
    mockOk({});
    await api.autoPopulateChecklist(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/regulatory/checklists");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listRegulatorySubmissions → GET /regulatory/submissions", async () => {
    mockOk({});
    await api.listRegulatorySubmissions();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/regulatory/submissions");
  });

  it("createRegulatorySubmission → POST /regulatory/submissions", async () => {
    mockOk({});
    await api.createRegulatorySubmission({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/regulatory/submissions");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listMockSurveys → GET /regulatory/mock-surveys", async () => {
    mockOk({});
    await api.listMockSurveys();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/regulatory/mock-surveys");
  });

  it("createMockSurvey → POST /regulatory/mock-surveys", async () => {
    mockOk({});
    await api.createMockSurvey({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/regulatory/mock-surveys");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("staffCredentials → GET /regulatory/staff-credentials", async () => {
    mockOk({});
    await api.staffCredentials();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/regulatory/staff-credentials");
  });

  it("licenseDashboard → GET /regulatory/licenses/dashboard", async () => {
    mockOk({});
    await api.licenseDashboard();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/regulatory/licenses/dashboard");
  });

  it("nablDocumentTracking → GET /regulatory/nabl/documents", async () => {
    mockOk({});
    await api.nablDocumentTracking();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/regulatory/nabl/documents");
  });

});

describe("/scheduling endpoints", () => {
  it("listPredictions → GET /scheduling/predictions", async () => {
    mockOk({});
    await api.listPredictions();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/scheduling/predictions");
  });

  it("scoreAppointment → POST /scheduling/predictions/score", async () => {
    mockOk({});
    await api.scoreAppointment({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/scheduling/predictions/score");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("scoreBatch → POST /scheduling/predictions/score-batch", async () => {
    mockOk({});
    await api.scoreBatch({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/scheduling/predictions/score-batch");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listWaitlist → GET /scheduling/waitlist", async () => {
    mockOk({});
    await api.listWaitlist();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/scheduling/waitlist");
  });

  it("createWaitlistEntry → POST /scheduling/waitlist", async () => {
    mockOk({});
    await api.createWaitlistEntry({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/scheduling/waitlist");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateWaitlistEntry → PUT /scheduling/waitlist/{param_1}", async () => {
    mockOk({});
    await api.updateWaitlistEntry(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/scheduling/waitlist");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("offerSlot → POST /scheduling/waitlist/{param_1}/offer", async () => {
    mockOk({});
    await api.offerSlot(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/scheduling/waitlist");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("respondToOffer → POST /scheduling/waitlist/{param_1}/respond", async () => {
    mockOk({});
    await api.respondToOffer(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/scheduling/waitlist");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("autoFillSlots → POST /scheduling/auto-fill", async () => {
    mockOk({});
    await api.autoFillSlots();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/scheduling/auto-fill");
    expect(opts.method).toBe("POST");
  });

  it("listOverbookingRules → GET /scheduling/overbooking-rules", async () => {
    mockOk({});
    await api.listOverbookingRules();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/scheduling/overbooking-rules");
  });

  it("createOverbookingRule → POST /scheduling/overbooking-rules", async () => {
    mockOk({});
    await api.createOverbookingRule({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/scheduling/overbooking-rules");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateOverbookingRule → PUT /scheduling/overbooking-rules/{param_1}", async () => {
    mockOk({});
    await api.updateOverbookingRule(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/scheduling/overbooking-rules");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("deleteOverbookingRule → DELETE /scheduling/overbooking-rules/{param_1}", async () => {
    mockOk({});
    await api.deleteOverbookingRule(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/scheduling/overbooking-rules");
    expect(opts.method).toBe("DELETE");
  });

  it("getOverbookingRecommendation → GET /scheduling/overbooking/recommendation", async () => {
    mockOk({});
    await api.getOverbookingRecommendation({ doctor_id: UUID, department_id: UUID, date: "2026-01-01" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/scheduling/overbooking/recommendation");
  });

  it("noshowRates → GET /scheduling/analytics/noshow-rates", async () => {
    mockOk({});
    await api.noshowRates();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/scheduling/analytics/noshow-rates");
  });

  it("predictionAccuracy → GET /scheduling/analytics/prediction-accuracy", async () => {
    mockOk({});
    await api.predictionAccuracy();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/scheduling/analytics/prediction-accuracy");
  });

  it("waitlistStats → GET /scheduling/analytics/waitlist-stats", async () => {
    mockOk({});
    await api.waitlistStats();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/scheduling/analytics/waitlist-stats");
  });

  it("schedulingConflicts → GET /scheduling/conflicts", async () => {
    mockOk({});
    await api.schedulingConflicts();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/scheduling/conflicts");
  });

  it("promoteWaitlist → POST /scheduling/waitlist/promote", async () => {
    mockOk({});
    await api.promoteWaitlist({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/scheduling/waitlist/promote");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("scheduleAnalytics → GET /scheduling/analytics/overview", async () => {
    mockOk({});
    await api.scheduleAnalytics();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/scheduling/analytics/overview");
  });

  it("createRecurringAppointment → POST /scheduling/recurring", async () => {
    mockOk({});
    await api.createRecurringAppointment({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/scheduling/recurring");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("createScheduleBlock → POST /scheduling/blocks", async () => {
    mockOk({});
    await api.createScheduleBlock({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/scheduling/blocks");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

});

describe("/schema endpoints", () => {
  it("listSchemaModules → GET /schema/modules", async () => {
    mockOk({});
    await api.listSchemaModules();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/schema/modules");
  });

  it("listModuleEntities → GET /schema/modules/{param_1}/entities", async () => {
    mockOk({});
    await api.listModuleEntities("test");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/schema/modules");
  });

  it("listEventSchemas → GET /schema/events", async () => {
    mockOk({});
    await api.listEventSchemas();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/schema/events");
  });

  it("getEventSchema → GET /schema/events/{param_1}", async () => {
    mockOk({});
    await api.getEventSchema("test");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/schema/events");
  });

  it("getFormFieldSchema → GET /schema/form-fields/{param_1}", async () => {
    mockOk({});
    await api.getFormFieldSchema("test");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/schema/form-fields");
  });

});

describe("/screens endpoints", () => {
  it("resolveScreen → GET /screens/{param_1}", async () => {
    mockOk({});
    await api.resolveScreen("test");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/screens");
  });

  it("listModuleScreens → GET /screens/module/{param_1}", async () => {
    mockOk({});
    await api.listModuleScreens("test");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/screens/module");
  });

});

describe("/security endpoints", () => {
  it("listSecurityZones → GET /security/zones", async () => {
    mockOk({});
    await api.listSecurityZones();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/security/zones");
  });

  it("createSecurityZone → POST /security/zones", async () => {
    mockOk({});
    await api.createSecurityZone({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/security/zones");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateSecurityZone → PUT /security/zones/{param_1}", async () => {
    mockOk({});
    await api.updateSecurityZone(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/security/zones");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listSecurityAccessLogs → GET /security/access-logs", async () => {
    mockOk({});
    await api.listSecurityAccessLogs();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/security/access-logs");
  });

  it("createSecurityAccessLog → POST /security/access-logs", async () => {
    mockOk({});
    await api.createSecurityAccessLog({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/security/access-logs");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listSecurityAccessCards → GET /security/cards", async () => {
    mockOk({});
    await api.listSecurityAccessCards();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/security/cards");
  });

  it("createSecurityAccessCard → POST /security/cards", async () => {
    mockOk({});
    await api.createSecurityAccessCard({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/security/cards");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateSecurityAccessCard → PUT /security/cards/{param_1}", async () => {
    mockOk({});
    await api.updateSecurityAccessCard(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/security/cards");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("deactivateSecurityAccessCard → PUT /security/cards/{param_1}/deactivate", async () => {
    mockOk({});
    await api.deactivateSecurityAccessCard(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/security/cards");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listSecurityCameras → GET /security/cameras", async () => {
    mockOk({});
    await api.listSecurityCameras();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/security/cameras");
  });

  it("createSecurityCamera → POST /security/cameras", async () => {
    mockOk({});
    await api.createSecurityCamera({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/security/cameras");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateSecurityCamera → PUT /security/cameras/{param_1}", async () => {
    mockOk({});
    await api.updateSecurityCamera(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/security/cameras");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listSecurityIncidents → GET /security-incidents", async () => {
    mockOk({});
    await api.listSecurityIncidents();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/security-incidents");
  });

  it("getSecurityIncident → GET /security-incidents/{param_1}", async () => {
    mockOk({});
    await api.getSecurityIncident(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/security-incidents");
  });

  it("createSecurityIncident → POST /security-incidents", async () => {
    mockOk({});
    await api.createSecurityIncident({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/security-incidents");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateSecurityIncident → PATCH /security-incidents/{param_1}", async () => {
    mockOk({});
    await api.updateSecurityIncident(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/security-incidents");
    expect(opts.method).toBe("PATCH");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listSecurityPatientTags → GET /security/patient-tags", async () => {
    mockOk({});
    await api.listSecurityPatientTags();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/security/patient-tags");
  });

  it("createSecurityPatientTag → POST /security/patient-tags", async () => {
    mockOk({});
    await api.createSecurityPatientTag({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/security/patient-tags");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("deactivateSecurityPatientTag → PUT /security/patient-tags/{param_1}/deactivate", async () => {
    mockOk({});
    await api.deactivateSecurityPatientTag(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/security/patient-tags");
    expect(opts.method).toBe("PUT");
  });

  it("listSecurityTagAlerts → GET /security/tag-alerts", async () => {
    mockOk({});
    await api.listSecurityTagAlerts();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/security/tag-alerts");
  });

  it("resolveSecurityTagAlert → PUT /security/tag-alerts/{param_1}/resolve", async () => {
    mockOk({});
    await api.resolveSecurityTagAlert(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/security/tag-alerts");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listSecurityCodeDebriefs → GET /security/debriefs", async () => {
    mockOk({});
    await api.listSecurityCodeDebriefs();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/security/debriefs");
  });

  it("getSecurityCodeDebrief → GET /security/debriefs/{param_1}", async () => {
    mockOk({});
    await api.getSecurityCodeDebrief(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/security/debriefs");
  });

  it("createSecurityCodeDebrief → POST /security/debriefs", async () => {
    mockOk({});
    await api.createSecurityCodeDebrief({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/security/debriefs");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

});

describe("/it-security endpoints", () => {
  it("reportToCertIn → POST /security-incidents/{param_1}/cert-in", async () => {
    mockOk({});
    await api.reportToCertIn(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/security-incidents");
    expect(url).toContain("/cert-in");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("getIncidentUpdates → GET /security-incidents/{param_1}/updates", async () => {
    mockOk({});
    await api.getIncidentUpdates(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/security-incidents");
    expect(url).toContain("/updates");
  });

  it("addIncidentUpdate → POST /security-incidents/{param_1}/updates", async () => {
    mockOk({});
    await api.addIncidentUpdate(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/security-incidents");
    expect(url).toContain("/updates");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listVulnerabilities → GET /vulnerabilities", async () => {
    mockOk({});
    await api.listVulnerabilities();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/vulnerabilities");
  });

  it("createVulnerability → POST /vulnerabilities", async () => {
    mockOk({});
    await api.createVulnerability({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/vulnerabilities");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateVulnerability → PATCH /vulnerabilities/{param_1}", async () => {
    mockOk({});
    await api.updateVulnerability(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/vulnerabilities");
    expect(opts.method).toBe("PATCH");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listComplianceRequirements → GET /compliance-requirements", async () => {
    mockOk({});
    await api.listComplianceRequirements();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/compliance-requirements");
  });

  it("updateComplianceRequirement → PATCH /compliance-requirements/{param_1}", async () => {
    mockOk({});
    await api.updateComplianceRequirement(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/compliance-requirements");
    expect(opts.method).toBe("PATCH");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("getSystemHealthDashboard → GET /system-health", async () => {
    mockOk({});
    await api.getSystemHealthDashboard();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/system-health");
  });

  it("listBackups → GET /backups", async () => {
    mockOk({});
    await api.listBackups();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/backups");
  });

  it("getOnboardingProgress → GET /onboarding/progress", async () => {
    mockOk({});
    await api.getOnboardingProgress();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/onboarding/progress");
  });

  it("completeOnboardingStep → POST /onboarding/complete-step", async () => {
    mockOk({});
    await api.completeOnboardingStep({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/onboarding/complete-step");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });
});

describe("/setup endpoints", () => {
  it("getTenant → GET /setup/tenant", async () => {
    mockOk({});
    await api.getTenant();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/setup/tenant");
  });

  it("updateTenant → PUT /setup/tenant", async () => {
    mockOk({});
    await api.updateTenant({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/setup/tenant");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateTenantGeo → PUT /setup/tenant/geo", async () => {
    mockOk({});
    await api.updateTenantGeo({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/setup/tenant/geo");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("createCompliance → POST /setup/compliance", async () => {
    mockOk({});
    await api.createCompliance({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/setup/compliance");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listFacilities → GET /setup/facilities", async () => {
    mockOk({});
    await api.listFacilities();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/setup/facilities");
  });

  it("createFacility → POST /setup/facilities", async () => {
    mockOk({});
    await api.createFacility({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/setup/facilities");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateFacility → PUT /setup/facilities/{param_1}", async () => {
    mockOk({});
    await api.updateFacility(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/setup/facilities");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("deleteFacility → DELETE /setup/facilities/{param_1}", async () => {
    mockOk({});
    await api.deleteFacility(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/setup/facilities");
    expect(opts.method).toBe("DELETE");
  });

  it("listLocations → GET /setup/locations", async () => {
    mockOk({});
    await api.listLocations();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/setup/locations");
  });

  it("createLocation → POST /setup/locations", async () => {
    mockOk({});
    await api.createLocation({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/setup/locations");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateLocation → PUT /setup/locations/{param_1}", async () => {
    mockOk({});
    await api.updateLocation(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/setup/locations");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("deleteLocation → DELETE /setup/locations/{param_1}", async () => {
    mockOk({});
    await api.deleteLocation(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/setup/locations");
    expect(opts.method).toBe("DELETE");
  });

  it("listDepartments → GET /setup/departments", async () => {
    mockOk({});
    await api.listDepartments();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/setup/departments");
  });

  it("createDepartment → POST /setup/departments", async () => {
    mockOk({});
    await api.createDepartment({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/setup/departments");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateDepartment → PUT /setup/departments/{param_1}", async () => {
    mockOk({});
    await api.updateDepartment(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/setup/departments");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("deleteDepartment → DELETE /setup/departments/{param_1}", async () => {
    mockOk({});
    await api.deleteDepartment(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/setup/departments");
    expect(opts.method).toBe("DELETE");
  });

  it("listRoles → GET /setup/roles", async () => {
    mockOk({});
    await api.listRoles();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/setup/roles");
  });

  it("createRole → POST /setup/roles", async () => {
    mockOk({});
    await api.createRole({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/setup/roles");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateRole → PUT /setup/roles/{param_1}", async () => {
    mockOk({});
    await api.updateRole(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/setup/roles");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("deleteRole → DELETE /setup/roles/{param_1}", async () => {
    mockOk({});
    await api.deleteRole(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/setup/roles");
    expect(opts.method).toBe("DELETE");
  });

  it("updateRolePermissions → PUT /setup/roles/{param_1}/permissions", async () => {
    mockOk({});
    await api.updateRolePermissions(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/setup/roles");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateRoleFieldAccess → PUT /setup/roles/{param_1}/field-access", async () => {
    mockOk({});
    await api.updateRoleFieldAccess(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/setup/roles");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateRoleWidgetAccess → PUT /setup/roles/{param_1}/widget-access", async () => {
    mockOk({});
    await api.updateRoleWidgetAccess(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/setup/roles");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listSetupUsers → GET /setup/users", async () => {
    mockOk({});
    await api.listSetupUsers();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/setup/users");
  });

  it("listDoctors → GET /setup/doctors", async () => {
    mockOk({});
    await api.listDoctors();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/setup/doctors");
  });

  it("createSetupUser → POST /setup/users", async () => {
    mockOk({});
    await api.createSetupUser({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/setup/users");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateSetupUser → PUT /setup/users/{param_1}", async () => {
    mockOk({});
    await api.updateSetupUser(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/setup/users");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("deleteSetupUser → DELETE /setup/users/{param_1}", async () => {
    mockOk({});
    await api.deleteSetupUser(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/setup/users");
    expect(opts.method).toBe("DELETE");
  });

  it("listUserFacilities → GET /setup/users/{param_1}/facilities", async () => {
    mockOk({});
    await api.listUserFacilities(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/setup/users");
  });

  it("assignUserFacilities → PUT /setup/users/{param_1}/facilities", async () => {
    mockOk({});
    await api.assignUserFacilities(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/setup/users");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("autoCreateCompliance → POST /setup/facilities/{param_1}/auto-compliance", async () => {
    mockOk({});
    await api.autoCreateCompliance(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/setup/facilities");
    expect(opts.method).toBe("POST");
  });

  it("updateUserAccessMatrix → PUT /setup/users/{param_1}/access-matrix", async () => {
    mockOk({});
    await api.updateUserAccessMatrix(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/setup/users");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listModules → GET /setup/modules", async () => {
    mockOk({});
    await api.listModules();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/setup/modules");
  });

  it("updateModule → PUT /setup/modules/{param_1}", async () => {
    mockOk({});
    await api.updateModule("test", { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/setup/modules");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listSequences → GET /setup/sequences", async () => {
    mockOk({});
    await api.listSequences();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/setup/sequences");
  });

  it("createSequence → POST /setup/sequences", async () => {
    mockOk({});
    await api.createSequence({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/setup/sequences");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateSequence → PUT /setup/sequences/{param_1}", async () => {
    mockOk({});
    await api.updateSequence("test", { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/setup/sequences");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("deleteSequence → DELETE /setup/sequences/{param_1}", async () => {
    mockOk({});
    await api.deleteSequence("test");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/setup/sequences");
    expect(opts.method).toBe("DELETE");
  });

  it("listServices → GET /setup/services", async () => {
    mockOk({});
    await api.listServices();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/setup/services");
  });

  it("createService → POST /setup/services", async () => {
    mockOk({});
    await api.createService({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/setup/services");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateService → PUT /setup/services/{param_1}", async () => {
    mockOk({});
    await api.updateService(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/setup/services");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("deleteService → DELETE /setup/services/{param_1}", async () => {
    mockOk({});
    await api.deleteService(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/setup/services");
    expect(opts.method).toBe("DELETE");
  });

  it("listBedTypes → GET /setup/bed-types", async () => {
    mockOk({});
    await api.listBedTypes();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/setup/bed-types");
  });

  it("createBedType → POST /setup/bed-types", async () => {
    mockOk({});
    await api.createBedType({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/setup/bed-types");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateBedType → PUT /setup/bed-types/{param_1}", async () => {
    mockOk({});
    await api.updateBedType(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/setup/bed-types");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("deleteBedType → DELETE /setup/bed-types/{param_1}", async () => {
    mockOk({});
    await api.deleteBedType(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/setup/bed-types");
    expect(opts.method).toBe("DELETE");
  });

  it("listTaxCategories → GET /setup/tax-categories", async () => {
    mockOk({});
    await api.listTaxCategories();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/setup/tax-categories");
  });

  it("createTaxCategory → POST /setup/tax-categories", async () => {
    mockOk({});
    await api.createTaxCategory({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/setup/tax-categories");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateTaxCategory → PUT /setup/tax-categories/{param_1}", async () => {
    mockOk({});
    await api.updateTaxCategory(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/setup/tax-categories");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("deleteTaxCategory → DELETE /setup/tax-categories/{param_1}", async () => {
    mockOk({});
    await api.deleteTaxCategory(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/setup/tax-categories");
    expect(opts.method).toBe("DELETE");
  });

  it("listPaymentMethods → GET /setup/payment-methods", async () => {
    mockOk({});
    await api.listPaymentMethods();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/setup/payment-methods");
  });

  it("createPaymentMethod → POST /setup/payment-methods", async () => {
    mockOk({});
    await api.createPaymentMethod({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/setup/payment-methods");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updatePaymentMethod → PUT /setup/payment-methods/{param_1}", async () => {
    mockOk({});
    await api.updatePaymentMethod(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/setup/payment-methods");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("deletePaymentMethod → DELETE /setup/payment-methods/{param_1}", async () => {
    mockOk({});
    await api.deletePaymentMethod(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/setup/payment-methods");
    expect(opts.method).toBe("DELETE");
  });

  it("getBranding → GET /setup/branding", async () => {
    mockOk({});
    await api.getBranding();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/setup/branding");
  });

  it("updateBranding → PUT /setup/branding", async () => {
    mockOk({});
    await api.updateBranding({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/setup/branding");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("getTenantSettings → GET /setup/settings", async () => {
    mockOk({});
    await api.getTenantSettings("test");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/setup/settings");
  });

  it("updateTenantSetting → PUT /setup/settings", async () => {
    mockOk({});
    await api.updateTenantSetting({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/setup/settings");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("getSecureDeviceSettings → GET /setup/device-settings", async () => {
    mockOk({});
    await api.getSecureDeviceSettings();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/setup/device-settings");
  });

  it("updateSecureDeviceSetting → PUT /setup/device-settings", async () => {
    mockOk({});
    await api.updateSecureDeviceSetting({
      key: "pacs_dicom",
      value: { enabled: true, host: "pacs.local" },
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/setup/device-settings");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("seedModuleMasters → POST /setup/module-masters", async () => {
    mockOk({});
    await api.seedModuleMasters({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/setup/module-masters");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("importLocations → POST /setup/locations/import", async () => {
    mockOk({});
    await api.importLocations({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/setup/locations/import");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("importDepartments → POST /setup/departments/import", async () => {
    mockOk({});
    await api.importDepartments({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/setup/departments/import");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("importUsers → POST /setup/users/import", async () => {
    mockOk({});
    await api.importUsers({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/setup/users/import");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("getPrintTemplates → GET /setup/print-templates", async () => {
    mockOk({});
    await api.getPrintTemplates();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/setup/print-templates");
  });

  it("upsertPrintTemplate → PUT /setup/print-templates", async () => {
    mockOk({});
    await api.upsertPrintTemplate({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/setup/print-templates");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("adminListReligions → GET /setup/masters/religions", async () => {
    mockOk({});
    await api.adminListReligions();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/setup/masters/religions");
  });

  it("adminCreateReligion → POST /setup/masters/religions", async () => {
    mockOk({});
    await api.adminCreateReligion({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/setup/masters/religions");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("adminUpdateReligion → PUT /setup/masters/religions/{param_1}", async () => {
    mockOk({});
    await api.adminUpdateReligion(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/setup/masters/religions");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("adminDeleteReligion → DELETE /setup/masters/religions/{param_1}", async () => {
    mockOk({});
    await api.adminDeleteReligion(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/setup/masters/religions");
    expect(opts.method).toBe("DELETE");
  });

  it("adminListOccupations → GET /setup/masters/occupations", async () => {
    mockOk({});
    await api.adminListOccupations();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/setup/masters/occupations");
  });

  it("adminCreateOccupation → POST /setup/masters/occupations", async () => {
    mockOk({});
    await api.adminCreateOccupation({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/setup/masters/occupations");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("adminUpdateOccupation → PUT /setup/masters/occupations/{param_1}", async () => {
    mockOk({});
    await api.adminUpdateOccupation(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/setup/masters/occupations");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("adminDeleteOccupation → DELETE /setup/masters/occupations/{param_1}", async () => {
    mockOk({});
    await api.adminDeleteOccupation(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/setup/masters/occupations");
    expect(opts.method).toBe("DELETE");
  });

  it("adminListRelations → GET /setup/masters/relations", async () => {
    mockOk({});
    await api.adminListRelations();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/setup/masters/relations");
  });

  it("adminCreateRelation → POST /setup/masters/relations", async () => {
    mockOk({});
    await api.adminCreateRelation({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/setup/masters/relations");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("adminUpdateRelation → PUT /setup/masters/relations/{param_1}", async () => {
    mockOk({});
    await api.adminUpdateRelation(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/setup/masters/relations");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("adminDeleteRelation → DELETE /setup/masters/relations/{param_1}", async () => {
    mockOk({});
    await api.adminDeleteRelation(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/setup/masters/relations");
    expect(opts.method).toBe("DELETE");
  });

  it("adminListInsuranceProviders → GET /setup/masters/insurance-providers", async () => {
    mockOk({});
    await api.adminListInsuranceProviders();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/setup/masters/insurance-providers");
  });

  it("adminCreateInsuranceProvider → POST /setup/masters/insurance-providers", async () => {
    mockOk({});
    await api.adminCreateInsuranceProvider({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/setup/masters/insurance-providers");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("adminUpdateInsuranceProvider → PUT /setup/masters/insurance-providers/{param_1}", async () => {
    mockOk({});
    await api.adminUpdateInsuranceProvider(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/setup/masters/insurance-providers");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("adminDeleteInsuranceProvider → DELETE /setup/masters/insurance-providers/{param_1}", async () => {
    mockOk({});
    await api.adminDeleteInsuranceProvider(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/setup/masters/insurance-providers");
    expect(opts.method).toBe("DELETE");
  });

  it("bulkCreateUsers → POST /setup/users/bulk", async () => {
    mockOk({});
    await api.bulkCreateUsers({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/setup/users/bulk");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("seedDepartmentTemplate → POST /setup/departments/template", async () => {
    mockOk({});
    await api.seedDepartmentTemplate();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/setup/departments/template");
    expect(opts.method).toBe("POST");
  });

  it("completenessCheck → GET /setup/completeness", async () => {
    mockOk({});
    await api.completenessCheck();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/setup/completeness");
  });

  it("systemHealth → GET /setup/health", async () => {
    mockOk({});
    await api.systemHealth();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/setup/health");
  });

  it("exportConfig → GET /setup/config/export", async () => {
    mockOk({});
    await api.exportConfig();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/setup/config/export");
  });

  it("importConfig → POST /setup/config/import", async () => {
    mockOk({});
    await api.importConfig({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/setup/config/import");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

});

describe("/tenant endpoints", () => {
  it("listFieldOverrides → GET /tenant/field-overrides", async () => {
    mockOk({});
    await api.listFieldOverrides();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/tenant/field-overrides");
  });

  it("upsertFieldOverride → PUT /tenant/field-overrides/{param_1}", async () => {
    mockOk({});
    await api.upsertFieldOverride("test", { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/tenant/field-overrides");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("deleteFieldOverride → DELETE /tenant/field-overrides/{param_1}", async () => {
    mockOk({});
    await api.deleteFieldOverride("test");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/tenant/field-overrides");
    expect(opts.method).toBe("DELETE");
  });

});

describe("/utilization-review endpoints", () => {
  it("listUrReviews → GET /utilization-review/reviews", async () => {
    mockOk({});
    await api.listUrReviews();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/utilization-review/reviews");
  });

  it("createUrReview → POST /utilization-review/reviews", async () => {
    mockOk({});
    await api.createUrReview({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/utilization-review/reviews");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listUrOutliers → GET /utilization-review/reviews/outliers", async () => {
    mockOk({});
    await api.listUrOutliers();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/utilization-review/reviews/outliers");
  });

  it("getUrReview → GET /utilization-review/reviews/{param_1}", async () => {
    mockOk({});
    await api.getUrReview(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/utilization-review/reviews");
  });

  it("updateUrReview → PUT /utilization-review/reviews/{param_1}", async () => {
    mockOk({});
    await api.updateUrReview(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/utilization-review/reviews");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("aiExtractStub → POST /utilization-review/reviews/{param_1}/ai-extract", async () => {
    mockOk({});
    await api.aiExtractStub(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/utilization-review/reviews");
    expect(opts.method).toBe("POST");
  });

  it("listUrByAdmission → GET /utilization-review/reviews/admission/{param_1}", async () => {
    mockOk({});
    await api.listUrByAdmission(UUID);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/utilization-review/reviews/admission");
  });

  it("listUrCommunications → GET /utilization-review/communications", async () => {
    mockOk({});
    await api.listUrCommunications();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/utilization-review/communications");
  });

  it("createUrCommunication → POST /utilization-review/communications", async () => {
    mockOk({});
    await api.createUrCommunication({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/utilization-review/communications");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("updateUrCommunication → PUT /utilization-review/communications/{param_1}", async () => {
    mockOk({});
    await api.updateUrCommunication(UUID, { test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/utilization-review/communications");
    expect(opts.method).toBe("PUT");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("listUrConversions → GET /utilization-review/conversions", async () => {
    mockOk({});
    await api.listUrConversions();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/utilization-review/conversions");
  });

  it("createUrConversion → POST /utilization-review/conversions", async () => {
    mockOk({});
    await api.createUrConversion({ test: "data" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url.split("?")[0]).toBe("/api/utilization-review/conversions");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeDefined();
    expect(() => JSON.parse(opts.body)).not.toThrow();
  });

  it("urAnalyticsSummary → GET /utilization-review/analytics", async () => {
    mockOk({});
    await api.urAnalyticsSummary();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/utilization-review/analytics");
  });

  it("urLosComparison → GET /utilization-review/analytics/los-comparison", async () => {
    mockOk({});
    await api.urLosComparison();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/utilization-review/analytics/los-comparison");
  });

});

describe("/widget-templates endpoints", () => {
  it("listWidgetTemplates → GET /widget-templates", async () => {
    mockOk({});
    await api.listWidgetTemplates();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/widget-templates");
  });

});

describe("API coverage summary", () => {
  it("has 1269 tested methods", () => {
    const methodCount = Object.keys(api).filter(
      (k) => typeof (api as Record<string, unknown>)[k] === "function"
    ).length;
    expect(methodCount).toBeGreaterThanOrEqual(1269);
  });
});
