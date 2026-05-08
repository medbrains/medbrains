# `lms.tsx` walkthrough

_Source: [`apps/web/src/pages/lms.tsx`](../../../apps/web/src/pages/lms.tsx) (371 lines). Guard: `P.LMS.MY_LEARNING_VIEW`. API methods: 5. useForm: 0. Tables: 2. Modals: 0._

Tick each box that **works as expected** when you walk the page in a browser. Anything you can't tick → file in `../issues.md` with the line number, then fix and come back to tick it. Severity rubric: **P0** blocks core flow, **P1** broken UX with workaround, **P2** cosmetic.

## Page-level

- [ ] Page renders without `console.error`
- [ ] Network tab shows no 4xx/5xx on initial load
- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout
- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls
- [ ] Permission guard `P.LMS.MY_LEARNING_VIEW` redirects unauthorised user to /dashboard
- [ ] Loading skeleton / spinner shown while data loads
- [ ] Empty state visible when there are zero rows
- [ ] Page title in browser tab is correct
- [ ] Breadcrumb / nav highlights this page

## Tabs

- [ ] Tab **}>Course Catalog** (`catalog`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Course Catalog** (`catalog`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Course Catalog** (`catalog`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>My Learning** (`my-learning`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>My Learning** (`my-learning`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>My Learning** (`my-learning`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Quizzes** (`quizzes`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Quizzes** (`quizzes`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Quizzes** (`quizzes`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Learning Paths** (`paths`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Learning Paths** (`paths`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Learning Paths** (`paths`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Compliance** (`compliance`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Compliance** (`compliance`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Compliance** (`compliance`) — leaving and returning preserves or intentionally resets state
- [ ] Tab **}>Certificates** (`certificates`) — clicking activates the panel + loads its data without console error
- [ ] Tab **}>Certificates** (`certificates`) — all visible filters/actions inside the tab produce a visible result
- [ ] Tab **}>Certificates** (`certificates`) — leaving and returning preserves or intentionally resets state

## Tables / lists

### `<Table>` @ line 243
  - [ ] Header **Course** column shows correct value for at least one row
  - [ ] Header **Mandatory** column shows correct value for at least one row
  - [ ] Header **Enrolled** column shows correct value for at least one row
  - [ ] Header **Completed** column shows correct value for at least one row
  - [ ] Header **Overdue** column shows correct value for at least one row
  - [ ] Header **Completion %** column shows correct value for at least one row
  - [ ] Header **Certificate No.** column shows correct value for at least one row
  - [ ] Header **Course / Path** column shows correct value for at least one row
  - [ ] Header **Issued Date** column shows correct value for at least one row
  - [ ] Header **Expiry** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

### `<Table>` @ line 294
  - [ ] Header **Certificate No.** column shows correct value for at least one row
  - [ ] Header **Course / Path** column shows correct value for at least one row
  - [ ] Header **Issued Date** column shows correct value for at least one row
  - [ ] Header **Expiry** column shows correct value for at least one row
  - [ ] Sortable column actually sorts (if interactive)
  - [ ] Pagination / load-more works (if applicable)

## Form inputs (2)

- [ ] **<TextInput @ line 82>** (`TextInput`, [line 82](../../../apps/web/src/pages/lms.tsx#L82)) — accepts input, default value sensible, persists after refresh
- [ ] **<Select @ line 89>** (`Select`, [line 89](../../../apps/web/src/pages/lms.tsx#L89)) — accepts input, default value sensible, persists after refresh

## Buttons / actions (`<Button>`: 2, `<ActionIcon>`: 0, `<Menu.Item>`: 0)

- [ ] **} size="sm">Add Course** ([line 99](../../../apps/web/src/pages/lms.tsx#L99)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **} size="sm">Add Course** ([line 99](../../../apps/web/src/pages/lms.tsx#L99)) — failure path works: validation/server error is shown clearly and does not leave stale loading state
- [ ] **} size="sm">Create Path** ([line 203](../../../apps/web/src/pages/lms.tsx#L203)) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes
- [ ] **} size="sm">Create Path** ([line 203](../../../apps/web/src/pages/lms.tsx#L203)) — failure path works: validation/server error is shown clearly and does not leave stale loading state

## API methods used (5)

- [ ] `api.listLmsCourses` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.listLmsPaths` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.lmsComplianceOverview` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.myLmsCertificates` — request goes out, 2xx response, no schema mismatch in browser console
- [ ] `api.myLmsEnrollments` — request goes out, 2xx response, no schema mismatch in browser console

---

_Generated by `scripts/gen_screen_checklist.py`. Re-run after any change to the page to refresh — checkboxes are NOT preserved across regenerations, so commit your ticks before regenerating._