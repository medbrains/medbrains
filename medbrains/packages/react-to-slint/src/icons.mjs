/**
 * Tabler icons as Slint images. `@tabler/icons-react` names each component after its SVG file
 * (`IconUserPlus` is `outline/user-plus.svg`, `IconStarFilled` is `filled/star.svg`), so the
 * converter emits `@image-url("@medbrains-gui-kit/icons/<file>")` and the kit draws it with
 * `colorize`, which uses the SVG as an alpha mask in the token colour
 * (https://releases.slint.dev/1.18.0/docs/slint/reference/elements/image/).
 */
import fs from "node:fs";
import path from "node:path";

/** The SVG file for a Tabler component name and stroke width, or null for a non-Tabler name. */
export function iconFile(component, stroke) {
  const m = component.match(/^Icon([A-Z0-9].*?)(Filled)?$/);
  if (!m) return null;
  // PascalCase back to the kebab file name: digits start a new word (IconSquareNumber1 -> square-number-1).
  const base = m[1].replace(/([a-z])([A-Z0-9])/g, "$1-$2").replace(/([0-9])([A-Z])/g, "$1-$2").toLowerCase();
  const style = m[2] ? "filled" : "outline";
  const suffix = stroke && stroke !== 2 && style === "outline" ? `-s${String(stroke).replace(".", "_")}` : "";
  return { style, base, file: `${style === "filled" ? "filled-" : ""}${base}${suffix}.svg`, stroke: stroke ?? 2 };
}

/**
 * Copies the icons a conversion used from `@tabler/icons` into the kit's `icons/` folder,
 * rewriting `stroke-width` when the source asked for another stroke. Returns names not found.
 */
export function writeIcons(icons, tablerDir, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const missing = [];
  for (const icon of icons.values()) {
    const src = path.join(tablerDir, "icons", icon.style, `${icon.base}.svg`);
    if (!fs.existsSync(src)) {
      missing.push(icon.base);
      continue;
    }
    let svg = fs.readFileSync(src, "utf8");
    if (icon.style === "outline" && icon.stroke !== 2) svg = svg.replace(/stroke-width="2"/, `stroke-width="${icon.stroke}"`);
    fs.writeFileSync(path.join(outDir, icon.file), svg);
  }
  return missing;
}
