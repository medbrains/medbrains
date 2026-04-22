# Sprint: Foundation (Week 1-2)

> **Goal:** Production-grade infrastructure before feature work
> **Duration:** 10 working days
> **Team:** 2 Backend, 2 Frontend, 1 DevOps, 1 QA

---

## Day 1-2: CI/CD Pipeline

### DevOps Tasks

| Task | Owner | Hours | Priority |
|------|-------|-------|----------|
| GitHub Actions workflow for Rust (cargo check, clippy, test) | DevOps | 4 | P0 |
| GitHub Actions workflow for TypeScript (typecheck, biome, test) | DevOps | 4 | P0 |
| Build artifacts (Docker images) | DevOps | 4 | P0 |
| Staging deployment pipeline | DevOps | 6 | P0 |
| PR checks (block merge if tests fail) | DevOps | 2 | P0 |

**Deliverable:** Every PR runs checks, merge blocked on failure

```yaml
# .github/workflows/ci.yml structure
on: [push, pull_request]
jobs:
  rust:
    - cargo fmt --check
    - cargo clippy -- -D warnings
    - cargo test
  typescript:
    - pnpm typecheck
    - pnpm biome check
    - pnpm test
  build:
    - docker build
```

---

## Day 2-3: Testing Infrastructure

### Backend (Rust) Tests

| Task | Owner | Hours | Files |
|------|-------|-------|-------|
| Test utilities (mock DB, test fixtures) | BE-1 | 4 | `crates/medbrains-server/src/test_utils.rs` |
| Auth route tests (login, logout, me) | BE-1 | 4 | `routes/auth.rs` |
| Patient CRUD tests | BE-1 | 4 | `routes/patients.rs` |
| Encounter flow tests | BE-2 | 4 | `routes/encounters.rs` |
| Billing tests | BE-2 | 4 | `routes/billing.rs` |

```rust
// Test structure example
#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_utils::{setup_test_db, create_test_tenant, create_test_user};

    #[tokio::test]
    async fn test_create_patient() {
        let db = setup_test_db().await;
        let tenant = create_test_tenant(&db).await;
        // ...
    }
}
```

### Frontend Tests

| Task | Owner | Hours | Files |
|------|-------|-------|-------|
| Vitest setup for packages | FE-1 | 2 | `packages/*/vitest.config.ts` |
| Type guard tests (primitives.ts) | FE-1 | 4 | `packages/schemas/src/*.test.ts` |
| Type guard tests (guards.ts) | FE-1 | 4 | `packages/schemas/src/*.test.ts` |
| API client tests (mock fetch) | FE-2 | 4 | `packages/api/src/*.test.ts` |
| Store tests (auth, permissions) | FE-2 | 4 | `packages/stores/src/*.test.ts` |

```typescript
// packages/schemas/src/guards.test.ts
import { describe, it, expect } from 'vitest';
import { isPatient, isPatientCreate } from './guards';

describe('isPatient', () => {
  it('validates complete patient object', () => {
    const valid = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      tenant_id: '550e8400-e29b-41d4-a716-446655440001',
      uhid: 'UHID001',
      // ... all fields
    };
    expect(isPatient(valid)).toBe(true);
  });

  it('rejects missing required fields', () => {
    expect(isPatient({ id: '123' })).toBe(false);
  });

  it('rejects invalid UUID', () => {
    expect(isPatient({ ...validPatient, id: 'not-a-uuid' })).toBe(false);
  });
});
```

---

## Day 3-4: Security Hardening

### Input Validation Audit

| Task | Owner | Hours | Scope |
|------|-------|-------|-------|
| Audit all route handlers for input validation | BE-1 | 6 | All `routes/*.rs` |
| Add validation middleware | BE-1 | 4 | `middleware/validation.rs` |
| Sanitize string inputs (XSS prevention) | BE-2 | 4 | Utility functions |
| Validate UUIDs on all ID parameters | BE-2 | 3 | Route extractors |

```rust
// Example: Validated path extractor
pub struct ValidUuid(pub Uuid);

impl<S> FromRequestParts<S> for ValidUuid {
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let id = parts.extract::<Path<String>>().await?;
        let uuid = Uuid::parse_str(&id.0)
            .map_err(|_| ApiError::BadRequest("Invalid UUID".into()))?;
        Ok(ValidUuid(uuid))
    }
}
```

### Authentication & Authorization

| Task | Owner | Hours |
|------|-------|-------|
| JWT expiry validation | BE-1 | 2 |
| Refresh token implementation | BE-1 | 4 |
| Rate limiting (tower middleware) | BE-2 | 4 |
| Permission check on every protected route | BE-2 | 4 |
| CSRF token validation | BE-2 | 2 |

```rust
// Rate limiting middleware
use tower::limit::RateLimitLayer;
use std::time::Duration;

let rate_limit = RateLimitLayer::new(100, Duration::from_secs(60)); // 100 req/min
```

### Security Checklist

- [ ] All endpoints require authentication (except /health, /auth/login)
- [ ] All tenant-scoped queries use RLS
- [ ] No SQL string concatenation (use parameterized queries)
- [ ] Passwords hashed with Argon2
- [ ] JWT secrets from environment variables
- [ ] HTTPS enforced in production
- [ ] CORS configured properly
- [ ] No sensitive data in logs

---

## Day 4-5: Error Handling

### Structured Error Responses

| Task | Owner | Hours |
|------|-------|-------|
| Define error response schema | BE-1 | 2 |
| Implement error types | BE-1 | 4 |
| Error logging with context | BE-1 | 3 |
| Frontend error handling | FE-1 | 4 |

```rust
// Standardized error response
#[derive(Serialize)]
pub struct ApiErrorResponse {
    pub error: ApiErrorBody,
    pub request_id: String,
}

#[derive(Serialize)]
pub struct ApiErrorBody {
    pub code: String,           // "VALIDATION_ERROR", "NOT_FOUND", etc.
    pub message: String,        // Human readable
    pub details: Option<Value>, // Field-specific errors
}

// Example response:
// {
//   "error": {
//     "code": "VALIDATION_ERROR",
//     "message": "Invalid patient data",
//     "details": {
//       "first_name": "Required field",
//       "date_of_birth": "Invalid date format"
//     }
//   },
//   "request_id": "req_abc123"
// }
```

### Frontend Error Handling

```typescript
// packages/api/src/errors.ts
export class ApiError extends Error {
  constructor(
    public code: string,
    public message: string,
    public status: number,
    public details?: Record<string, string>,
    public requestId?: string,
  ) {
    super(message);
  }
}

// Global error handler in React
export function useApiError() {
  const { showNotification } = useNotifications();

  return (error: ApiError) => {
    if (error.status === 401) {
      // Redirect to login
    } else if (error.status === 403) {
      showNotification({ title: 'Access Denied', color: 'red' });
    } else if (error.status === 422) {
      // Show field errors
    } else {
      showNotification({ title: error.message, color: 'red' });
    }
  };
}
```

---

## Day 5-6: Monitoring & Observability

### Logging

| Task | Owner | Hours |
|------|-------|-------|
| Structured JSON logging (tracing-subscriber) | BE-2 | 3 |
| Request/response logging middleware | BE-2 | 3 |
| Log levels configuration | BE-2 | 1 |
| Frontend error reporting | FE-2 | 3 |

```rust
// Structured logging setup
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

tracing_subscriber::registry()
    .with(tracing_subscriber::fmt::layer().json())
    .with(tracing_subscriber::EnvFilter::from_default_env())
    .init();

// Log format:
// {"timestamp":"2026-04-17T10:00:00Z","level":"INFO","target":"medbrains","message":"Request","method":"POST","path":"/patients","tenant_id":"...","user_id":"...","duration_ms":45}
```

### Metrics (Prometheus)

| Task | Owner | Hours |
|------|-------|-------|
| Add metrics middleware | DevOps | 4 |
| Request duration histogram | DevOps | 2 |
| Request count by endpoint | DevOps | 2 |
| Error rate metrics | DevOps | 2 |
| Grafana dashboard | DevOps | 4 |

```rust
// Prometheus metrics
use metrics::{counter, histogram};
use metrics_exporter_prometheus::PrometheusBuilder;

// In middleware:
histogram!("http_request_duration_seconds", duration, "method" => method, "path" => path);
counter!("http_requests_total", 1, "method" => method, "path" => path, "status" => status);
```

### Health Checks

| Task | Owner | Hours |
|------|-------|-------|
| /health endpoint (basic) | BE-1 | 1 |
| /health/ready (DB, Redis) | BE-1 | 2 |
| /health/live (process) | BE-1 | 1 |

```rust
// Health check response
#[derive(Serialize)]
pub struct HealthResponse {
    pub status: String,      // "healthy" | "degraded" | "unhealthy"
    pub postgres: String,    // "up" | "down"
    pub yottadb: String,     // "up" | "down"
    pub redis: String,       // "up" | "down"
    pub version: String,
    pub uptime_seconds: u64,
}
```

---

## Day 7-8: Database Hardening

### Connection Management

| Task | Owner | Hours |
|------|-------|-------|
| Connection pool tuning | BE-1 | 3 |
| Connection timeout handling | BE-1 | 2 |
| Retry logic for transient failures | BE-1 | 3 |

```rust
// SQLx pool configuration
let pool = PgPoolOptions::new()
    .max_connections(50)
    .min_connections(5)
    .acquire_timeout(Duration::from_secs(5))
    .idle_timeout(Duration::from_secs(300))
    .max_lifetime(Duration::from_secs(1800))
    .connect(&database_url)
    .await?;
```

### Query Performance

| Task | Owner | Hours |
|------|-------|-------|
| Add missing indexes | BE-2 | 4 |
| EXPLAIN ANALYZE slow queries | BE-2 | 4 |
| Query timeout configuration | BE-2 | 2 |

```sql
-- Critical indexes to verify
CREATE INDEX IF NOT EXISTS idx_patients_tenant_uhid ON patients(tenant_id, uhid);
CREATE INDEX IF NOT EXISTS idx_encounters_patient ON encounters(patient_id);
CREATE INDEX IF NOT EXISTS idx_encounters_status ON encounters(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_patient ON invoices(patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_encounter ON lab_orders(encounter_id);
```

### Backup & Recovery

| Task | Owner | Hours |
|------|-------|-------|
| Backup script (pg_dump) | DevOps | 2 |
| Restore procedure documentation | DevOps | 2 |
| Point-in-time recovery setup | DevOps | 4 |
| Backup verification job | DevOps | 2 |

---

## Day 8-9: Audit Trail Completion

### Current: 29% → Target: 60%

| Task | Owner | Hours |
|------|-------|-------|
| Audit middleware (automatic logging) | BE-1 | 6 |
| Patient record access logging | BE-1 | 3 |
| Billing/financial action logging | BE-2 | 3 |
| User management action logging | BE-2 | 3 |
| Audit log query API | BE-2 | 4 |

```rust
// Audit middleware
pub async fn audit_middleware<B>(
    State(state): State<AppState>,
    claims: Claims,
    request: Request<B>,
    next: Next<B>,
) -> Response {
    let method = request.method().clone();
    let path = request.uri().path().to_string();

    let response = next.run(request).await;

    // Log after response
    if method != Method::GET {
        sqlx::query!(
            "INSERT INTO audit_log (tenant_id, user_id, action, entity_type, path, status_code)
             VALUES ($1, $2, $3, $4, $5, $6)",
            claims.tenant_id, claims.user_id, method.as_str(),
            extract_entity(&path), path, response.status().as_u16() as i32
        )
        .execute(&state.db)
        .await
        .ok();
    }

    response
}
```

---

## Day 9-10: Integration & Polish

### E2E Smoke Tests

| Task | Owner | Hours |
|------|-------|-------|
| Login flow test | QA | 2 |
| Patient registration test | QA | 2 |
| OPD visit flow test | QA | 3 |
| Billing flow test | QA | 3 |
| Lab order flow test | QA | 3 |

```typescript
// e2e/smoke/patient-flow.spec.ts
import { test, expect } from '@playwright/test';

test('complete patient registration', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name=username]', 'receptionist');
  await page.fill('[name=password]', 'test123');
  await page.click('button[type=submit]');

  await page.goto('/patients/new');
  await page.fill('[name=first_name]', 'John');
  await page.fill('[name=last_name]', 'Doe');
  // ...
  await page.click('button:has-text("Register")');

  await expect(page.locator('.notification-success')).toBeVisible();
});
```

### Documentation

| Task | Owner | Hours |
|------|-------|-------|
| API documentation (OpenAPI) | BE-1 | 4 |
| Deployment runbook | DevOps | 4 |
| Environment setup guide | DevOps | 2 |

---

## Definition of Done

### Week 1 Exit Criteria
- [ ] CI/CD pipeline running on every PR
- [ ] Backend test coverage > 40% for auth, patients, encounters
- [ ] Frontend test coverage > 60% for type guards
- [ ] Security audit checklist completed
- [ ] Rate limiting enabled

### Week 2 Exit Criteria
- [ ] Structured logging in production format
- [ ] Prometheus metrics exposed
- [ ] Health endpoints working
- [ ] Database indexes verified
- [ ] Backup procedure tested
- [ ] Audit trail covering 60% of write operations
- [ ] 5 E2E smoke tests passing

---

## Daily Standups

| Day | Focus | Blocker Check |
|-----|-------|---------------|
| Mon | CI/CD setup | GitHub permissions |
| Tue | Testing infra | Test DB access |
| Wed | Security audit | Findings review |
| Thu | Error handling | API contract |
| Fri | Monitoring | Grafana access |
| Mon | Database | Migration risks |
| Tue | Audit trail | Schema changes |
| Wed | E2E tests | Test data |
| Thu | Integration | Environment |
| Fri | Review & polish | Blockers |

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| CI/CD takes longer | Medium | High | Start Day 1, parallelize |
| Test DB setup issues | Medium | Medium | Use Docker Compose |
| Security findings | High | High | Allocate buffer time |
| Audit trail complex | Medium | Medium | Start with critical paths |

---

## Sign-off

| Milestone | Owner | Date |
|-----------|-------|------|
| CI/CD Live | DevOps | |
| Security Audit | BE Lead | |
| Tests Green | QA | |
| Monitoring Live | DevOps | |
| Sprint Complete | PM | |
