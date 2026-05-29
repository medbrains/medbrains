export interface PrintCopyRoute {
  label: string;
  printerProfile: string;
}

function escapePrintHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[char] ?? char;
  });
}

export function copyPrintStyles() {
  return `
    .copy-page { page-break-after: always; }
    .copy-page:last-child { page-break-after: auto; }
    .copy-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border: 1px solid #999;
      border-radius: 4px;
      padding: 6px 10px;
      margin-bottom: 10px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .copy-printer {
      color: #555;
      font-weight: 600;
      text-transform: none;
      letter-spacing: 0;
    }
  `;
}

export function buildCopyPrintHtml(contentHtml: string, copies: readonly PrintCopyRoute[]) {
  return copies
    .map(
      (copy) => `
        <section class="copy-page">
          <div class="copy-meta">
            <span>${escapePrintHtml(copy.label)}</span>
            <span class="copy-printer">${escapePrintHtml(copy.printerProfile)}</span>
          </div>
          ${contentHtml}
        </section>
      `,
    )
    .join("");
}
