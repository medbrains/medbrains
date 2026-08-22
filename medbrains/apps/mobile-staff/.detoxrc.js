/**
 * Detox for the staff app.
 *
 * Everything that is not specific to this app — the pinned devices, the build
 * commands, the mkcert root, the cold-start budget — lives in
 * `@medbrains/e2e-mobile/config`, so the seven device apps cannot drift apart
 * one bug fix at a time. Three facts belong here: the scheme, and which
 * surfaces this app is built for.
 */
const { detoxConfig } = require("@medbrains/e2e-mobile/config");

module.exports = detoxConfig({
  scheme: "MedBrainsStaff",
  surfaces: ["phone", "tablet"],
});
