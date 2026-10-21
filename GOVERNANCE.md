# Governance

MedBrains is an open-source project led by its founder and maintainers, with the source available under the AGPL-3.0 (or a commercial licence) and the name and logo protected as trademarks.

## Who decides

- **Maintainers** review and merge changes, triage issues and shape the roadmap. Today the maintainer is the founder, [@DomnicAmalan](https://github.com/DomnicAmalan); more maintainers are added as people make sustained, high-quality contributions.
- **Code owners** ([.github/CODEOWNERS](./.github/CODEOWNERS)) must approve changes to sensitive areas: authorisation and permissions, database migrations, payments and billing, clinical and pharmacy logic, infrastructure, and the licence files.
- When maintainers disagree, the founder decides. Decisions that change architecture or clinical behaviour are written up as an RFC in [`RFCs/`](./RFCs) first.

## How a contribution is accepted

1. **Ideas start in [Discussions](https://github.com/medbrains/medbrains/discussions/categories/ideas).** Describe the real hospital scenario. Agreed ideas become issues with acceptance criteria and land on the [roadmap](./ROADMAP.md).
2. **Small fixes go straight to a pull request**; anything larger than a day's work starts as an issue so effort isn't wasted.
3. **Every pull request:**
   - comes from a fork or a feature branch — nobody pushes to `main` directly, maintainers included;
   - is signed off under the [Developer Certificate of Origin](https://developercertificate.org/) (`git commit -s`) and accepts the [CLA](./CLA.md) on the first contribution;
   - passes the checks in [CONTRIBUTING.md](./CONTRIBUTING.md) and gets an approving review from a code owner for sensitive paths;
   - is squash-merged, so `main` stays a clean, linear history.
4. **Clinical changes** need a clinician's review (label `clinical-review`) and must name the rule or standard they follow.

## What protects the project

- **Licence:** AGPL-3.0 — anyone running a modified MedBrains as a network service must share their changes; organisations that can't, buy a [commercial licence](./COMMERCIAL-LICENSE.md).
- **Contributor agreement:** the [CLA](./CLA.md) lets the project offer both licences while contributors keep their copyright.
- **Trademarks:** the name and logo are ours ([TRADEMARKS.md](./TRADEMARKS.md)); forks must use a different name.
- **Branch protection on `main`:** no direct pushes, no force-pushes or deletion, linear history, reviewed pull requests only.
- **Security:** private vulnerability reporting ([SECURITY.md](./SECURITY.md)), secret scanning with push protection, and Dependabot alerts.
- **Patient data:** never in issues, pull requests, tests or fixtures — synthetic data only.
- **Telemetry:** none today; any future usage signal is anonymous, documented and switchable off ([TELEMETRY.md](./TELEMETRY.md)).

## Code of conduct

Everyone in the project follows the [Code of Conduct](./CODE_OF_CONDUCT.md). Report concerns to hello@medbrains.in.
