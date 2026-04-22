#!/usr/bin/env python3
"""
Generate unit tests for the API client from the extracted endpoint map.

Usage:
    python3 scripts/generate_api_tests.py > medbrains/packages/api/src/client.test.ts
"""

import json
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

def main():
    result = subprocess.run(
        [sys.executable, str(REPO / "scripts" / "extract_api_map.py")],
        capture_output=True, text=True, check=True,
    )
    methods = json.loads(result.stdout)

    # Group methods by module (derived from path prefix)
    modules: dict[str, list] = {}
    for m in methods:
        parts = m["path"].strip("/").split("/")
        mod = parts[0] if parts else "root"
        modules.setdefault(mod, []).append(m)

    lines: list[str] = []
    w = lines.append

    w('import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";')
    w("")
    w("// --- Mock fetch globally before importing the module ---")
    w("const mockFetch = vi.fn();")
    w("vi.stubGlobal('fetch', mockFetch);")
    w("")
    w("// Stub sessionStorage for CSRF token logic")
    w("vi.stubGlobal('sessionStorage', {")
    w("  getItem: () => null,")
    w("  setItem: () => {},")
    w("  removeItem: () => {},")
    w("});")
    w("")
    w("// Stub document.cookie")
    w('vi.stubGlobal("document", { cookie: "" });')
    w("")
    w('import { api, setApiBase } from "./index.js";')
    w("")
    w("// ---------- Helpers ----------")
    w("")
    w("function mockOk(body: unknown = {}) {")
    w("  mockFetch.mockResolvedValueOnce({")
    w("    ok: true,")
    w("    status: 200,")
    w("    json: () => Promise.resolve(body),")
    w("  });")
    w("}")
    w("")
    w("function mockError(status: number, body: unknown = {}) {")
    w("  mockFetch.mockResolvedValueOnce({")
    w("    ok: false,")
    w("    status,")
    w("    json: () => Promise.resolve(body),")
    w("  });")
    w("}")
    w("")
    w('const UUID = "00000000-0000-0000-0000-000000000001";')
    w("")
    w("// ---------- Setup ----------")
    w("")
    w("beforeEach(() => {")
    w("  mockFetch.mockReset();")
    w('  setApiBase("/api");')
    w("});")
    w("")

    # --- Error handling tests ---
    w('describe("request() error handling", () => {')
    w('  it("throws on 401 (session expired)", async () => {')
    w("    // First call returns 401, refresh also fails")
    w("    mockError(401);")
    w("    mockError(401);")
    w('    await expect(api.health()).rejects.toThrow("session_expired");')
    w("  });")
    w("")
    w('  it("retries on 401 after successful refresh", async () => {')
    w("    // First call 401, refresh succeeds, retry succeeds")
    w("    mockError(401);")
    w('    mockOk({ token: "new-token", csrf_token: "csrf" });')
    w('    mockOk({ status: "ok" });')
    w("    const result = await api.health();")
    w('    expect(result).toEqual({ status: "ok" });')
    w("    expect(mockFetch).toHaveBeenCalledTimes(3);")
    w("  });")
    w("")
    w('  it("throws validation error on 422", async () => {')
    w('    mockError(422, { error: "validation_failed", fields: { name: ["required"] } });')
    w("    await expect(api.health()).rejects.toThrow();")
    w("  });")
    w("")
    w('  it("throws generic error on 500", async () => {')
    w('    mockError(500, { error: "internal_error" });')
    w('    await expect(api.health()).rejects.toThrow("internal_error");')
    w("  });")
    w("")
    w('  it("includes CSRF header on mutations", async () => {')
    w("    // Login sets the CSRF token")
    w('    mockOk({ token: "t", csrf_token: "my-csrf" });')
    w('    await api.login({ email: "a@b.c", password: "p" });')
    w("    mockFetch.mockReset();")
    w("")
    w("    // Next mutation should include CSRF header")
    w('    mockOk({ status: "ok" });')
    w("    await api.logout();")
    w('    const headers = mockFetch.mock.calls[0][1].headers;')
    w('    expect(headers["X-CSRF-Token"]).toBe("my-csrf");')
    w("  });")
    w("")
    w('  it("sends credentials: include", async () => {')
    w("    mockOk({});")
    w("    await api.health();")
    w('    expect(mockFetch.mock.calls[0][1].credentials).toBe("include");')
    w("  });")
    w("});")
    w("")

    # --- Per-module endpoint tests ---
    for mod_name, mod_methods in sorted(modules.items()):
        w(f'describe("/{mod_name} endpoints", () => {{')

        for m in mod_methods:
            name = m["name"]
            http = m["httpMethod"]
            path = m["path"]
            has_body = m["hasBody"]
            param_count = m["paramCount"]
            param_names = m["paramNames"]

            # Build mock arguments
            args = []
            has_qs_param = False  # tracks if we're skipping a query-string param
            for i, pname in enumerate(param_names):
                clean = pname.rstrip("?")
                is_optional = pname.endswith("?")

                # Skip optional query-building params (params, filters, options, etc.)
                if is_optional and clean in ("params", "filters", "options", "query"):
                    has_qs_param = True
                    continue
                # Skip params that look like optional query builders
                if is_optional and i == param_count - 1 and not has_body:
                    has_qs_param = True
                    continue

                if clean == "data" or clean == "body":
                    args.append('{ test: "data" }')
                elif clean == "id" or clean.endswith("Id") or clean.endswith("_id"):
                    args.append("UUID")
                elif clean in ("params", "filters"):
                    has_qs_param = True
                    continue
                elif "date" in clean.lower():
                    has_qs_param = True
                    args.append('"2026-01-01"')
                elif "code" in clean.lower() or "type" in clean.lower():
                    args.append('"test"')
                elif clean in ("from", "to", "period", "search", "area_type",
                               "category", "department", "status", "modality",
                               "module", "role", "priority", "severity"):
                    has_qs_param = True
                    args.append('"test"')
                elif "number" in clean.lower() or "count" in clean.lower() or "page" in clean.lower():
                    args.append("1")
                elif clean == "file":
                    args.append("new Blob()")
                else:
                    # Default: UUID for path params, object for body data
                    if i == param_count - 1 and has_body:
                        args.append('{ test: "data" }')
                    else:
                        args.append("UUID")

            args_str = ", ".join(args)

            # Expected URL (replace {param_N} with UUID)
            expected_path = path
            for j in range(1, 10):
                expected_path = expected_path.replace(f"{{param_{j}}}", "${UUID}")

            if "${UUID}" in expected_path:
                expected_url = f'`/api{expected_path}`'
            else:
                expected_url = f'"/api{expected_path}"'

            w(f'  it("{name} → {http} {path}", async () => {{')
            w(f"    mockOk({{}});")

            # Special case: login returns csrf_token
            if name == "login":
                w(f'    mockFetch.mockReset();')
                w(f'    mockOk({{ token: "t", csrf_token: "c" }});')

            w(f"    await api.{name}({args_str});")
            w(f"    expect(mockFetch).toHaveBeenCalledTimes(1);")
            w(f"    const [url, opts] = mockFetch.mock.calls[0];")
            # Check URL contains the expected base path
            if "{param_" in path:
                base = path.split("{param_")[0].rstrip("/")
                w(f'    expect(url).toContain("/api{base}");')
            elif param_count > 0:
                # Methods with any params may add query strings
                w(f'    expect(url.split("?")[0]).toBe("/api{path}");')
            else:
                w(f"    expect(url).toBe({expected_url});")

            if http != "GET":
                w(f'    expect(opts.method).toBe("{http}");')

            if has_body:
                w(f"    expect(opts.body).toBeDefined();")
                w(f"    expect(() => JSON.parse(opts.body)).not.toThrow();")

            w(f"  }});")
            w("")

        w("});")
        w("")

    # --- Summary test ---
    w(f'describe("API coverage summary", () => {{')
    w(f'  it("has {len(methods)} tested methods", () => {{')
    w(f"    const methodCount = Object.keys(api).filter(")
    w(f'      (k) => typeof (api as Record<string, unknown>)[k] === "function"')
    w(f"    ).length;")
    w(f"    expect(methodCount).toBeGreaterThanOrEqual({len(methods)});")
    w(f"  }});")
    w(f"}});")

    print("\n".join(lines))


if __name__ == "__main__":
    main()
