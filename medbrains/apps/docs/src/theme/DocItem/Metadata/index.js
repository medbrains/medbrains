import Head from "@docusaurus/Head";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import { useDoc } from "@docusaurus/plugin-content-docs/client";
import Metadata from "@theme-original/DocItem/Metadata";

/**
 * The stock page metadata plus a schema.org TechArticle, so search engines
 * read each guide page as a dated, titled technical article. The theme
 * already emits BreadcrumbList from the breadcrumbs.
 */
export default function MetadataWithArticle(props) {
  const { metadata } = useDoc();
  const { siteConfig } = useDocusaurusContext();
  const article = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: metadata.title,
    description: metadata.description,
    url: siteConfig.url + metadata.permalink,
    inLanguage: "en",
    publisher: { "@type": "Organization", name: "MedBrains", url: "https://medbrains.in" },
  };
  return (
    <>
      <Metadata {...props} />
      <Head>
        <script type="application/ld+json">{JSON.stringify(article)}</script>
      </Head>
    </>
  );
}
