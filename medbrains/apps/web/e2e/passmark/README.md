# Passmark — AI-driven regression tests

[Passmark](https://github.com/bug0inc/passmark) layers natural-language, self-healing
regression tests on top of Playwright. A test describes a **user flow** in plain English;
passmark drives the browser via an LLM and validates the result. It complements — does not
replace — the deterministic Playwright specs in the sibling `e2e/` folders.

## ⚠️ Data policy (mandatory)

Passmark sends the **rendered page** to an external LLM (Anthropic / Google). MedBrains is a
hospital system: **only ever run these against synthetic / de-identified data**, never against
production or any environment holding real patient data (PHI). The seeded dev tenant is
synthetic — that is the only supported target.

## Why it is off by default

These specs make **paid external AI calls** and are **non-deterministic**, so they must never run
in the normal test/CI gate. Every passmark spec is skipped unless **both** are set:

- `PASSMARK_ENABLED=1`
- `ANTHROPIC_API_KEY` (and `GOOGLE_GENERATIVE_AI_API_KEY` for the consensus arbiter)

`pnpm test:e2e` and CI therefore ignore them entirely.

## Running

```bash
export PASSMARK_ENABLED=1
export ANTHROPIC_API_KEY=sk-ant-...
export GOOGLE_GENERATIVE_AI_API_KEY=AIza...
# app + backend must be up (see the main e2e README); synthetic dev tenant only.
pnpm --filter @medbrains/web test:passmark
```

`REDIS_URL` is optional (enables passmark's step cache / auto-heal); a single run works without it.

## Guardrails for authoring specs

- Guard every spec with the `passmarkEnabled()` helper (`./guard`) so it self-skips.
- Reuse `ensureAuthenticated(page)` from `../helpers` for login.
- Describe flows against synthetic patients only — never embed real identifiers.
- Keep to dev/test as a **devDependency**; passmark is never bundled into the product.
