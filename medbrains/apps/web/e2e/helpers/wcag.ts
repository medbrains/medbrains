import { expect, type Locator, type Page } from "@playwright/test";
import axe from "axe-core";

declare global {
  interface Window {
    axe: typeof axe;
  }
}

const WCAG_2_AAA_AXE_TAGS = [
  "wcag2a",
  "wcag2aa",
  "wcag2aaa",
  "wcag21a",
  "wcag21aa",
  "wcag22aa",
  "best-practice",
];

interface WcagAaaOptions {
  include?: string;
}

interface AxeViolationSummary {
  id: string;
  impact?: string;
  help: string;
  helpUrl: string;
  nodes: Array<{ target: string[]; failureSummary?: string }>;
}

interface UiTargetGap {
  label: string;
  role: string;
  selector: string;
  width: number;
  height: number;
}

async function injectAxe(page: Page) {
  await page.addScriptTag({ content: axe.source });
}

function formatAxeViolations(violations: AxeViolationSummary[]): string {
  return violations
    .map((violation) => {
      const nodes = violation.nodes
        .slice(0, 4)
        .map((node) => {
          const summary = node.failureSummary ? ` ${node.failureSummary.replace(/\s+/g, " ")}` : "";
          return `    ${node.target.join(" ")}${summary}`;
        })
        .join("\n");
      return `${violation.id} [${violation.impact ?? "unknown"}]: ${violation.help}\n${nodes}\n    ${violation.helpUrl}`;
    })
    .join("\n\n");
}

export async function expectWcag2AaaMachineChecks(page: Page, options: WcagAaaOptions = {}) {
  await injectAxe(page);

  const results = await page.evaluate(
    async ({ include, tags }) => {
      const root = include ? document.querySelector(include) : document;
      return window.axe.run(root ?? document, {
        runOnly: { type: "tag", values: tags },
        resultTypes: ["violations"],
      });
    },
    { include: options.include, tags: WCAG_2_AAA_AXE_TAGS },
  );

  const violations = results.violations as AxeViolationSummary[];
  expect(
    violations,
    violations.length > 0
      ? `WCAG 2 AAA automated violations:\n${formatAxeViolations(violations)}`
      : "WCAG 2 AAA automated violations",
  ).toEqual([]);
}

export async function expectNamedInteractiveControls(page: Page, include = "main") {
  const unnamed = await page.evaluate((selector) => {
    const root = document.querySelector(selector) ?? document;
    const candidates = [
      ...root.querySelectorAll<HTMLElement>(
        'button, a[href], input, select, textarea, [role="button"], [role="link"], [role="menuitem"]',
      ),
    ];

    return candidates
      .filter((el) => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        if (style.display === "none" || style.visibility === "hidden") return false;
        if (rect.width === 0 || rect.height === 0) return false;
        if (el.hasAttribute("disabled") || el.getAttribute("aria-hidden") === "true") return false;

        const hasName = Boolean(
          el.getAttribute("aria-label")?.trim() ||
            el.getAttribute("aria-labelledby")?.trim() ||
            el.getAttribute("title")?.trim() ||
            el.textContent?.trim(),
        );
        return !hasName;
      })
      .map((el) => ({
        role: el.getAttribute("role") ?? el.tagName.toLowerCase(),
        selector: cssPath(el),
        width: Math.round(el.getBoundingClientRect().width),
        height: Math.round(el.getBoundingClientRect().height),
      }));

    function cssPath(el: Element): string {
      const parts: string[] = [];
      let current: Element | null = el;
      while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < 5) {
        let part = current.tagName.toLowerCase();
        if (current.id) {
          part += `#${current.id}`;
          parts.unshift(part);
          break;
        }
        const testId = current.getAttribute("data-testid");
        if (testId) part += `[data-testid="${testId}"]`;
        const parent = current.parentElement;
        if (parent) {
          const siblings = [...parent.children].filter((sibling) => sibling.tagName === current?.tagName);
          if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
        }
        parts.unshift(part);
        current = parent;
      }
      return parts.join(" > ");
    }
  }, include);

  expect(unnamed, "Interactive controls must have an accessible name").toEqual([]);
}

export async function expectEnhancedTargetSizes(page: Page, include = "main") {
  const gaps = await page.evaluate((selector) => {
    const root = document.querySelector(selector) ?? document;
    const candidates = [
      ...root.querySelectorAll<HTMLElement>(
        'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="link"], [role="menuitem"], [tabindex]:not([tabindex="-1"])',
      ),
    ];

    return candidates
      .filter((el) => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        if (style.display === "none" || style.visibility === "hidden") return false;
        if (rect.width === 0 || rect.height === 0) return false;
        if (el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true") return false;
        return rect.width < 44 || rect.height < 44;
      })
      .map((el) => ({
        label:
          el.getAttribute("aria-label") ??
          el.getAttribute("title") ??
          el.textContent?.trim().replace(/\s+/g, " ").slice(0, 80) ??
          "",
        role: el.getAttribute("role") ?? el.tagName.toLowerCase(),
        selector: cssPath(el),
        width: Math.round(el.getBoundingClientRect().width),
        height: Math.round(el.getBoundingClientRect().height),
      }));

    function cssPath(el: Element): string {
      const parts: string[] = [];
      let current: Element | null = el;
      while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < 5) {
        let part = current.tagName.toLowerCase();
        const testId = current.getAttribute("data-testid");
        if (testId) part += `[data-testid="${testId}"]`;
        const parent = current.parentElement;
        if (parent) {
          const siblings = [...parent.children].filter((sibling) => sibling.tagName === current?.tagName);
          if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
        }
        parts.unshift(part);
        current = parent;
      }
      return parts.join(" > ");
    }
  }, include);

  expect(
    gaps as UiTargetGap[],
    "WCAG 2 AAA target size check expects interactive controls to be at least 44x44 CSS px unless a documented exception applies",
  ).toEqual([]);
}

export async function expectKeyboardFocusable(locator: Locator, name: string) {
  await locator.scrollIntoViewIfNeeded();
  await locator.focus();
  await expect(locator, `${name} must be keyboard focusable`).toBeFocused();
}

export async function expectCurrentFocusVisible(page: Page, name: string) {
  const focus = await page.evaluate(() => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || active === document.body) {
      return { ok: false, reason: "No active keyboard-focusable element" };
    }

    const rect = active.getBoundingClientRect();
    const style = window.getComputedStyle(active);
    const outlineWidth = Number.parseFloat(style.outlineWidth || "0");
    const hasOutline = style.outlineStyle !== "none" && outlineWidth > 0;
    const hasBoxShadow = style.boxShadow !== "none";
    const hasFocusVisible = active.matches(":focus-visible");

    return {
      ok: rect.width > 0 && rect.height > 0 && (hasOutline || hasBoxShadow || hasFocusVisible),
      reason: `${active.tagName.toLowerCase()} ${active.textContent?.trim().slice(0, 60) ?? ""}`,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      boxShadow: style.boxShadow,
      focusVisible: hasFocusVisible,
    };
  });

  expect(focus, `${name} must show a visible keyboard focus indicator`).toMatchObject({
    ok: true,
  });
}
