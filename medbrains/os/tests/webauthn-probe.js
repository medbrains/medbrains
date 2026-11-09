// Shows what this browser offers for hardware keys, in big text, for a screenshot of a machine's own screen.
// Copied to /usr/share/kanidm/ui/hpkg/ on a test VM with webauthn-probe.html, so it runs at Kanidm's origin.
const out = document.getElementById("out");

/** Adds one line to the page. */
function say(line) {
  out.textContent += line + "\n";
}

/** Asks every question in order. A failure is reported as an answer, never hidden. */
async function probe() {
  say("userAgent: " + navigator.userAgent);
  say("origin: " + location.origin);
  say("isSecureContext: " + window.isSecureContext);
  say("navigator.credentials: " + typeof navigator.credentials);
  say("PublicKeyCredential: " + typeof window.PublicKeyCredential);
  if (window.PublicKeyCredential) {
    for (const check of ["isUserVerifyingPlatformAuthenticatorAvailable", "isConditionalMediationAvailable"]) {
      try {
        say(check + ": " + (await PublicKeyCredential[check]()));
      } catch (error) {
        say(check + " threw " + error.name + ": " + error.message);
      }
    }
  }
  if (!navigator.credentials) {
    say("RESULT: no WebAuthn API on this screen");
    return;
  }
  try {
    const credential = await navigator.credentials.create({ publicKey: {
      rp: { name: "probe", id: location.hostname },
      user: { id: new Uint8Array(16), name: "probe", displayName: "probe" },
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      pubKeyCredParams: [{ type: "public-key", alg: -7 }],
      timeout: 8000,
    } });
    say("RESULT: create() gave a credential: " + credential.type);
  } catch (error) {
    say("RESULT: create() failed: " + error.name + ": " + error.message);
  }
}

probe().catch((error) => say("RESULT: the probe itself failed: " + error));
