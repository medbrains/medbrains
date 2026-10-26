/** The implementation guide a FHIR CapabilityStatement declares, as `ndhm.in 6.5.0`. */
export function fhirGuide(statement: unknown): string | null {
  if (typeof statement !== "object" || statement === null) return null;
  const guides = (statement as { implementationGuide?: unknown }).implementationGuide;
  const guide = Array.isArray(guides) ? guides[0] : undefined;
  if (typeof guide !== "string" || guide.trim() === "") return null;
  const [url = guide, version] = guide.split("|");
  const name = url.split("/").pop() || url;
  return version ? `${name} ${version}` : name;
}
