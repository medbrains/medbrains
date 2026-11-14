#!/usr/bin/env node
/**
 * Generates a runnable Slint app from a converted tree, laid out as the web app's shell
 * (layouts/AppLayout.tsx): a 48 px top bar with the logo, search, help, notes, notifications,
 * theme and language controls and the user chip; a 256 px side menu with the web's groups,
 * module badges (navigation.ts MODULE_BADGE_DEFS), active rule and collapse control; and the
 * main area with its breadcrumb and dot grid. Every routed page whose screen compiles opens
 * natively; the rest stay in the menu, marked web only.
 *
 *   app-shell --web apps/web/src --out <converted tree> [--ok <file listing compiling screens>]
 *
 * Sizes are the web's as measured in the browser (header 48, menu 256 with 8/10 padding, items
 * 42 high with 3 px between, 26 px badges, 16 px main padding). Module colours are navigation.ts
 * data, written into a generated `Modules` global, not into the kit.
 */
import fs from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";
import { iconFile, writeIcons } from "../src/icons.mjs";
import { KIT_DIR } from "../src/slint-types.mjs";

/** The value after a flag, or null. */
const flag = (argv, name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null);

/** A literal from navigation.ts as plain data. */
function value(node) {
  if (!node) return undefined;
  if (node.type === "StringLiteral") return node.value;
  if (node.type === "ArrayExpression") return node.elements.map(value);
  if (node.type === "ObjectExpression") {
    return Object.fromEntries(node.properties.filter((p) => p.key).map((p) => [p.key.name ?? p.key.value, value(p.value)]));
  }
  if (node.type === "TSAsExpression" || node.type === "TSSatisfiesExpression") return value(node.expression);
  return undefined;
}

/** `NAV_GROUPS` and `MODULE_BADGE_DEFS` from config/navigation.ts. */
export function navigation(webSrc) {
  const source = fs.readFileSync(path.join(webSrc, "config/navigation.ts"), "utf8");
  const ast = parse(source, { sourceType: "module", plugins: ["typescript", "jsx"] });
  const out = {};
  for (const st of ast.program.body) {
    const decl = (st.declaration ?? st).declarations?.[0];
    if (decl?.id?.name === "NAV_GROUPS") out.groups = value(decl.init);
    if (decl?.id?.name === "MODULE_BADGE_DEFS") out.badges = value(decl.init);
  }
  if (!out.groups) throw new Error("NAV_GROUPS not found");
  return out;
}

/** The module badge for a path: the longest MODULE_BADGE_DEFS key it equals or starts with. */
export function matchBadge(badges, pathname) {
  let best = null;
  for (const key of Object.keys(badges ?? {})) {
    if ((pathname === key || pathname.startsWith(`${key}/`)) && key.length > (best?.length ?? 0)) best = key;
  }
  return best ? badges[best] : null;
}

/** `route path -> { component, file }` from App.tsx's lazy imports and routes. */
function routes(webSrc) {
  const app = fs.readFileSync(path.join(webSrc, "App.tsx"), "utf8");
  const lazy = new Map();
  for (const m of app.matchAll(/const (\w+) = lazy\(\s*\(\) =>\s*import\("\.\/([^"]+)"\)\.then\(\(m\) => \(\{ default: m\.(\w+) \}\)\)/g)) {
    lazy.set(m[1], { file: m[2], component: m[3] });
  }
  const out = new Map();
  for (const m of app.matchAll(/<Route\s+path="([^"]+)"\s+element=\{\s*<(\w+)/g)) {
    // Routes inside the signed-in shell are relative ("pharmacy"); the menu uses "/pharmacy".
    const route = m[1].startsWith("/") ? m[1] : `/${m[1]}`;
    if (lazy.has(m[2]) && !out.has(route)) out.set(route, lazy.get(m[2]));
  }
  return out;
}

/** The converted `.slint` for a page import path, if it exists and exports the component. */
function screenFile(outDir, importPath, component, compiling) {
  for (const candidate of [`${importPath}.slint`, `${importPath}/index.slint`, `${importPath}/page.slint`]) {
    const file = path.join(outDir, candidate);
    if (!fs.existsSync(file) || (compiling && !compiling.has(file))) continue;
    if (new RegExp(`export component ${component}\\b`).test(fs.readFileSync(file, "utf8"))) return candidate;
  }
  return null;
}

const quote = (s) => `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
const humanise = (k) => k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());

export function appShell({ webSrc, outDir, compiling, iconsDir }) {
  const labels = JSON.parse(fs.readFileSync(path.join(webSrc, "../public/locales/en/nav.json"), "utf8"));
  const { groups, badges } = navigation(webSrc);
  const routeMap = routes(webSrc);
  const imports = [];
  const screens = [];
  const nav = [];
  const colours = new Map();
  const icons = new Map();
  let available = 0;
  let total = 0;
  const colourName = (hex) => {
    if (!colours.has(hex)) colours.set(hex, `m${colours.size}`);
    return `Modules.${colours.get(hex)}`;
  };
  const visit = (item, depth) => {
    total += 1;
    const route = routeMap.get(item.path);
    const file = route ? screenFile(outDir, route.file, route.component, compiling) : null;
    if (file) {
      const alias = `Screen${screens.length}`;
      imports.push(`import { ${route.component} as ${alias} } from ${quote(file)};`);
      screens.push({ path: item.path, alias });
      available += 1;
    }
    const label = labels[item.i18nKey] ?? humanise(item.i18nKey ?? item.path);
    const badge = matchBadge(badges, item.path);
    const icon = item.icon ? iconFile(item.icon) : null;
    if (icon) icons.set(icon.file, icon);
    const mark = badge ? `abbr: ${quote(badge.abbr)}; item-color: ${colourName(badge.color)};` : icon ? `icon: @image-url("@medbrains-gui-kit/icons/${icon.file}");` : "";
    const pick = `root.route = ${quote(item.path)}; Shell.route = ${quote(item.path)}; Shell.crumb = ${quote(label)}; Shell.badge-abbr = ${quote(badge?.abbr ?? "")};${badge ? ` Shell.badge-color = ${colourName(badge.color)};` : ""}`;
    nav.push(`                        NavItem { label: ${quote(label)}; ${mark} native: ${file ? "true" : "false"}; depth: ${depth}; active: root.route == ${quote(item.path)}; picked => { ${pick} } }`);
    if (item.path === screens[0]?.path && !nav.initial) nav.initial = pick;
    for (const child of item.children ?? []) visit(child, depth + 1);
  };
  groups.forEach((group, gi) => {
    if (gi > 0) nav.push("                        Rectangle { height: 9px; Rectangle { height: 1px; background: Tokens.color-outline-outline-variant; opacity: 0.4; } }");
    const key = `group${group.key.charAt(0).toUpperCase()}${group.key.slice(1)}`;
    nav.push(`                        GroupLabel { text: ${quote((labels[key] ?? humanise(group.key)).toUpperCase())}; }`);
    for (const item of group.items ?? []) visit(item, 0);
  });
  for (const name of ["search", "help", "note", "bell", "language", "sun", "moon", "layout-sidebar-left-collapse"]) icons.set(`${name}.svg`, { style: "outline", base: name, file: `${name}.svg`, stroke: 2 });
  const body = screens.map((s) => `                        if root.route == ${quote(s.path)} : ${s.alias} { }`);
  const moduleGlobal = [...colours].map(([hex, name]) => `    out property <color> ${name}: ${hex};`).join("\n");
  const text = `// GENERATED by @medbrains/react-to-slint app-shell from the web app's layout, navigation and routes.
// ${available} of ${total} menu entries open a native screen; the rest are marked web only.
import { Palette, ScrollView } from "std-widgets.slint";
import { Tokens, Metrics, Shell, MbModuleBadge, MbIconButton, FocusRing } from "@medbrains-gui-kit/kit.slint";
${imports.join("\n")}

/** Module identity colours, from navigation.ts MODULE_BADGE_DEFS (data, as on the web). */
global Modules {
${moduleGlobal}
}

/** A menu group heading: uppercase, as the web's navGroupLabel renders. */
component GroupLabel inherits Text {
    font-family: Metrics.font;
    font-size: Tokens.font-md;
    color: Tokens.color-content-on-surface;
    height: 25px;
    vertical-alignment: center;
}

/** One menu entry: badge or icon, label; the active one tinted in its module colour with a 3 px rule. */
component NavItem inherits Rectangle {
    in property <string> label;
    in property <string> abbr;
    in property <color> item-color: Tokens.color-primary-primary;
    in property <image> icon;
    in property <bool> native;
    in property <bool> active;
    in property <int> depth;
    callback picked();
    height: 45px;
    accessible-role: button;
    accessible-label: root.label;
    accessible-item-selected: root.active;
    accessible-action-default => { root.picked(); }
    Rectangle {
        y: 0;
        height: 42px;
        background: root.active ? root.item-color.with-alpha(0.16) : touch.has-hover ? root.item-color.with-alpha(0.10) : transparent;
        animate background { duration: Metrics.fast; }
        if root.active : Rectangle { x: 0; width: 3px; background: root.item-color; }
        HorizontalLayout {
            padding-left: 12px + root.depth * 16px;
            padding-right: 12px;
            spacing: 12px;
            if root.abbr != "" : MbModuleBadge { abbr: root.abbr; badge-color: root.item-color; size: 26px; y: (parent.height - self.height) / 2; }
            if root.abbr == "" : Rectangle {
                width: 26px;
                Image { source: root.icon; width: 22px; height: 22px; colorize: Tokens.color-content-on-surface; }
            }
            Text {
                text: root.label;
                font-family: Metrics.font;
                font-size: Tokens.font-sm;
                font-weight: root.active ? 700 : 500;
                color: root.active ? root.item-color : root.native ? Tokens.color-content-on-surface : Tokens.color-content-on-surface-variant;
                vertical-alignment: center;
                overflow: elide;
                horizontal-stretch: 1;
            }
            if !root.native : Text { text: "web"; font-family: Metrics.mono; font-size: 10px; color: Tokens.color-content-on-surface-variant; vertical-alignment: center; }
        }
        touch := TouchArea { clicked => { root.picked(); } }
        focus := FocusScope { key-pressed(event) => { if (event.text == " " || event.text == "\\n") { root.picked(); return accept; } return reject; } }
        FocusRing { shown: focus.has-focus; }
    }
}

/** A header control: an icon in a 28 px square (Mantine ActionIcon size md, subtle). */
component HeaderIcon inherits MbIconButton {
    size: "md";
}

export component MedBrainsApp inherits Window {
    title: "MedBrains";
    preferred-width: 1280px;
    preferred-height: 800px;
    default-font-family: Metrics.font;
    background: Tokens.color-surface-surface;
    in-out property <string> route: ${quote(screens[0]?.path ?? "/dashboard")};
    in-out property <string> user-name: "Preview Admin";
    in-out property <string> user-role: "Super Admin";
    property <bool> dark-flag: Tokens.dark;
    changed dark-flag => { Palette.color-scheme = Tokens.dark ? ColorScheme.dark : ColorScheme.light; }
    changed width => { Tokens.viewport-width = self.width; }
    changed route => { root.select(); }
    init => { Tokens.viewport-width = self.width; root.select(); }
    /** Sets the Shell globals for the current route, as picking it in the menu does. */
    function select() {
${screens.length ? nav.filter((l) => l.includes("picked =>")).map((l) => { const m = l.match(/active: root\.route == ("[^"]+"); picked => \{ (.*) \} \}$/); return m ? `        if (root.route == ${m[1]}) { ${m[2].replace(/root\.route = "[^"]+"; /, "")} }` : ""; }).filter(Boolean).join("\n") : ""}
    }
    VerticalLayout {
        // Top bar (AppShell.Header): logo left; widgets, search, help, notes, bell, theme, language, user right.
        Rectangle {
            height: 48px;
            background: Tokens.color-surface-surface;
            HorizontalLayout {
                padding-left: 16px;
                padding-right: 16px;
                spacing: 12px;
                HorizontalLayout {
                    spacing: 8px;
                    alignment: start;
                    horizontal-stretch: 1;
                    Image { source: @image-url("brand/medbrains-mark.svg"); width: 30px; height: 30px; y: 9px; accessible-role: image; accessible-label: "MedBrains"; }
                    Text { text: "MedBrains HMS"; font-family: Metrics.font; font-size: Tokens.font-sm; font-weight: 600; letter-spacing: -0.28px; color: Tokens.color-content-on-surface; vertical-alignment: center; }
                }
                Rectangle { width: 1px; height: 30px; y: 9px; background: Tokens.color-outline-outline-variant; }
                // Search trigger (Spotlight): 160 x 30, 14 px icon, "Search..." and the shortcut.
                Rectangle {
                    width: 160px;
                    height: 30px;
                    y: 9px;
                    accessible-role: button;
                    accessible-label: "Search";
                    search-keys := FocusScope { }
                    FocusRing { shown: search-keys.has-focus; }
                    HorizontalLayout {
                        spacing: 6px;
                        alignment: start;
                        Image { source: @image-url("@medbrains-gui-kit/icons/search.svg"); width: 14px; height: 14px; y: 8px; colorize: Tokens.color-content-on-surface; }
                        Text { text: "Search..."; font-family: Metrics.font; font-size: Tokens.font-xs; color: Tokens.color-content-on-surface-variant; vertical-alignment: center; }
                        Rectangle {
                            width: kbd.preferred-width + 8px;
                            height: 18px;
                            y: 6px;
                            border-width: 1px;
                            border-color: Tokens.color-outline-outline;
                            background: Tokens.color-surface-surface-container-high;
                            kbd := Text { text: "⌘K"; font-family: Metrics.mono; font-size: 10px; color: Tokens.color-content-on-surface; }
                        }
                    }
                }
                HeaderIcon { y: 10px; icon: @image-url("@medbrains-gui-kit/icons/help.svg"); accessible-label: "Help"; }
                HeaderIcon { y: 10px; icon: @image-url("@medbrains-gui-kit/icons/note.svg"); accessible-label: "Notes"; }
                HeaderIcon { y: 10px; icon: @image-url("@medbrains-gui-kit/icons/bell.svg"); accessible-label: "Notifications"; }
                // Theme switch: a pill track with the sun or moon thumb.
                Rectangle {
                    width: 48px;
                    height: 24px;
                    y: 12px;
                    border-radius: 12px;
                    background: Tokens.dark ? Tokens.color-surface-surface-container-highest : Tokens.color-primary-primary-container;
                    accessible-role: switch;
                    accessible-label: "Dark theme";
                    accessible-checked: Tokens.dark;
                    accessible-action-default => { Tokens.dark = !Tokens.dark; }
                    Rectangle {
                        x: Tokens.dark ? parent.width - self.width - 2px : 2px;
                        width: 20px;
                        height: 20px;
                        border-radius: 10px;
                        background: Tokens.color-warning-warning-container;
                        animate x { duration: Metrics.fast; }
                        Image { source: Tokens.dark ? @image-url("@medbrains-gui-kit/icons/moon.svg") : @image-url("@medbrains-gui-kit/icons/sun.svg"); width: 14px; height: 14px; colorize: Tokens.color-warning-warning; }
                    }
                    TouchArea { clicked => { Tokens.dark = !Tokens.dark; } }
                    theme-keys := FocusScope { key-pressed(event) => { if (event.text == " " || event.text == "\\n") { Tokens.dark = !Tokens.dark; return accept; } return reject; } }
                    FocusRing { shown: theme-keys.has-focus; }
                }
                HeaderIcon { y: 10px; icon: @image-url("@medbrains-gui-kit/icons/language.svg"); accessible-label: "Language"; }
                Rectangle { width: 1px; height: 30px; y: 9px; background: Tokens.color-outline-outline-variant; }
                // User chip: initial on the primary container, name and role.
                HorizontalLayout {
                    spacing: 10px;
                    Rectangle {
                        width: 30px;
                        height: 30px;
                        y: 9px;
                        background: Tokens.color-primary-primary-container;
                        Text { text: root.user-name.character-count > 0 ? "P" : ""; font-family: Metrics.font; font-size: Tokens.font-sm; font-weight: 600; color: Tokens.color-primary-primary-text; }
                    }
                    VerticalLayout {
                        alignment: center;
                        Text { text: root.user-name; font-family: Metrics.font; font-size: Tokens.font-xs; font-weight: 600; color: Tokens.color-content-on-surface; }
                        Text { text: root.user-role; font-family: Metrics.font; font-size: Tokens.font-xs; color: Tokens.color-content-on-surface-variant; }
                    }
                }
            }
            Rectangle { y: parent.height - 1px; height: 1px; background: Tokens.color-outline-outline-variant; }
        }
        HorizontalLayout {
            // Side menu (AppShell.Navbar, expanded): 256 px, 8 px sides, 10 px top and bottom.
            Rectangle {
                width: 256px;
                background: Tokens.color-surface-surface;
                VerticalLayout {
                    padding-left: 8px;
                    padding-right: 8px;
                    padding-top: 10px;
                    padding-bottom: 10px;
                    ScrollView {
                        VerticalLayout {
                            alignment: start;
${nav.join("\n")}
                        }
                    }
                    Rectangle { height: 9px; Rectangle { height: 1px; background: Tokens.color-outline-outline-variant; opacity: 0.4; } }
                    // Collapse control and build line (navFooter).
                    Rectangle {
                        height: 32px;
                        accessible-role: button;
                        accessible-label: "Collapse";
                        HorizontalLayout {
                            padding-left: 8px;
                            spacing: 8px;
                            Image { source: @image-url("@medbrains-gui-kit/icons/layout-sidebar-left-collapse.svg"); width: 18px; height: 18px; y: 7px; colorize: Tokens.color-content-on-surface-variant; }
                            Text { text: "Collapse"; font-family: Metrics.font; font-size: Tokens.font-xs; color: Tokens.color-content-on-surface-variant; vertical-alignment: center; }
                        }
                    }
                    Text { text: "native preview · Slint 1.18"; font-family: Metrics.mono; font-size: Tokens.font-xs; color: Tokens.color-content-on-surface-variant; height: 24px; vertical-alignment: center; }
                }
                Rectangle { x: parent.width - 1px; width: 1px; background: Tokens.color-outline-outline-variant; }
            }
            // Main area (AppShell.Main): 16 px padding over the dot grid; breadcrumb above the screen.
            Rectangle {
                horizontal-stretch: 1;
                clip: true;
                Image {
                    x: 0; y: 0;
                    width: parent.width;
                    height: parent.height;
                    source: @image-url("@medbrains-gui-kit/patterns/dot-grid.svg");
                    horizontal-tiling: repeat;
                    vertical-tiling: repeat;
                    colorize: Tokens.color-outline-outline-variant;
                }
                ScrollView {
                    VerticalLayout {
                        alignment: start;
                        padding: 16px;
                        spacing: 0px;
                        Text { text: Shell.crumb; font-family: Metrics.font; font-size: Tokens.font-sm; color: Tokens.color-content-on-surface; height: 26px; vertical-alignment: top; }
${body.join("\n")}
                    }
                }
            }
        }
    }
}
`;
  return { text, icons, available, total };
}

function main(argv) {
  const webSrc = path.resolve(flag(argv, "--web") ?? "apps/web/src");
  const outDir = path.resolve(flag(argv, "--out") ?? ".");
  const okFile = flag(argv, "--ok");
  const compiling = okFile ? new Set(fs.readFileSync(okFile, "utf8").split("\n").filter(Boolean).map((f) => path.resolve(f))) : null;
  const { text, icons } = appShell({ webSrc, outDir, compiling });
  const tabler = flag(argv, "--tabler") ?? path.resolve(webSrc, "../../../node_modules/@tabler/icons");
  if (fs.existsSync(tabler)) writeIcons(icons, tabler, path.join(KIT_DIR, "icons"));
  fs.writeFileSync(path.join(outDir, "app.slint"), text);
  fs.mkdirSync(path.join(outDir, "brand"), { recursive: true });
  fs.copyFileSync(path.join(webSrc, "../public/logo/medbrains-mark.svg"), path.join(outDir, "brand/medbrains-mark.svg"));
  process.stdout.write(`${text.split("\n")[1]}\n`);
  return 0;
}

if (path.resolve(process.argv[1] ?? "") === path.resolve(new URL(import.meta.url).pathname)) {
  process.exit(main(process.argv.slice(2)));
}
