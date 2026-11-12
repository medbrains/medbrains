# Hospital network details and partner documents

**Rule:** what we learn about a hospital's network and systems lives only in encrypted,
need-to-know storage. Never in this repository, its issues or pull requests, chat, email
threads, shared drives or AI tools. This binds the team and every partner and implementer.

**Why:** in 2025 attackers took Red Hat's consulting GitLab and with it the reports written for
customers: network diagrams, hostnames, credentials, configuration. Each report was a ready map
for attacking that customer. We install into hospitals; a leaked site map is a map to a ward.
This repository is public, so anything committed is published for good.

## What this covers

| Covered (keep it out of shared tools) | Not covered (fine in the repo) |
|---|---|
| A site's IP addresses, subnets, VLANs, hostnames, domain names, Wi-Fi names | Example addresses from RFC 5737 (`192.0.2.x`, `198.51.100.x`, `203.0.113.x`) and names from RFC 2606 (`hospital.example`) |
| Network diagrams, firewall rules, VPN details, device inventories with serials | Generic defaults we ship (`medbrains.local`, the dev compose network) |
| Credentials, recovery keys, licence files, backups and exports | Design documents that describe no one site |
| Install, audit and pen-test reports about one hospital | Anonymised lessons ("a site had X"), with the owner's review |
| The customer's name tied to any of the above | The customer's name alone, where they have agreed to be named |

## Where it lives

1. **One encrypted store, per customer.** A vault the owner controls (for example a password
   manager vault or an age-encrypted folder), one folder per hospital, opened only for the people
   working on that hospital, and closed again when they finish. Encrypted at rest with a key not
   held by the storage provider.
2. **Need to know.** Access is granted per hospital and per job, written down (who, which site,
   until when), and reviewed every quarter. Leaving the project, or the job ending, removes it the
   same day.
3. **Nothing in shared tools.** An issue, pull request, commit message, chat thread or AI prompt
   says "site A" and links to nothing private. Screenshots are cropped or blurred before they leave
   the hospital.
4. **On the way in and out.** Reports go to the hospital through the encrypted store or an
   encrypted file, never as a plain email attachment. Nothing is kept longer than the contract
   needs; then it is deleted, and the deletion recorded.
5. **A leak is an incident.** Anything covered found in a shared tool is removed, the hospital is
   told, and any credential in it is rotated, following `SECURITY-RELEASE-PROCESS.md`. A
   commit that reached GitHub counts as published even after removal.

## What CI enforces

`medbrains/scripts/check_secrets.py` (`make check-secrets`, CI "Audit checks") fails a change that adds:

- a private IPv4 address (10/8, 172.16/12, 192.168/16, 100.64/10) or a hostname on an internal
  suffix (`.local`, `.lan`, `.internal`, `.corp`, `.intranet`, `.home.arpa`) that is not already in
  the baseline `medbrains/scripts/.network_identifiers_baseline.json`;
- a customer name listed in the `MEDBRAINS_CUSTOMER_NAMES` CI secret (one per line). The list
  itself is never committed, and the log names only the file and the list entry number. Paths are
  checked as well as contents (spaces, hyphens, underscores and dots between words count alike), and
  a path that matched is never printed. Without the secret the check says "customer list not set,
  name check skipped"; on a push to `main` a missing list fails.

The baseline holds today's legitimate examples: placeholder addresses in setup screens and tests
(`192.168.1.20`), QEMU's user network (`10.0.2.2`, `10.0.2.15`), VPC ranges in Terraform,
`medbrains.local` and its subdomains. Adding to it needs a reviewer to confirm the new entry is an
example, not a site. New examples should use the RFC 5737 and RFC 2606 values, which are never
flagged. The check cannot see a public IP or a public hostname that belongs to a hospital: review
still matters.

## Partners and implementers

Every implementer, partner or contractor agreement carries this clause, in substance:

> The Partner keeps all information about a Customer's network, systems, configuration and
> credentials ("Site Information") only in encrypted storage, accessible to named staff who need
> it for that Customer's work. The Partner never puts Site Information in public or shared tools,
> including code repositories, issue trackers, chat, shared drives or AI services not approved in
> writing by the Customer. The Partner reports any suspected exposure of Site Information to
> MedBrains and the Customer within 24 hours, and deletes Site Information when the engagement
> ends, confirming the deletion in writing.

The wording above is a plain-language draft. The signed text is the owner's, with legal review.
