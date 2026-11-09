// A person whose password a stranger is slowing still signs in with their passkey: Kanidm counts wrong guesses per
// credential. On a set-up debug image, through the front, with Chromium's virtual authenticator as the key.
//
//   OS_WORK=... OS_IDP_PORT=8471 node os/tests/kanidm-passkey-lock.js
const { chromium } = require("playwright-core");
const { execFileSync } = require("node:child_process");
const path = require("node:path");

const PORT = process.env.OS_IDP_PORT || "8471";
const BASE = "https://idm.medbrains.local:9443";
const ADMIN = ["asha_admin", "Blue-River-Walks-At-7!"];
const GUESSES = 30;
const failed = [];

/** Records and prints one result. */
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  ${detail}`);
  if (!ok) failed.push(name);
}

/** Runs Python with the tests' own helpers: `code` sees kanidm_lib as `k`. */
function python(code) {
  return execFileSync("python3", ["-B", "-c", `import kanidm_lib as k\n${code}`], {
    cwd: __dirname,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
  }).toString();
}

/** Signs in on Kanidm's form with the password, choosing it when Kanidm asks how. */
async function passwordSignIn(page) {
  await page.goto(`${BASE}/ui/login`);
  await page.fill("input[name=username]", ADMIN[0]);
  await page.keyboard.press("Enter");
  await page.waitForSelector("input[name=password], input[name=mech]", { state: "attached" });
  const chooser = page.locator("form:has(input[name=mech][value=password]) button");
  if (await chooser.count()) await chooser.first().click();
  await page.waitForSelector("input[name=password]");
  await page.fill("input[name=password]", ADMIN[1]);
  await page.keyboard.press("Enter");
  await page.waitForLoadState("networkidle");
}

/** Adds a passkey on the credentials page with the virtual authenticator, and saves it. */
async function addPasskey(page) {
  await page.goto(`${BASE}/ui/update_credentials`);
  await page.waitForLoadState("networkidle");
  if (await page.$("input[name=password]")) {
    await page.fill("input[name=password]", ADMIN[1]);
    await page.keyboard.press("Enter");
    await page.waitForLoadState("networkidle");
  }
  await page.getByRole("button", { name: /Add Passkey/i }).first().click();
  await page.locator("input[type=text]").first().fill("Locked-out test key");
  await page.getByRole("button", { name: /Add/i }).last().click();
  await page.waitForTimeout(3000);
  const save = page.getByRole("button", { name: /Save Changes|Save|Commit/i }).first();
  if (await save.count()) await save.click();
  await page.waitForLoadState("networkidle");
}

(async () => {
  python("k.limit_opened(True)");
  const browser = await chromium.launch({ args: [`--host-resolver-rules=MAP idm.medbrains.local:9443 127.0.0.1:${PORT}`] });
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: { protocol: "ctap2", transport: "usb", hasResidentKey: true, hasUserVerification: true, isUserVerified: true },
  });
  try {
    await passwordSignIn(page);
    await addPasskey(page);
    const { credentials } = await cdp.send("WebAuthn.getCredentials", { authenticatorId });
    check("the passkey is enrolled", credentials.length > 0, `${credentials.length}`);
    const guessed = python(
      `for _ in range(${GUESSES}): k.kanidm_auth("${ADMIN[0]}", "wrong-guess-1", privileged=False)\n` +
        `print("password now:", k.kanidm_auth("${ADMIN[0]}", "${ADMIN[1]}", privileged=False)[1])`,
    );
    check("after the guesses, the right password is slowed", guessed.includes("temporarily locked"), guessed.trim().slice(-80));
    await ctx.clearCookies();
    await page.goto(`${BASE}/ui/login`);
    await page.fill("input[name=username]", ADMIN[0]);
    await page.keyboard.press("Enter");
    await page.waitForSelector("input[name=mech]", { state: "attached" });
    await page.locator("form:has(input[name=mech][value=passkey]) button").first().click();
    await page.waitForTimeout(4000);
    check("the passkey still signs in at once", page.url().includes("/ui/apps"), page.url());
  } catch (error) {
    check("the run finished", false, String(error).split("\n")[0]);
  } finally {
    await browser.close();
    python("k.limit_opened(False)");
  }
  console.log(failed.length ? "FAILED" : "ALL PASSED");
  process.exit(failed.length ? 1 : 0);
})();
