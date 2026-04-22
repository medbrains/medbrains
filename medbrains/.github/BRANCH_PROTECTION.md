# Branch Protection Rules

Configure these rules in GitHub repository settings under **Settings > Branches > Branch protection rules**.

## Main Branch (`main` / `master`)

### Required Settings

| Setting | Value | Notes |
|---------|-------|-------|
| **Require a pull request before merging** | Yes | All changes via PR |
| **Required approvals** | 1 (minimum) | 2 recommended for prod |
| **Dismiss stale approvals** | Yes | Re-review after changes |
| **Require review from code owners** | Yes | If CODEOWNERS exists |
| **Require status checks to pass** | Yes | Block on failures |
| **Require branches to be up to date** | Yes | Force rebase/merge |
| **Require conversation resolution** | Yes | All comments resolved |
| **Require signed commits** | Optional | Recommended for compliance |
| **Include administrators** | Yes | No bypass for admins |
| **Restrict pushes** | Yes | Only via PR |
| **Allow force pushes** | No | Never on main |
| **Allow deletions** | No | Protect main branch |

### Required Status Checks

Add these checks to **"Require status checks to pass"**:

```
CI Success                 # Final aggregated check
Rust Format               # cargo fmt
Rust Clippy               # cargo clippy
Rust Tests                # cargo test
TypeScript Lint (Biome)   # pnpm lint
TypeScript Type Check     # pnpm typecheck
TypeScript Tests          # pnpm test
TypeScript Build          # pnpm build
```

### Optional Security Checks

```
Cargo Audit               # Rust vulnerability scan
Cargo Deny                # License + vulnerability
NPM Audit                 # JS vulnerability scan
Secrets Scan              # TruffleHog
Dependency Review         # New dependency analysis
```

---

## Develop Branch (`develop`)

Slightly relaxed for faster iteration:

| Setting | Value |
|---------|-------|
| **Require a pull request** | Yes |
| **Required approvals** | 1 |
| **Require status checks** | Yes (all CI checks) |
| **Include administrators** | No (allows quick fixes) |
| **Allow force pushes** | No |
| **Allow deletions** | No |

---

## Feature Branches (`feature/*`, `fix/*`, `chore/*`)

No protection rules — developers can push freely.

---

## Release Branches (`release/*`)

| Setting | Value |
|---------|-------|
| **Require a pull request** | Yes |
| **Required approvals** | 2 |
| **Require status checks** | Yes (all checks) |
| **Include administrators** | Yes |
| **Allow force pushes** | No |

---

## CODEOWNERS Setup

Create `.github/CODEOWNERS`:

```
# Default owner for everything
*                       @medbrains/core-team

# Backend (Rust)
/crates/                @medbrains/backend
*.rs                    @medbrains/backend
Cargo.toml              @medbrains/backend
Cargo.lock              @medbrains/backend

# Frontend (TypeScript/React)
/apps/web/              @medbrains/frontend
/packages/              @medbrains/frontend
*.ts                    @medbrains/frontend
*.tsx                   @medbrains/frontend
package.json            @medbrains/frontend

# Mobile
/apps/mobile/           @medbrains/mobile
/apps/tv/               @medbrains/mobile

# Database/Migrations
/crates/medbrains-db/   @medbrains/backend @medbrains/dba
*.sql                   @medbrains/dba

# Infrastructure
/.github/               @medbrains/devops
docker-compose.yml      @medbrains/devops
Dockerfile              @medbrains/devops

# Security-sensitive
/crates/medbrains-server/src/routes/auth.rs    @medbrains/security
```

---

## GitHub CLI Setup

Apply rules via `gh` CLI:

```bash
# Create branch protection rule for main
gh api repos/{owner}/{repo}/branches/main/protection \
  -X PUT \
  -H "Accept: application/vnd.github+json" \
  -f required_status_checks='{"strict":true,"contexts":["CI Success"]}' \
  -f enforce_admins=true \
  -f required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true}' \
  -f restrictions=null \
  -f allow_force_pushes=false \
  -f allow_deletions=false
```

---

## Rulesets (GitHub Enterprise)

For GitHub Enterprise, use **Repository Rulesets** for more granular control:

1. Go to **Settings > Rules > Rulesets**
2. Create ruleset with name `production-protection`
3. Target: `Default branch`
4. Add rules:
   - Restrict deletions
   - Restrict force pushes
   - Require pull request
   - Require status checks
   - Require signed commits (if needed)

---

## Verification

Test your protection rules:

```bash
# Should fail - direct push to main
git push origin main
# Error: protected branch

# Should fail - force push
git push --force origin main
# Error: force push not allowed

# Should work - push to feature branch
git push origin feature/my-feature
# Success

# Create PR and verify checks run
gh pr create --base main --head feature/my-feature
```
