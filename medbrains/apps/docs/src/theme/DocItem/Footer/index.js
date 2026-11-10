import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import { useDoc } from "@docusaurus/plugin-content-docs/client";
import Footer from "@theme-original/DocItem/Footer";

const ISSUES = "https://github.com/medbrains/medbrains/issues/new";

/** The stock doc footer (Edit this page) plus the two feedback links. */
export default function FooterWithFeedback(props) {
  const { metadata } = useDoc();
  const { siteConfig } = useDocusaurusContext();
  const page = encodeURIComponent(siteConfig.url + metadata.permalink);
  return (
    <>
      <Footer {...props} />
      <aside aria-label="Feedback" className="mb-feedback">
        <a href={`${ISSUES}?template=docs_issue.yml&page=${page}`}>Report a problem with this page</a>
        <a href={`${ISSUES}?template=hospital_feedback.yml`}>Feedback from a hospital</a>
        <p>Never include real patient data.</p>
      </aside>
    </>
  );
}
