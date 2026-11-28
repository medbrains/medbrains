/**
 * The release name error reports and uploaded source maps share. A build that
 * names one in MEDBRAINS_RELEASE uses it: a tagged release (`medbrains@3.34.0`,
 * .github/workflows/release.yml) or a deploy's commit
 * (scripts/build-deploy-artifacts.sh). The server reads the same variable
 * (crates/medbrains-error-tracking), so its errors and the browser's land on
 * one release. Without it, the commit the bundle was built from.
 */
export function releaseName(fromEnv: string | undefined, commit: string): string {
  return fromEnv?.trim() || commit;
}
