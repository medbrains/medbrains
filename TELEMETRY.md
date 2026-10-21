# Telemetry and privacy

MedBrains runs inside hospitals and holds patient data. We are strict about what leaves an installation.

## What MedBrains sends to us today

**Nothing.** A MedBrains server makes no calls to the MedBrains project. It talks only to the services a hospital configures itself — for example its payment provider, SMS/email/WhatsApp provider, ABDM/NHCX, or a backup bucket.

## If we add usage telemetry

We would like to know roughly how many hospitals run MedBrains and which versions, so we can support them. If we add an install signal, it will follow these rules — in the code, not just this page:

- **Anonymous and minimal:** a random install ID, the MedBrains version, the deployment type, and at most a coarse country. Never patient data, staff names, hospital names, IP-derived location beyond country, or anything entered into the system.
- **Documented here first,** with the exact payload, before it ships.
- **Easy to switch off:** one setting (`MEDBRAINS_TELEMETRY=off`), shown in the admin screens and the startup checks. Off by default for on-premise and air-gapped installs.
- **Open:** the code that sends it is in this repository for anyone to read — and, under the AGPL, to remove in their own build.

## What we watch instead

- GitHub's repository traffic (clone and visit counts — GitHub shows numbers, not identities).
- Downloads of official releases and container images.
- Public, opt-in "Powered by MedBrains" notices, and hospitals who tell us they run it.

We will never add hidden tracking. A health system that phones home without telling the hospital is a security incident, not a feature.

## Licence compliance

If you run a **modified** MedBrains as a service for others, the AGPL-3.0 requires you to offer those users your source. Organisations that can't do that can buy a [commercial licence](./COMMERCIAL-LICENSE.md). The name and logo are covered separately by our [trademark policy](./TRADEMARKS.md).
