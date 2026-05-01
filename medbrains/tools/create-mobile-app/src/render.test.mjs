import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderTemplate } from "./render.mjs";

describe("renderTemplate", () => {
  it("substitutes simple variables", () => {
    assert.equal(renderTemplate("hello {{name}}", { name: "world" }), "hello world");
  });

  it("returns empty for undefined vars", () => {
    assert.equal(renderTemplate("{{missing}}", {}), "");
  });

  it("renders if block when truthy", () => {
    const tpl = "{{#if abdm}}ABHA enabled{{/if}}";
    assert.equal(renderTemplate(tpl, { abdm: true }), "ABHA enabled");
    assert.equal(renderTemplate(tpl, { abdm: false }), "");
    assert.equal(renderTemplate(tpl, {}), "");
  });

  it("renders unless block when falsy", () => {
    const tpl = "{{#unless skip}}included{{/unless}}";
    assert.equal(renderTemplate(tpl, { skip: false }), "included");
    assert.equal(renderTemplate(tpl, { skip: true }), "");
  });

  it("iterates each with this", () => {
    const tpl = "{{#each modules}}- {{this}}\n{{/each}}";
    assert.equal(
      renderTemplate(tpl, { modules: ["doctor", "nurse"] }),
      "- doctor\n- nurse\n",
    );
  });

  it("supports dotted lookups", () => {
    assert.equal(
      renderTemplate("{{app.name}}", { app: { name: "staff" } }),
      "staff",
    );
  });

  it("nested if + each work together", () => {
    const tpl = `{{#if hasModules}}{{#each modules}}{{this}},{{/each}}{{/if}}`;
    assert.equal(
      renderTemplate(tpl, { hasModules: true, modules: ["a", "b"] }),
      "a,b,",
    );
  });

  it("each over empty array yields empty", () => {
    assert.equal(renderTemplate("{{#each xs}}x{{/each}}", { xs: [] }), "");
  });

  it("if treats empty string and empty array as falsy", () => {
    const tpl = "{{#if x}}Y{{/if}}";
    assert.equal(renderTemplate(tpl, { x: "" }), "");
    assert.equal(renderTemplate(tpl, { x: [] }), "");
    assert.equal(renderTemplate(tpl, { x: ["a"] }), "Y");
    assert.equal(renderTemplate(tpl, { x: "v" }), "Y");
  });

  it("if/else picks the right branch", () => {
    const tpl = "{{#if hot}}fire{{else}}cold{{/if}}";
    assert.equal(renderTemplate(tpl, { hot: true }), "fire");
    assert.equal(renderTemplate(tpl, { hot: false }), "cold");
    assert.equal(renderTemplate(tpl, {}), "cold");
  });

  it("plain if without else still works", () => {
    const tpl = "{{#if hot}}fire{{/if}}";
    assert.equal(renderTemplate(tpl, { hot: true }), "fire");
    assert.equal(renderTemplate(tpl, { hot: false }), "");
  });
});
