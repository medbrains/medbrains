// The MedBrains documentation. One build serves two places:
// - inside the app at /help (the default), so the guide works offline on a
//   hospital's own server;
// - publicly at https://docs.medbrains.in, built with DOCS_BASE_URL=/.

const SITE_URL = "https://docs.medbrains.in";
const FEEDBACK_URL = "https://github.com/medbrains/medbrains/issues/new?template=hospital_feedback.yml";
const baseUrl = process.env.DOCS_BASE_URL ?? "/help/";


/** @type {import('@docusaurus/types').Config} */
module.exports = {
  title: "MedBrains Docs",
  tagline: "How to set up, use and run MedBrains hospital software",
  favicon: "img/favicon.svg",
  url: SITE_URL,
  baseUrl,
  // Every page is a folder's index.html: the app's static server serves
  // those as they are, where a slash-less path falls through to the SPA.
  trailingSlash: true,
  onBrokenLinks: "throw",
  onBrokenAnchors: "throw",
  markdown: { hooks: { onBrokenMarkdownLinks: "throw" } },
  i18n: { defaultLocale: "en", locales: ["en"] },
  presets: [
    [
      "classic",
      {
        docs: {
          routeBasePath: "/",
          sidebarPath: require.resolve("./sidebars.js"),
          editUrl: "https://github.com/medbrains/medbrains/edit/main/medbrains/apps/docs/",
          beforeDefaultRemarkPlugins: [require("./src/remark/figure-captions")],
          remarkPlugins: [require("./src/remark/figure-captions").eagerFirstImage],
        },
        blog: false,
        sitemap: { lastmod: "date", changefreq: "weekly", priority: 0.5, ignorePatterns: ["/search/**", "/help/search/**"] },
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
    image: "img/social-card.png",
    metadata: [
      { name: "twitter:card", content: "summary_large_image" },
      { name: "keywords", content: "hospital operating system, hospital management software, HMS, EMR, open source, FHIR, regulatory compliance" },
    ],
    colorMode: { defaultMode: "dark", respectPrefersColorScheme: true },
    navbar: {
      title: "MedBrains Docs",
      logo: { alt: "MedBrains", src: "img/favicon.svg" },
      items: [
        { to: "/get-started/", label: "Get started", position: "left" },
        { to: "/user-guides/", label: "User guides", position: "left" },
        { to: "/admin/", label: "Admin", position: "left" },
        { to: "/compliance/", label: "Compliance", position: "left" },
        { to: "/developer/", label: "Developers", position: "left" },
        { to: "/release-notes/", label: "Release notes", position: "left" },
        { href: "https://github.com/medbrains/medbrains", label: "GitHub", position: "right" },
      ],
    },
    footer: {
      style: "dark",
      links: [
        { label: "Website", href: "https://medbrains.in" },
        { label: "Source code", href: "https://github.com/medbrains/medbrains" },
        { label: "Feedback from a hospital", href: FEEDBACK_URL },
      ],
      copyright: "MedBrains · Apache License 2.0 · Never include real patient data in an issue or feedback.",
    },
  },
};
