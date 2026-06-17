# TV Displays & Queue — stories

_Auto-generated from `MedBrains_Features.xlsx` — every feature as a story with module-tailored acceptance criteria. 128 stories (✅ = Done). Source of truth is the xlsx; regenerate via `python3 scripts/generate_stories.py`._

## Billing & Analytics

### ✅ Queue display at billing counter area
> As a **front-desk/display operator**, I want **queue display at billing counter area**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 I/J`

**Acceptance criteria**
- [x] The front-desk/display operator can queue display at billing counter area from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Token generated at billing counter or on discharge initiation
> As a **front-desk/display operator**, I want **token generated at billing counter or on discharge initiation**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 I/J`

**Acceptance criteria**
- [x] The front-desk/display operator can token generated at billing counter or on discharge initiation from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Billing display: Token | Counter | Status
> As a **front-desk/display operator**, I want **billing display: token | counter | status**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 I/J`

**Acceptance criteria**
- [x] The front-desk/display operator can billing display: Token | Counter | Status from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Separate queues: OPD billing, IPD discharge, Advance deposit, Insurance desk
> As a **front-desk/display operator**, I want **separate queues: opd billing, ipd discharge, advance deposit, insurance desk**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 I/J`

**Acceptance criteria**
- [x] The front-desk/display operator can separate queues: OPD billing, IPD discharge, Advance deposit, Insurance desk from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Audio call for billing token
> As a **front-desk/display operator**, I want **audio call for billing token**.

`Partial · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 I/J`

**Acceptance criteria**
- [ ] The front-desk/display operator can audio call for billing token from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Estimated wait time at billing
> As a **front-desk/display operator**, I want **estimated wait time at billing**.

`Pending · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 I/J`

**Acceptance criteria**
- [ ] The front-desk/display operator can estimated wait time at billing from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Centralized queue management dashboard (admin sees ALL queues)
> As a **front-desk/display operator**, I want **centralized queue management dashboard (admin sees all queues)**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 I/J`

**Acceptance criteria**
- [x] The front-desk/display operator can centralized queue management dashboard (admin sees ALL queues) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Real-time patient flow heatmap (congestion areas)
> As a **front-desk/display operator**, I want **real-time patient flow heatmap (congestion areas)**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 I/J`

**Acceptance criteria**
- [x] The front-desk/display operator can real-time patient flow heatmap (congestion areas) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Average wait time per dept/doctor/hour — trending
> As a **front-desk/display operator**, I want **average wait time per dept/doctor/hour — trending**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 I/J`

**Acceptance criteria**
- [x] The front-desk/display operator can average wait time per dept/doctor/hour — trending from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Peak hour identification (staffing optimization)
> As a **front-desk/display operator**, I want **peak hour identification (staffing optimization)**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 I/J`

**Acceptance criteria**
- [x] The front-desk/display operator can peak hour identification (staffing optimization) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Bottleneck detection (longest average wait)
> As a **front-desk/display operator**, I want **bottleneck detection (longest average wait)**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 I/J`

**Acceptance criteria**
- [x] The front-desk/display operator can bottleneck detection (longest average wait) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Patient throughput per hour per department
> As a **front-desk/display operator**, I want **patient throughput per hour per department**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 I/J`

**Acceptance criteria**
- [x] The front-desk/display operator can patient throughput per hour per department from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Queue abandonment tracking (token taken but left unseen)
> As a **front-desk/display operator**, I want **queue abandonment tracking (token taken but left unseen)**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 I/J`

**Acceptance criteria**
- [x] The front-desk/display operator can queue abandonment tracking (token taken but left unseen) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ SLA monitoring (% patients seen within target wait)
> As a **front-desk/display operator**, I want **sla monitoring (% patients seen within target wait)**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 I/J`

**Acceptance criteria**
- [x] The front-desk/display operator can sLA monitoring (% patients seen within target wait) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Daily/weekly/monthly queue performance reports
> As a **front-desk/display operator**, I want **daily/weekly/monthly queue performance reports**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 I/J`

**Acceptance criteria**
- [x] The front-desk/display operator can daily/weekly/monthly queue performance reports from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Doctor-wise patient load balancing suggestion
> As a **front-desk/display operator**, I want **doctor-wise patient load balancing suggestion**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 I/J`

**Acceptance criteria**
- [x] The front-desk/display operator can doctor-wise patient load balancing suggestion from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Doctor Room Display

### Small TV/tablet outside consultation room showing current + next token
> As a **front-desk/display operator**, I want **small tv/tablet outside consultation room showing current + next token**.

`Partial · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 C`

**Acceptance criteria**
- [ ] The front-desk/display operator can small TV/tablet outside consultation room showing current + next token from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Display: Current Token | Patient Name | 'Please Enter'
> As a **front-desk/display operator**, I want **display: current token | patient name | 'please enter'**.

`Partial · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 C`

**Acceptance criteria**
- [ ] The front-desk/display operator can display: Current Token | Patient Name | 'Please Enter' from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Next 2-3 tokens displayed below ('Please Wait')
> As a **front-desk/display operator**, I want **next 2-3 tokens displayed below ('please wait')**.

`Partial · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 C`

**Acceptance criteria**
- [ ] The front-desk/display operator can next 2-3 tokens displayed below ('Please Wait') from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Doctor controls: Call Next, Recall, Skip, Hold, Transfer
> As a **front-desk/display operator**, I want **doctor controls: call next, recall, skip, hold, transfer**.

`Partial · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 C`

**Acceptance criteria**
- [ ] The front-desk/display operator can doctor controls: Call Next, Recall, Skip, Hold, Transfer from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Audio announcement: 'Token [X], proceed to Room [Y]' (configurable voice/language)
> As a **front-desk/display operator**, I want **audio announcement: 'token [x], proceed to room [y]' (configurable voice/language)**.

`Partial · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 C`

**Acceptance criteria**
- [ ] The front-desk/display operator can audio announcement: 'Token [X], proceed to Room [Y]' (configurable voice/language) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Audio plays on waiting area speakers + TV
> As a **front-desk/display operator**, I want **audio plays on waiting area speakers + tv**.

`Pending · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 C`

**Acceptance criteria**
- [ ] The front-desk/display operator can audio plays on waiting area speakers + TV from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Repeat announcement button (patient doesn't respond in time)
> As a **front-desk/display operator**, I want **repeat announcement button (patient doesn't respond in time)**.

`Pending · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 C`

**Acceptance criteria**
- [ ] The front-desk/display operator can repeat announcement button (patient doesn't respond in time) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Doctor can call specific token out of sequence (VIP, critical)
> As a **front-desk/display operator**, I want **doctor can call specific token out of sequence (vip, critical)**.

`Pending · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 C`

**Acceptance criteria**
- [ ] The front-desk/display operator can doctor can call specific token out of sequence (VIP, critical) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Break/lunch indicator ('Doctor on break — resumes at [time]')
> As a **front-desk/display operator**, I want **break/lunch indicator ('doctor on break — resumes at [time]')**.

`Partial · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 C`

**Acceptance criteria**
- [ ] The front-desk/display operator can break/lunch indicator ('Doctor on break — resumes at [time]') from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Doctor running late notification on waiting TV
> As a **front-desk/display operator**, I want **doctor running late notification on waiting tv**.

`Partial · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 C`

**Acceptance criteria**
- [ ] The front-desk/display operator can doctor running late notification on waiting TV from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## ER & IPD Display

### ✅ ER triage queue display (visible to triage nurse + waiting patients)
> As a **front-desk/display operator**, I want **er triage queue display (visible to triage nurse + waiting patients)**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 G/H`

**Acceptance criteria**
- [x] The front-desk/display operator can eR triage queue display (visible to triage nurse + waiting patients) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Color-coded: Red (Immediate), Orange (Very Urgent), Yellow, Green, Blue (DOA)
> As a **front-desk/display operator**, I want **color-coded: red (immediate), orange (very urgent), yellow, green, blue (doa)**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 G/H`

**Acceptance criteria**
- [x] The front-desk/display operator can color-coded: Red (Immediate), Orange (Very Urgent), Yellow, Green, Blue (DOA) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ No patient names on ER display (privacy) — only token + triage color
> As a **front-desk/display operator**, I want **no patient names on er display (privacy) — only token + triage color**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 G/H`

**Acceptance criteria**
- [x] The front-desk/display operator can no patient names on ER display (privacy) — only token + triage color from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Waiting time per triage category displayed
> As a **front-desk/display operator**, I want **waiting time per triage category displayed**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 G/H`

**Acceptance criteria**
- [x] The front-desk/display operator can waiting time per triage category displayed from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Auto-escalation alert if Red/Orange waiting > threshold
> As a **front-desk/display operator**, I want **auto-escalation alert if red/orange waiting > threshold**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 G/H`

**Acceptance criteria**
- [x] The front-desk/display operator can auto-escalation alert if Red/Orange waiting > threshold from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Resuscitation bay status (occupied/available) — ER staff view only, NOT public
> As a **front-desk/display operator**, I want **resuscitation bay status (occupied/available) — er staff view only, not public**.

`Partial · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 G/H`

**Acceptance criteria**
- [ ] The front-desk/display operator can resuscitation bay status (occupied/available) — ER staff view only, NOT public from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Bed waiting list display at admission counter / nursing station
> As a **front-desk/display operator**, I want **bed waiting list display at admission counter / nursing station**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 G/H`

**Acceptance criteria**
- [x] The front-desk/display operator can bed waiting list display at admission counter / nursing station from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ IPD display: Patient Name | Ward Type | Priority | Wait Time | Status
> As a **front-desk/display operator**, I want **ipd display: patient name | ward type | priority | wait time | status**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 G/H`

**Acceptance criteria**
- [x] The front-desk/display operator can iPD display: Patient Name | Ward Type | Priority | Wait Time | Status from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Priority: Emergency > ICU step-down > Elective surgery > General
> As a **front-desk/display operator**, I want **priority: emergency > icu step-down > elective surgery > general**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 G/H`

**Acceptance criteria**
- [x] The front-desk/display operator can priority: Emergency > ICU step-down > Elective surgery > General from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Auto-notification when bed available (SMS + alert to admission desk)
> As a **front-desk/display operator**, I want **auto-notification when bed available (sms + alert to admission desk)**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 G/H`

**Acceptance criteria**
- [x] The front-desk/display operator can auto-notification when bed available (SMS + alert to admission desk) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Bed occupancy dashboard on nursing station TV
> As a **front-desk/display operator**, I want **bed occupancy dashboard on nursing station tv**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 G/H`

**Acceptance criteria**
- [x] The front-desk/display operator can bed occupancy dashboard on nursing station TV from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Real-time bed availability by ward type, floor, gender
> As a **front-desk/display operator**, I want **real-time bed availability by ward type, floor, gender**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 G/H`

**Acceptance criteria**
- [x] The front-desk/display operator can real-time bed availability by ward type, floor, gender from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## General

### ✅ WebSocket auto-refresh framework — live content updates on all TV displays without manual intervention
> As a **front-desk/display operator**, I want **websocket auto-refresh framework — live content updates on all tv displays without manual intervention**.

`P1 · Done · Platforms: TV · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [x] The front-desk/display operator can webSocket auto-refresh framework — live content updates on all TV displays without manual intervention from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Multi-language content rotation — cycle display through hospital's configured languages per locale
> As a **front-desk/display operator**, I want **multi-language content rotation — cycle display through hospital's configured languages per locale**.

`P1 · Done · Platforms: TV · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [x] The front-desk/display operator can multi-language content rotation — cycle display through hospital's configured languages per locale from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Emergency broadcast takeover — override all TV displays with emergency message (fire, code blue, lockdown)
> As a **front-desk/display operator**, I want **emergency broadcast takeover — override all tv displays with emergency message (fire, code blue, lockdown)**.

`P1 · Done · Platforms: TV · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [x] The front-desk/display operator can emergency broadcast takeover — override all TV displays with emergency message (fire, code blue, lockdown) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Ambient mode — clock, date, hospital branding when no active queue or display content
> As a **front-desk/display operator**, I want **ambient mode — clock, date, hospital branding when no active queue or display content**.

`P1 · Done · Platforms: TV · Source: MedBrains · RFC: RFC-MODULE-universal-platform`

**Acceptance criteria**
- [x] The front-desk/display operator can ambient mode — clock, date, hospital branding when no active queue or display content from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Hardware & Signage

### TV screen size recommendation per location (32" to 65")
> As a **front-desk/display operator**, I want **tv screen size recommendation per location (32" to 65")**.

`Pending · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 K-N`

**Acceptance criteria**
- [ ] The front-desk/display operator can tV screen size recommendation per location (32" to 65") from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Display resolution support (Full HD minimum, 4K for large)
> As a **front-desk/display operator**, I want **display resolution support (full hd minimum, 4k for large)**.

`Pending · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 K-N`

**Acceptance criteria**
- [ ] The front-desk/display operator can display resolution support (Full HD minimum, 4K for large) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Display connection (HDMI mini-PC / Android TV / Smart TV / Chromecast)
> As a **front-desk/display operator**, I want **display connection (hdmi mini-pc / android tv / smart tv / chromecast)**.

`Pending · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 K-N`

**Acceptance criteria**
- [ ] The front-desk/display operator can display connection (HDMI mini-PC / Android TV / Smart TV / Chromecast) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Dedicated display device per TV
> As a **front-desk/display operator**, I want **dedicated display device per tv**.

`Pending · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 K-N`

**Acceptance criteria**
- [ ] The front-desk/display operator can dedicated display device per TV from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Wired Ethernet connectivity for TV displays (preferred over WiFi)
> As a **front-desk/display operator**, I want **wired ethernet connectivity for tv displays (preferred over wifi)**.

`Pending · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 K-N`

**Acceptance criteria**
- [ ] The front-desk/display operator can wired Ethernet connectivity for TV displays (preferred over WiFi) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Power backup for display devices (UPS to avoid reboot on power switch)
> As a **front-desk/display operator**, I want **power backup for display devices (ups to avoid reboot on power switch)**.

`Pending · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 K-N`

**Acceptance criteria**
- [ ] The front-desk/display operator can power backup for display devices (UPS to avoid reboot on power switch) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Remote display management — IT pushes content, restarts, configures from server
> As a **front-desk/display operator**, I want **remote display management — it pushes content, restarts, configures from server**.

`Pending · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 K-N`

**Acceptance criteria**
- [ ] The front-desk/display operator can remote display management — IT pushes content, restarts, configures from server from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Auto-recovery after power failure (auto-start, auto-connect to queue server)
> As a **front-desk/display operator**, I want **auto-recovery after power failure (auto-start, auto-connect to queue server)**.

`Pending · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 K-N`

**Acceptance criteria**
- [ ] The front-desk/display operator can auto-recovery after power failure (auto-start, auto-connect to queue server) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Audio: built-in TV speakers OR external ceiling speakers
> As a **front-desk/display operator**, I want **audio: built-in tv speakers or external ceiling speakers**.

`Pending · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 K-N`

**Acceptance criteria**
- [ ] The front-desk/display operator can audio: built-in TV speakers OR external ceiling speakers from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Speaker zoning (announcement plays only in relevant area)
> As a **front-desk/display operator**, I want **speaker zoning (announcement plays only in relevant area)**.

`Pending · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 K-N`

**Acceptance criteria**
- [ ] The front-desk/display operator can speaker zoning (announcement plays only in relevant area) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Display brightness and auto-dimming (day/night for 24/7 areas)
> As a **front-desk/display operator**, I want **display brightness and auto-dimming (day/night for 24/7 areas)**.

`Pending · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 K-N`

**Acceptance criteria**
- [ ] The front-desk/display operator can display brightness and auto-dimming (day/night for 24/7 areas) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Hospital information display on lobby TVs (doctor list, directory, visiting hours)
> As a **front-desk/display operator**, I want **hospital information display on lobby tvs (doctor list, directory, visiting hours)**.

`Pending · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 K-N`

**Acceptance criteria**
- [ ] The front-desk/display operator can hospital information display on lobby TVs (doctor list, directory, visiting hours) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Doctor availability board (OPD schedule with photo, room, available/not)
> As a **front-desk/display operator**, I want **doctor availability board (opd schedule with photo, room, available/not)**.

`Pending · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 K-N`

**Acceptance criteria**
- [ ] The front-desk/display operator can doctor availability board (OPD schedule with photo, room, available/not) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### OT schedule display (OT corridor — patient, procedure, surgeon, time)
> As a **front-desk/display operator**, I want **ot schedule display (ot corridor — patient, procedure, surgeon, time)**.

`Pending · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 K-N`

**Acceptance criteria**
- [ ] The front-desk/display operator can oT schedule display (OT corridor — patient, procedure, surgeon, time) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Department directory with floor map / wayfinding
> As a **front-desk/display operator**, I want **department directory with floor map / wayfinding**.

`Pending · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 K-N`

**Acceptance criteria**
- [ ] The front-desk/display operator can department directory with floor map / wayfinding from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Health awareness content rotation between queue updates
> As a **front-desk/display operator**, I want **health awareness content rotation between queue updates**.

`Pending · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 K-N`

**Acceptance criteria**
- [ ] The front-desk/display operator can health awareness content rotation between queue updates from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Emergency alerts on ALL displays simultaneously (Code Red/Blue/mass casualty)
> As a **front-desk/display operator**, I want **emergency alerts on all displays simultaneously (code red/blue/mass casualty)**.

`Pending · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 K-N`

**Acceptance criteria**
- [ ] The front-desk/display operator can emergency alerts on ALL displays simultaneously (Code Red/Blue/mass casualty) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Hospital achievements / accreditation display
> As a **front-desk/display operator**, I want **hospital achievements / accreditation display**.

`Pending · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 K-N`

**Acceptance criteria**
- [ ] The front-desk/display operator can hospital achievements / accreditation display from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Scheduled content management (time-based content rotation)
> As a **front-desk/display operator**, I want **scheduled content management (time-based content rotation)**.

`Pending · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 K-N`

**Acceptance criteria**
- [ ] The front-desk/display operator can scheduled content management (time-based content rotation) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### CMS for IT/PR team to update signage without vendor
> As a **front-desk/display operator**, I want **cms for it/pr team to update signage without vendor**.

`Pending · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 K-N`

**Acceptance criteria**
- [ ] The front-desk/display operator can cMS for IT/PR team to update signage without vendor from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Multi-zone display layout (queue 60% + info 40%)
> As a **front-desk/display operator**, I want **multi-zone display layout (queue 60% + info 40%)**.

`Pending · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 K-N`

**Acceptance criteria**
- [ ] The front-desk/display operator can multi-zone display layout (queue 60% + info 40%) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### SMS notification: token, position, estimated wait
> As a **front-desk/display operator**, I want **sms notification: token, position, estimated wait**.

`Partial · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 K-N`

**Acceptance criteria**
- [ ] The front-desk/display operator can sMS notification: token, position, estimated wait from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### SMS 3 tokens before turn: proceed to waiting area
> As a **front-desk/display operator**, I want **sms 3 tokens before turn: proceed to waiting area**.

`Pending · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 K-N`

**Acceptance criteria**
- [ ] The front-desk/display operator can sMS 3 tokens before turn: proceed to waiting area from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### SMS when called: enter Room [Y] now
> As a **front-desk/display operator**, I want **sms when called: enter room [y] now**.

`Pending · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 K-N`

**Acceptance criteria**
- [ ] The front-desk/display operator can sMS when called: enter Room [Y] now from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### WhatsApp notification support (same as SMS via WhatsApp Business API)
> As a **front-desk/display operator**, I want **whatsapp notification support (same as sms via whatsapp business api)**.

`Partial · Platforms: Web, Mobile, TV · Source: ACMSRC · RFC: CL-34 K-N`

**Acceptance criteria**
- [ ] The front-desk/display operator can whatsApp notification support (same as SMS via WhatsApp Business API) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Mobile app push notification for queue position
> As a **front-desk/display operator**, I want **mobile app push notification for queue position**.

`Partial · Platforms: Web, Mobile, TV · Source: ACMSRC · RFC: CL-34 K-N`

**Acceptance criteria**
- [ ] The front-desk/display operator can mobile app push notification for queue position from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Patient can check queue position from phone (web/app/WhatsApp bot)
> As a **front-desk/display operator**, I want **patient can check queue position from phone (web/app/whatsapp bot)**.

`Partial · Platforms: Web, Mobile, TV · Source: ACMSRC · RFC: CL-34 K-N`

**Acceptance criteria**
- [ ] The front-desk/display operator can patient can check queue position from phone (web/app/WhatsApp bot) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Wait time update notification if doctor running late
> As a **front-desk/display operator**, I want **wait time update notification if doctor running late**.

`Partial · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 K-N`

**Acceptance criteria**
- [ ] The front-desk/display operator can wait time update notification if doctor running late from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Lab report ready notification
> As a **front-desk/display operator**, I want **lab report ready notification**.

`Partial · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 K-N`

**Acceptance criteria**
- [ ] The front-desk/display operator can lab report ready notification from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Pharmacy ready notification
> As a **front-desk/display operator**, I want **pharmacy ready notification**.

`Partial · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 K-N`

**Acceptance criteria**
- [ ] The front-desk/display operator can pharmacy ready notification from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Kiosk

### Kiosk: touchscreen (15"-21"), thermal printer, QR scanner, card reader
> As a **front-desk/display operator**, I want **kiosk: touchscreen (15"-21"), thermal printer, qr scanner, card reader**.

`Partial · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 N`

**Acceptance criteria**
- [ ] The front-desk/display operator can kiosk: touchscreen (15"-21"), thermal printer, QR scanner, card reader from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Kiosk UI: simple, large buttons, multi-language (English + Tamil + Hindi min)
> As a **front-desk/display operator**, I want **kiosk ui: simple, large buttons, multi-language (english + tamil + hindi min)**.

`Partial · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 N`

**Acceptance criteria**
- [ ] The front-desk/display operator can kiosk UI: simple, large buttons, multi-language (English + Tamil + Hindi min) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Kiosk accessibility: height adjustable / wheelchair accessible
> As a **front-desk/display operator**, I want **kiosk accessibility: height adjustable / wheelchair accessible**.

`Partial · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 N`

**Acceptance criteria**
- [ ] The front-desk/display operator can kiosk accessibility: height adjustable / wheelchair accessible from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Kiosk functions: check-in, token, appointment, bill payment, report collection
> As a **front-desk/display operator**, I want **kiosk functions: check-in, token, appointment, bill payment, report collection**.

`Partial · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 N`

**Acceptance criteria**
- [ ] The front-desk/display operator can kiosk functions: check-in, token, appointment, bill payment, report collection from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Kiosk uptime monitoring and auto-restart on crash
> As a **front-desk/display operator**, I want **kiosk uptime monitoring and auto-restart on crash**.

`Partial · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 N`

**Acceptance criteria**
- [ ] The front-desk/display operator can kiosk uptime monitoring and auto-restart on crash from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Kiosk usage analytics (kiosk vs reception counter)
> As a **front-desk/display operator**, I want **kiosk usage analytics (kiosk vs reception counter)**.

`Partial · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 N`

**Acceptance criteria**
- [ ] The front-desk/display operator can kiosk usage analytics (kiosk vs reception counter) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Number of kiosks recommendation for 420-bed hospital
> As a **front-desk/display operator**, I want **number of kiosks recommendation for 420-bed hospital**.

`Pending · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 N`

**Acceptance criteria**
- [ ] The front-desk/display operator can number of kiosks recommendation for 420-bed hospital from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Kiosk vendor compatibility (vendor-agnostic or specific hardware)
> As a **front-desk/display operator**, I want **kiosk vendor compatibility (vendor-agnostic or specific hardware)**.

`Pending · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 N`

**Acceptance criteria**
- [ ] The front-desk/display operator can kiosk vendor compatibility (vendor-agnostic or specific hardware) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Lab Queue

### ✅ Separate queue display for lab sample collection area
> As a **front-desk/display operator**, I want **separate queue display for lab sample collection area**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 D`

**Acceptance criteria**
- [x] The front-desk/display operator can separate queue display for lab sample collection area from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Token generated when lab order placed / patient reports to counter
> As a **front-desk/display operator**, I want **token generated when lab order placed / patient reports to counter**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 D`

**Acceptance criteria**
- [x] The front-desk/display operator can token generated when lab order placed / patient reports to counter from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Display: Token | Patient Name | Collection Counter Number
> As a **front-desk/display operator**, I want **display: token | patient name | collection counter number**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 D`

**Acceptance criteria**
- [x] The front-desk/display operator can display: Token | Patient Name | Collection Counter Number from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Priority tokens for fasting, pediatric, emergency, elderly
> As a **front-desk/display operator**, I want **priority tokens for fasting, pediatric, emergency, elderly**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 D`

**Acceptance criteria**
- [x] The front-desk/display operator can priority tokens for fasting, pediatric, emergency, elderly from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Phlebotomy counter assignment (auto-distribute across counters)
> As a **front-desk/display operator**, I want **phlebotomy counter assignment (auto-distribute across counters)**.

`Done · Platforms: Web, Mobile, TV · Source: ACMSRC · RFC: CL-34 D`

**Acceptance criteria**
- [x] The front-desk/display operator can phlebotomy counter assignment (auto-distribute across counters) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Sample collection acknowledgment updates queue status (Done)
> As a **front-desk/display operator**, I want **sample collection acknowledgment updates queue status (done)**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 D`

**Acceptance criteria**
- [x] The front-desk/display operator can sample collection acknowledgment updates queue status (Done) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Estimated wait time based on current collection rate
> As a **front-desk/display operator**, I want **estimated wait time based on current collection rate**.

`Pending · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 D`

**Acceptance criteria**
- [ ] The front-desk/display operator can estimated wait time based on current collection rate from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Lab report ready notification on phone (SMS/WhatsApp/App)
> As a **front-desk/display operator**, I want **lab report ready notification on phone (sms/whatsapp/app)**.

`Partial · Platforms: Web, Mobile, TV · Source: ACMSRC · RFC: CL-34 D`

**Acceptance criteria**
- [ ] The front-desk/display operator can lab report ready notification on phone (SMS/WhatsApp/App) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## OPD Display

### ✅ Large screen TV showing real-time queue status per department
> As a **front-desk/display operator**, I want **large screen tv showing real-time queue status per department**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 B`

**Acceptance criteria**
- [x] The front-desk/display operator can large screen TV showing real-time queue status per department from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Display: Token | Patient Name (configurable privacy) | Doctor | Room | Status
> As a **front-desk/display operator**, I want **display: token | patient name (configurable privacy) | doctor | room | status**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 B`

**Acceptance criteria**
- [x] The front-desk/display operator can display: Token | Patient Name (configurable privacy) | Doctor | Room | Status from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Color-coded status: Green (current), Yellow (next 3), White (waiting)
> As a **front-desk/display operator**, I want **color-coded status: green (current), yellow (next 3), white (waiting)**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 B`

**Acceptance criteria**
- [x] The front-desk/display operator can color-coded status: Green (current), Yellow (next 3), White (waiting) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Auto-scroll for long queues (smooth scrolling)
> As a **front-desk/display operator**, I want **auto-scroll for long queues (smooth scrolling)**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 B`

**Acceptance criteria**
- [x] The front-desk/display operator can auto-scroll for long queues (smooth scrolling) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Multi-doctor display on single TV (split screen — e.g., 4 doctors)
> As a **front-desk/display operator**, I want **multi-doctor display on single tv (split screen — e.g., 4 doctors)**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 B`

**Acceptance criteria**
- [x] The front-desk/display operator can multi-doctor display on single TV (split screen — e.g., 4 doctors) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Department-wise TV assignment
> As a **front-desk/display operator**, I want **department-wise tv assignment**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 B`

**Acceptance criteria**
- [x] The front-desk/display operator can department-wise TV assignment from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Single department mode (one TV per doctor)
> As a **front-desk/display operator**, I want **single department mode (one tv per doctor)**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 B`

**Acceptance criteria**
- [x] The front-desk/display operator can single department mode (one TV per doctor) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Average wait time display per doctor/department (auto-calculated)
> As a **front-desk/display operator**, I want **average wait time display per doctor/department (auto-calculated)**.

`Partial · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 B`

**Acceptance criteria**
- [ ] The front-desk/display operator can average wait time display per doctor/department (auto-calculated) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Patients waiting count per doctor
> As a **front-desk/display operator**, I want **patients waiting count per doctor**.

`Partial · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 B`

**Acceptance criteria**
- [ ] The front-desk/display operator can patients waiting count per doctor from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Missed token notification on screen
> As a **front-desk/display operator**, I want **missed token notification on screen**.

`Partial · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 B`

**Acceptance criteria**
- [ ] The front-desk/display operator can missed token notification on screen from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Hospital announcements / scrolling ticker on bottom
> As a **front-desk/display operator**, I want **hospital announcements / scrolling ticker on bottom**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 B`

**Acceptance criteria**
- [x] The front-desk/display operator can hospital announcements / scrolling ticker on bottom from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Multi-language display (English + Tamil simultaneously or toggle)
> As a **front-desk/display operator**, I want **multi-language display (english + tamil simultaneously or toggle)**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 B`

**Acceptance criteria**
- [x] The front-desk/display operator can multi-language display (English + Tamil simultaneously or toggle) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Pharmacy Queue

### ✅ Separate queue display for pharmacy dispensing counter
> As a **front-desk/display operator**, I want **separate queue display for pharmacy dispensing counter**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 E`

**Acceptance criteria**
- [x] The front-desk/display operator can separate queue display for pharmacy dispensing counter from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Token auto-generated when prescription reaches pharmacy
> As a **front-desk/display operator**, I want **token auto-generated when prescription reaches pharmacy**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 E`

**Acceptance criteria**
- [x] The front-desk/display operator can token auto-generated when prescription reaches pharmacy from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Display: Token | Patient Name | Counter | Status (Preparing/Ready/Dispensed)
> As a **front-desk/display operator**, I want **display: token | patient name | counter | status (preparing/ready/dispensed)**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 E`

**Acceptance criteria**
- [x] The front-desk/display operator can display: Token | Patient Name | Counter | Status (Preparing/Ready/Dispensed) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Audio call: 'Token [X], collect medicines from Counter [Y]'
> As a **front-desk/display operator**, I want **audio call: 'token [x], collect medicines from counter [y]'**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 E`

**Acceptance criteria**
- [x] The front-desk/display operator can audio call: 'Token [X], collect medicines from Counter [Y]' from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Estimated preparation time (based on prescription complexity)
> As a **front-desk/display operator**, I want **estimated preparation time (based on prescription complexity)**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 E`

**Acceptance criteria**
- [x] The front-desk/display operator can estimated preparation time (based on prescription complexity) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### IP pharmacy queue separate from OP pharmacy
> As a **front-desk/display operator**, I want **ip pharmacy queue separate from op pharmacy**.

`Pending · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 E`

**Acceptance criteria**
- [ ] The front-desk/display operator can iP pharmacy queue separate from OP pharmacy from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Night pharmacy display (separate night counter)
> As a **front-desk/display operator**, I want **night pharmacy display (separate night counter)**.

`Pending · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 E`

**Acceptance criteria**
- [ ] The front-desk/display operator can night pharmacy display (separate night counter) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Radiology Queue

### ✅ Queue display for radiology waiting area (X-ray, CT, MRI, USG rooms)
> As a **front-desk/display operator**, I want **queue display for radiology waiting area (x-ray, ct, mri, usg rooms)**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 F`

**Acceptance criteria**
- [x] The front-desk/display operator can queue display for radiology waiting area (X-ray, CT, MRI, USG rooms) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Token/appointment-based queue per modality
> As a **front-desk/display operator**, I want **token/appointment-based queue per modality**.

`Done · Platforms: Web, Mobile, TV · Source: ACMSRC · RFC: CL-34 F`

**Acceptance criteria**
- [x] The front-desk/display operator can token/appointment-based queue per modality from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Display: Patient Name | Modality | Room | Status (Waiting/In-Progress/Done)
> As a **front-desk/display operator**, I want **display: patient name | modality | room | status (waiting/in-progress/done)**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 F`

**Acceptance criteria**
- [x] The front-desk/display operator can display: Patient Name | Modality | Room | Status (Waiting/In-Progress/Done) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Preparation instructions on display (e.g., 'Drink 1L water for USG abdomen')
> As a **front-desk/display operator**, I want **preparation instructions on display (e.g., 'drink 1l water for usg abdomen')**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 F`

**Acceptance criteria**
- [x] The front-desk/display operator can preparation instructions on display (e.g., 'Drink 1L water for USG abdomen') from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Estimated wait per modality based on current scan durations
> As a **front-desk/display operator**, I want **estimated wait per modality based on current scan durations**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 F`

**Acceptance criteria**
- [x] The front-desk/display operator can estimated wait per modality based on current scan durations from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Report ready notification to patient (SMS/WhatsApp)
> As a **front-desk/display operator**, I want **report ready notification to patient (sms/whatsapp)**.

`Partial · Platforms: Web, Mobile, TV · Source: ACMSRC · RFC: CL-34 F`

**Acceptance criteria**
- [ ] The front-desk/display operator can report ready notification to patient (SMS/WhatsApp) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## TV i18n

### Shared locales package for TV displays
> As a **front-desk/display operator**, I want **shared locales package for tv displays**.

`P3 · Pending · Platforms: TV · Source: RFC-003`

**Acceptance criteria**
- [ ] The front-desk/display operator can shared locales package for TV displays from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Multi-language queue board displays
> As a **front-desk/display operator**, I want **multi-language queue board displays**.

`P3 · Pending · Platforms: TV · Source: RFC-003`

**Acceptance criteria**
- [ ] The front-desk/display operator can multi-language queue board displays from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### RTL layout support for TV displays
> As a **front-desk/display operator**, I want **rtl layout support for tv displays**.

`P3 · Pending · Platforms: TV · Source: RFC-003`

**Acceptance criteria**
- [ ] The front-desk/display operator can rTL layout support for TV displays from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Language auto-detect from hospital locale setting
> As a **front-desk/display operator**, I want **language auto-detect from hospital locale setting**.

`P3 · Pending · Platforms: TV · Source: RFC-003`

**Acceptance criteria**
- [ ] The front-desk/display operator can language auto-detect from hospital locale setting from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

## Token Generation

### Self-service kiosk for patient check-in (touchscreen — scan QR/enter UHID/phone)
> As a **front-desk/display operator**, I want **self-service kiosk for patient check-in (touchscreen — scan qr/enter uhid/phone)**.

`Partial · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 A`

**Acceptance criteria**
- [ ] The front-desk/display operator can self-service kiosk for patient check-in (touchscreen — scan QR/enter UHID/phone) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Kiosk token printing (thermal — token no, doctor, dept, wait time, QR code)
> As a **front-desk/display operator**, I want **kiosk token printing (thermal — token no, doctor, dept, wait time, qr code)**.

`Partial · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 A`

**Acceptance criteria**
- [ ] The front-desk/display operator can kiosk token printing (thermal — token no, doctor, dept, wait time, QR code) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Reception counter token generation (walk-in patients)
> As a **front-desk/display operator**, I want **reception counter token generation (walk-in patients)**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 A`

**Acceptance criteria**
- [x] The front-desk/display operator can reception counter token generation (walk-in patients) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Mobile app check-in — digital token on phone (no physical token)
> As a **front-desk/display operator**, I want **mobile app check-in — digital token on phone (no physical token)**.

`Partial · Platforms: Web, Mobile, TV · Source: ACMSRC · RFC: CL-34 A`

**Acceptance criteria**
- [ ] The front-desk/display operator can mobile app check-in — digital token on phone (no physical token) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### WhatsApp-based check-in (patient sends UHID, receives token + position)
> As a **front-desk/display operator**, I want **whatsapp-based check-in (patient sends uhid, receives token + position)**.

`Pending · Platforms: Web, Mobile, TV · Source: ACMSRC · RFC: CL-34 A`

**Acceptance criteria**
- [ ] The front-desk/display operator can whatsApp-based check-in (patient sends UHID, receives token + position) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Appointment-linked token — pre-booked patients auto-assigned on check-in
> As a **front-desk/display operator**, I want **appointment-linked token — pre-booked patients auto-assigned on check-in**.

`Partial · Platforms: Web, Mobile, TV · Source: ACMSRC · RFC: CL-34 A`

**Acceptance criteria**
- [ ] The front-desk/display operator can appointment-linked token — pre-booked patients auto-assigned on check-in from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Walk-in vs appointment queue differentiation (separate or priority merge)
> As a **front-desk/display operator**, I want **walk-in vs appointment queue differentiation (separate or priority merge)**.

`Partial · Platforms: Web, Mobile, TV · Source: ACMSRC · RFC: CL-34 A`

**Acceptance criteria**
- [ ] The front-desk/display operator can walk-in vs appointment queue differentiation (separate or priority merge) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] Mobile: React Native Paper screen with WatermelonDB offline support + sync.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Token categories: Normal / Priority (elderly >70, disabled, pregnant, emergency, VIP)
> As a **front-desk/display operator**, I want **token categories: normal / priority (elderly >70, disabled, pregnant, emergency, vip)**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 A`

**Acceptance criteria**
- [x] The front-desk/display operator can token categories: Normal / Priority (elderly >70, disabled, pregnant, emergency, VIP) from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### ✅ Priority token rules configurable per hospital policy
> As a **front-desk/display operator**, I want **priority token rules configurable per hospital policy**.

`Done · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 A`

**Acceptance criteria**
- [x] The front-desk/display operator can priority token rules configurable per hospital policy from the relevant screen, with clear loading / empty / error states.
- [x] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [x] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [x] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [x] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [x] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [x] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [x] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Token re-issue if patient misses turn (configurable: back of queue or next 3)
> As a **front-desk/display operator**, I want **token re-issue if patient misses turn (configurable: back of queue or next 3)**.

`Partial · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 A`

**Acceptance criteria**
- [ ] The front-desk/display operator can token re-issue if patient misses turn (configurable: back of queue or next 3) from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

### Multi-department token — single token for OPD → Lab → Pharmacy visit
> As a **front-desk/display operator**, I want **multi-department token — single token for opd → lab → pharmacy visit**.

`Partial · Platforms: Web, TV · Source: ACMSRC · RFC: CL-34 A`

**Acceptance criteria**
- [ ] The front-desk/display operator can multi-department token — single token for OPD → Lab → Pharmacy visit from the relevant screen, with clear loading / empty / error states.
- [ ] Backend: tenant-scoped endpoint(s) with RLS (`set_tenant_context`) and typed errors; new entities get a migration with `tenant_id` + RLS + indexes; `cargo clippy` clean.
- [ ] Web: built from the `@/components/ui` seam, page-guarded via `useRequirePermission`, data through TanStack Query, inputs Zod-validated.
- [ ] TV: D-pad focus navigation, large-format layout, WebSocket realtime updates.
- [ ] Access is permission-gated (`P.<module>.<action>`) at page and element level; unauthorized users are redirected/hidden.
- [ ] Public-display privacy (no full PHI); fixed emergency-code colour layer per spec.
- [ ] Mutations are audit-logged (who / when / what); PHI access is audited where applicable.
- [ ] Tests: CRUD + integration; `make check-all` (check-api / check-ui-api / check-types) passes; smoke test for any new endpoint.

