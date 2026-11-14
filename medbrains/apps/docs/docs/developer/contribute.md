---
title: Contribute to MedBrains
sidebar_position: 4
description: "How to contribute to MedBrains: feature branches, a signed contributor licence agreement, one change per pull request with its screen and tests, and decisions."
---

# Contribute

You do not have to write code to help: clinicians telling us where a workflow
is wrong is the most valuable help of all. For code:

1. **Open an issue first** for anything bigger than a small fix, and agree the
   approach.
2. **Branch from `main`:** `feature/<name>` or `fix/<name>`. Never commit to
   `main` directly.
3. **Sign the contributor licence agreement** (`CLA.md` in the repository)
   when the CLA bot asks on your first pull request. Outside pull requests
   merge only after it is signed; until then, open an issue.
4. **One change per pull request,** with its screen, its API and its tests
   together. A backend change ships its UI.
5. **Define permissions first,** in Rust. See
   [permissions](/developer/reference/permissions/).
6. **Document as you go:** every function gets a doc comment, and every
   decision a row in `medbrains/docs/DECISIONS.md` in the same PR.
7. **Write docs to the style guide:**
   [`STYLE.md`](https://github.com/medbrains/medbrains/blob/main/medbrains/apps/docs/STYLE.md)
   covers page types, steps, callouts, terms and the review checklist.
8. **Make the checks pass** and say in the PR what changed, why, and how you
   checked it. Link the issue with `Closes #123`.

:::danger Never commit real patient data
Use only synthetic data in code, tests, seeds, screenshots and issues.
:::

The full rules are in
[`CONTRIBUTING.md`](https://github.com/medbrains/medbrains/blob/main/CONTRIBUTING.md)
and [`ENGINEERING.md`](https://github.com/medbrains/medbrains/blob/main/ENGINEERING.md).
