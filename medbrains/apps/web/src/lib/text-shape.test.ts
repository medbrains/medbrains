import { describe, expect, it } from "vitest";
import {
  htmlToPlainText,
  joinRuns,
  trimTrailing,
  withoutParenthesised,
  withoutTrailingParenthesised,
} from "./text-shape";

describe("text shaping without backtracking", () => {
  it("joins kept runs with one separator and none at the ends", () => {
    expect(joinRuns("  blood  pressure!! ", "_", /[a-z0-9]/)).toBe("blood_pressure");
    expect(joinRuns("ICU bay 2", "-", /[A-Z0-9]/)).toBe("ICU-2");
    expect(joinRuns("___", "_", /[a-z]/)).toBe("");
  });

  it("stays linear on a long run of separators", () => {
    const hostile = `${"_".repeat(50_000)}x`;
    expect(joinRuns(hostile, "_", /[a-z]/)).toBe("x");
    expect(trimTrailing(`a${"/".repeat(50_000)}`, "/")).toBe("a");
  });

  it("trims only the trailing character", () => {
    expect(trimTrailing("https://pacs.example///", "/")).toBe("https://pacs.example");
    expect(trimTrailing("/", "/")).toBe("");
    expect(trimTrailing("/api/x", "/")).toBe("/api/x");
  });

  it("drops parenthesised spans, nested or unclosed", () => {
    expect(withoutParenthesised("Paracetamol (500 mg) tab").trim()).toBe(
      "Paracetamol   tab".trim(),
    );
    expect(withoutParenthesised("CBC (full (auto)) panel")).toBe("CBC   panel");
    expect(withoutParenthesised("Urea (unclosed").trim()).toBe("Urea");
    expect(withoutParenthesised("a)b")).toBe("a)b");
  });

  it("drops one trailing parenthesised suffix only", () => {
    expect(withoutTrailingParenthesised("Cardiology (OPD)")).toBe("Cardiology");
    expect(withoutTrailingParenthesised("Cardiology")).toBe("Cardiology");
    expect(withoutTrailingParenthesised("(OPD)")).toBe("(OPD)");
    expect(withoutTrailingParenthesised("Ward(B)")).toBe("Ward(B)");
  });

  it("keeps list items, line breaks and nested blocks apart", () => {
    expect(htmlToPlainText("<ul><li>Fever</li><li>Cough</li></ul>")).toBe("Fever Cough");
    expect(htmlToPlainText("<p>a<br>b</p>")).toBe("a b");
    expect(htmlToPlainText("<div><p>BP 120/80</p><div><p>Pulse 82</p></div></div>")).toBe(
      "BP 120/80 Pulse 82",
    );
    expect(htmlToPlainText("<p>no <strong>split</strong>ting inside a word</p>")).toBe(
      "no splitting inside a word",
    );
  });

  it("leaves out what the page never shows", () => {
    expect(htmlToPlainText("<p>a</p><style>p{}</style><script>x()</script>")).toBe("a");
    expect(htmlToPlainText("<p>b</p><noscript>no js</noscript><template><p>t</p></template>")).toBe(
      "b",
    );
  });

  it("separates table cells", () => {
    expect(
      htmlToPlainText(
        "<table><tr><td>Hb</td><td>11.2</td></tr><tr><td>WBC</td><td>9</td></tr></table>",
      ),
    ).toBe("Hb 11.2 WBC 9");
  });

  it("decodes entities rather than dropping them", () => {
    expect(htmlToPlainText("<p>BP &lt; 90 &amp; HR &gt; 120</p>")).toBe("BP < 90 & HR > 120");
  });

  it("turns rich text into a one-line preview", () => {
    expect(htmlToPlainText("<p>Fever&nbsp;3 days</p><p>  cough </p>")).toBe("Fever 3 days cough");
    expect(htmlToPlainText("")).toBe("");
  });
});
