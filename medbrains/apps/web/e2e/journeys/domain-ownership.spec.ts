/**
 * An administrator sets up the hospital's own domain. The page shows the
 * TXT record that proves they control it; verifying before the record exists
 * says what is missing, and the domain stays unproven — no sign-in routing,
 * no certificate.
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { api } from "../helpers/api";
import { expect, test } from "./support/world";

const COMPOSE_DIR = fileURLToPath(new URL("../../../../", import.meta.url));

function sql(statement: string): void {
  execFileSync("docker", ["compose", "exec", "-T", "postgres", "psql", "-U", "medbrains", "-d", "medbrains", "-c", statement], {
    cwd: COMPOSE_DIR,
    encoding: "utf8",
  });
}

test("an unproven domain shows its TXT record and is not trusted yet", async ({ hospital }) => {
  test.setTimeout(90_000);
  const tenant = await api<{ id: string; custom_domain: string | null }>(hospital.admin, "GET", "/api/setup/tenant");
  const previous = tenant.custom_domain ?? "";
  if (!/^[a-z0-9.-]*$/.test(previous) || !/^[0-9a-f-]{36}$/.test(tenant.id)) throw new Error("unexpected tenant");
  const domain = `hms-${Date.now().toString(36)}.example-hospital.in`;
  await api(hospital.admin, "PUT", "/api/setup/tenant", { custom_domain: domain });
  try {
    const page = await hospital.asAdmin();
    await page.goto("/setup/domains-email");
    const card = page.getByTestId("domain-ownership");
    await expect(card).toContainText(`Prove you own ${domain}`);
    await expect(card).toContainText("Not proven yet");
    await expect(card).toContainText(`_medbrains-verify.${domain}`);
    await card.getByRole("button", { name: "Verify" }).click();
    await expect(card).toContainText("No TXT record at");
    await expect(card).toContainText("Not proven yet");
    const tls = await fetch(`http://127.0.0.1:3000/api/tls/allow?domain=${domain}`);
    expect(tls.status).toBe(404);
  } finally {
    // Put the hospital's own (proven) domain back exactly as it was.
    sql(
      `UPDATE tenants SET custom_domain = NULLIF('${previous}', ''), custom_domain_verified_at = CASE WHEN '${previous}' = '' THEN NULL ELSE now() END WHERE id = '${tenant.id}'`,
    );
  }
});
