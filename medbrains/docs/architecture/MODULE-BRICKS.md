# Module bricks: every app is a Lego brick on all three layers

Owner direction 2026-11-07: the native Slint apps, the web apps and the backend are built like Lego. Each app in the catalogue (`OS-NATIVE-GUI.md`: Pharmacy, Patient Registration, EMR and the rest) is one **brick**, and a brick has the same shape on every layer.

## What one brick is

| Layer | Part of the brick | Today |
|---|---|---|
| Backend | One crate per module (`medbrains-pharmacy`), its routes, its migrations, its permission module in `permissions.rs` | Mostly true: 163 crates after the server split |
| Web | One package per module (`@medbrains/app-pharmacy`), its routes loaded only when opened | Not yet: 230 entries in one `apps/web/src/pages` folder |
| Native | One Slint app crate (`medbrains-app-pharmacy`) | Starts with G1 |
| Shared by all three | Its manifest: id, name, icon, the permissions it uses, the bricks it depends on, the roles that see it | Partly: the shell's app manifests |
| Proof | One journey file that runs against the web and native versions | Starts with G5 |

## The studs and holes (the only ways bricks connect)

A brick touches the rest of the system only through these, so it can be added, removed or rebuilt alone:

1. **The base plate:** the kernel and shared crates (`medbrains-core`, `medbrains-db`, `medbrains-authz`), the design kit, and the transition layer. Bricks depend on the base plate, never the other way round.
2. **The API** it publishes, described once and generated into web and native clients.
3. **Events** through the outbox, for anything another brick needs to react to.
4. **Opening another brick** by id through the shell or router, for example from a prescription to the patient's EMR. A brick never imports another brick's code on any layer.
5. **Its manifest,** which the Software Center reads to turn it on or off with the bricks it depends on.

## Rules

- **No brick imports another brick, on any layer.** A check fails CI if a module crate, web package or Slint app depends on another module's code (backend, web and native alike).
- **Turning a brick off removes it everywhere:** its routes answer as switched off, its tile and menu entries go, its native app is not started, and nothing else breaks.
- **One brick, one owner of its data:** a brick reads another brick's data through that brick's API or events, never its tables.
- **Each brick is measured alone:** size, memory, start time and test time, so each can be made faster on its own.

## Order

1. Write the manifest format and the dependency list once in Rust (plan task O11), and generate it for the web and the shell.
2. Add the no-cross-imports check, reporting first, then failing CI once the current crossings are listed in the untangle log and fixed.
3. Move web modules into packages one at a time, starting with Pharmacy, alongside its Slint app in G1.
4. Prove a brick can be turned off cleanly, starting with one that has no dependents.

## Permissions decide which bricks fit (owner 2026-11-07)

A brick snaps in or stays out by permissions alone, so nobody installs or removes one by hand:

1. **The brick declares** in its manifest the permission modules it uses (`pharmacy`, `pharmacy_finance`, ...), the bricks it depends on and its version.
2. **A machine gets a brick** when the roles assigned to that machine hold at least one of its permissions, together with the bricks it depends on. A pharmacy edge assigned pharmacy roles gets Pharmacy; EMR does not fit there because those roles hold no EMR permission.
3. **A person sees a brick**, and each item in its side panel, only when they hold its permissions, on top of the machine's set.
4. **Changing roles is the only control:** give a machine or a person a role and the bricks it unlocks snap in; take it away and they go, at the next sync, through the Software Center (O14) and signed updates.
5. **The server still decides every request**, so a brick that is present grants nothing the person's permissions do not.

### Example: a brick installed with only the screens a person may open

Someone holding `pharmacy` and `pharmacy_finance` permissions gets the Pharmacy brick installed whole, and inside it:

- **The side panel lists only the screens their permissions allow**, for example Rx queue, POS, day close and margins. Screens they may not open (an NDPS register or stock transfers without those permissions) are left out of the panel, not shown greyed out, so nobody clicks into a refusal; the server refuses them anyway.
- **Within a screen they may open, each field is shown, masked or hidden by its data class** (`check-field-classes`), the same way on every screen, never decided by the screen itself.
- **Someone with `pharmacy_finance` alone** gets the same brick with only the finance screens in its panel.

## Onboarding picks the bricks (owner 2026-11-07)

Setup asks which apps the hospital needs, and installs only those bricks with the bricks they depend on. A standalone pharmacy picks Pharmacy and gets Pharmacy plus what it needs (Patient Registration for the patient, Billing for its invoices) and nothing else; a full hospital picks more. The same choice:

- **Turns the rest off for the tenant**, through the existing module switches (`disabled_modules` in `/auth/me`, and the server's module entitlement check), so the server refuses an app's routes until it is added, whatever a role holds.
- **Seeds only the roles those apps need**, so the role editor does not offer pharmacy staff a hundred permissions for apps the hospital does not run.
- **Can grow later:** adding an app from the Software Center (O14) installs its brick and dependencies on the machines whose roles fit, with no reinstall.
- **Shows the same everywhere:** web, OS launcher, edge machines and native apps all read the one installed set, then the person's permissions.

## Bricks plug tabs into other bricks' screens (owner 2026-11-07)

Some screens gather work from several apps: the patient record shows EMR, Billing, Lab and Pharmacy tabs. Each of those tabs belongs to its own brick, and is plugged in, never imported:

- **The owning brick declares it** in its manifest, for example EMR: "adds the Case sheet tab to `patient.record`", with the permission that tab needs.
- **The host screen offers named slots** (`patient.record` tabs, `patient.record` side panels) and shows whatever is plugged into them, in a declared order. It imports none of them.
- **A tab appears only when** its brick is installed for the tenant and the machine, and the person holds its permission. A pharmacy-only hospital never sees an EMR tab; a front-desk clerk without EMR permission does not either.
- **Removing a brick removes its tabs everywhere**, so nothing points at an app that is not there.
