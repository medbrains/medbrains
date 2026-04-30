/**
 * Tiny Handlebars-style template renderer. Zero deps — Node built-in
 * fs + path. Supports:
 *   - {{varName}}                — substitution
 *   - {{#if varName}}...{{/if}}  — conditional block
 *   - {{#unless varName}}...{{/unless}} — inverse conditional
 *   - {{#each varName}}...{{this}}...{{/each}} — list iteration
 *
 * Escaping is intentional — no HTML escaping; we render config files
 * (JSON / TS / YAML / Gradle) where double-escaping breaks output.
 * Inputs come from the developer running the generator, not user
 * traffic, so XSS is a non-concern here.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";

export function renderTemplate(template, ctx) {
  let out = template;
  out = renderEach(out, ctx);
  out = renderIf(out, ctx);
  out = renderUnless(out, ctx);
  out = renderVars(out, ctx);
  return out;
}

function renderEach(input, ctx) {
  const re = /\{\{#each\s+([\w.]+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
  return input.replace(re, (_match, key, body) => {
    const arr = lookup(ctx, key);
    if (!Array.isArray(arr)) {
      return "";
    }
    return arr
      .map((item) => {
        const itemCtx = { ...ctx, this: item };
        return renderTemplate(body, itemCtx);
      })
      .join("");
  });
}

function renderIf(input, ctx) {
  const re = /\{\{#if\s+([\w.]+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
  return input.replace(re, (_match, key, body) => {
    const [thenBody, elseBody] = splitElse(body);
    const isTrue = truthy(lookup(ctx, key));
    return renderTemplate(isTrue ? thenBody : elseBody, ctx);
  });
}

function splitElse(body) {
  const m = body.match(/\{\{else\}\}/);
  if (!m) return [body, ""];
  const idx = body.indexOf("{{else}}");
  return [body.slice(0, idx), body.slice(idx + "{{else}}".length)];
}

function renderUnless(input, ctx) {
  const re = /\{\{#unless\s+([\w.]+)\}\}([\s\S]*?)\{\{\/unless\}\}/g;
  return input.replace(re, (_match, key, body) => {
    return truthy(lookup(ctx, key)) ? "" : renderTemplate(body, ctx);
  });
}

function renderVars(input, ctx) {
  return input.replace(/\{\{([\w.]+)\}\}/g, (_match, key) => {
    const v = lookup(ctx, key);
    return v == null ? "" : String(v);
  });
}

function lookup(ctx, key) {
  if (key === "this") {
    return ctx.this;
  }
  const parts = key.split(".");
  let cur = ctx;
  for (const part of parts) {
    if (cur == null) return undefined;
    cur = cur[part];
  }
  return cur;
}

function truthy(v) {
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "string") return v.length > 0;
  return Boolean(v);
}

export function renderTree(srcDir, destDir, ctx, opts = {}) {
  const written = [];
  walkDir(srcDir, (absPath) => {
    const rel = relative(srcDir, absPath);
    const renderedRel = renderTemplate(rel.replace(/\.hbs$/u, ""), ctx);
    const destPath = join(destDir, renderedRel);
    mkdirSync(dirname(destPath), { recursive: true });
    if (absPath.endsWith(".hbs")) {
      const tpl = readFileSync(absPath, "utf-8");
      const rendered = renderTemplate(tpl, ctx);
      writeFileSync(destPath, rendered);
    } else {
      writeFileSync(destPath, readFileSync(absPath));
    }
    if (opts.onWrite) opts.onWrite(destPath);
    written.push(destPath);
  });
  return written;
}

function walkDir(dir, fileFn) {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    const st = statSync(abs);
    if (st.isDirectory()) {
      walkDir(abs, fileFn);
    } else {
      fileFn(abs);
    }
  }
}
