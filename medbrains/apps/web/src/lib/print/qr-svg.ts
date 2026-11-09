import { QRCodeSVG } from "qrcode.react";
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

/**
 * A QR code as SVG markup, for print paths that write an HTML string into a
 * popup instead of mounting React. Renders `QRCodeSVG` into a detached node
 * with the client renderer already on the page, synchronously, and reads it
 * back. This replaced `react-dom/server`'s `renderToStaticMarkup`, which
 * added a second React renderer (~190 kB minified) to the signed-in shell
 * for two QR codes. Level M: printed QRs are scanned off folded, handled paper.
 */
export function qrSvgMarkup(value: string, size: number): string {
  const host = document.createElement("div");
  const root = createRoot(host);
  flushSync(() => root.render(createElement(QRCodeSVG, { value, size, level: "M" })));
  const markup = host.innerHTML;
  root.unmount();
  return markup;
}
