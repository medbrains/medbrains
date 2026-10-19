// The user guide. Built into the web app's dist at /help, so the server
// that serves the app serves the guide — no second host, works offline.

/** @type {import('@docusaurus/types').Config} */
module.exports = {
  title: "MedBrains Help",
  tagline: "How to do your work in MedBrains",
  favicon: "img/favicon.svg",
  url: "https://medbrains.local",
  baseUrl: "/help/",
  // Every page is a folder's index.html: the app's static server serves
  // those as they are, where a slash-less path falls through to the SPA.
  trailingSlash: true,
  onBrokenLinks: "throw",
  markdown: { hooks: { onBrokenMarkdownLinks: "throw" } },
  i18n: { defaultLocale: "en", locales: ["en"] },
  presets: [
    [
      "classic",
      {
        docs: { routeBasePath: "/", sidebarPath: require.resolve("./sidebars.js") },
        blog: false,
        theme: { customCss: require.resolve("./src/css/custom.css") },
      },
    ],
  ],
  themes: [
    [
      require.resolve("@easyops-cn/docusaurus-search-local"),
      { hashed: true, indexBlog: false, docsRouteBasePath: "/" },
    ],
  ],
  themeConfig: {
    colorMode: { defaultMode: "dark", respectPrefersColorScheme: true },
    navbar: {
      title: "MedBrains Help",
      logo: { alt: "MedBrains", src: "img/favicon.svg" },
      items: [{ href: "pathname:///", label: "Back to MedBrains", position: "right" }],
    },
    footer: { style: "dark", copyright: "MedBrains" },
  },
};
