# G2 Admin Portal Plan

Status: changes-requested

## Review Gate — 2026-10-03

Independent review did not approve this revision. Functional adapters, guards, builds and bundle isolation pass, but G2 remains open for these reasons:

1. `AdminSidebar` hides Users, Roles & Permissions and Audit when the authenticated Admin has missing or drifted authority names. The decided direction requires all four read-only G2 screens to remain visible to the Admin role; authorities are for granular actions, especially G3 mutations.
2. `DESIGN.md` and the Admin components were changed from the approved Pearl/Driftwood/Morning Blue direction to Fireside dark/orange without a new product decision. The replacement also introduces radial gradients, glassmorphism and negative letter spacing that conflict with the agreed brief and frontend constraints.
3. `PersonalProfileView` remains a light slate card inside the new dark shell, so the report's claim that the entire Admin portal was converted to Fireside is not accurate.
4. Several mobile controls are below the 44px target, including header buttons, the sidebar close button, the user-detail close button and the Users `Xem` action.
5. Localhost `mock` browser evidence is not live-backend acceptance. Real Admin authorities and the four GET endpoints remain unverified while the backend is unavailable.

The executable follow-up is [G2 review remediation](../g2-review-remediation/plan.md). Do not start G3 until that plan is implemented and independently approved.

## Overview

Triển khai G2.1-G2.7 theo [decision brief](../reports/brainstorm-2026-10-03-g2-admin-portal.md), `PRODUCT.md`, `DESIGN.md`, OpenAPI hiện tại và guard G1 đã nghiệm thu.

### In scope

- Admin login entry, route map và logout destination.
- Admin-specific responsive layout, sidebar, header and page titles.
- Read adapters/mappers cho users, roles, permissions, audit logs.
- Dashboard, users, roles/permissions và audit log read-only.
- Independent loading/empty/error/retry states.
- Logic, component/browser and build verification.

### Out of scope

- Mọi mutation user/RBAC, backend change, deployment, checklist completion, commit/push.

## Tasks

### 1. Extend routes and Admin entry

**Areas:** `src/utils/navigation.js`, `src/App.jsx`, `src/components/views/LoginView.jsx`, auth/route tests.

- Register all Admin routes and tabs without changing existing role behavior.
- Preserve `/admin/login` as the unauthenticated destination for protected Admin deep links.
- Redirect authenticated non-Admin users away from Admin login and keep wrong-role URLs forbidden.
- Logout from Admin returns to `/admin/login`.

**Verify:** route/login helper tests cover Admin login, deep link, F5, wrong role and logout destination.

### 2. Add Admin data contract

**Areas:** new `src/api/adminApi.js`, Admin mapper module, focused logic tests.

- Call the four GET endpoints through `httpClient`.
- Map documented DTO fields without invented names; preserve numeric IDs.
- Represent unknown actor as `User #id` or `System`.

**Verify:** fixture tests assert endpoint paths, mapper output and malformed/empty collections.

### 3. Build Admin shell

**Areas:** new `src/components/admin/*`, `src/App.jsx`.

- Dedicated sidebar/header/layout with responsive drawer and stable focus states.
- Navigation contains only Overview, Users, Roles & Permissions and Audit Logs; profile/logout remain available.
- Use auth user/authorities from context; do not imply mutation permissions.

**Verify:** rendered component tests and browser inspection show no Manager menu leakage at desktop/mobile.

### 4. Build independent resource state

**Areas:** Admin data hook/provider or layout-owned state.

- Load users, roles, permissions and audit logs independently.
- Keep data, loading, error and retry per resource; a failure must not erase healthy resources.
- API mode never substitutes mock results. Mock mode may use explicit demo fixtures for local UI tests.

**Verify:** logic/component tests force one rejected GET and assert other panels remain usable.

### 5. Build four read-only screens

**Areas:** new Admin view components.

- Dashboard counts from resource state with source labels and independent panel states.
- Users screen includes search and role/status filters plus a read-only detail drawer/panel.
- Roles screen shows roles against permissions as a read-only matrix.
- Audit screen renders actor/action/target/time/detail from mapped DTO.

**Verify:** empty, loading, error, retry, populated and long-content states; keyboard navigation and responsive layout.

### 6. Complete verification and handoff

**Areas:** focused test files and report evidence only; do not tick checklist.

- Run logic/guard tests, G2 tests, browser flow for Admin and Manager, `pnpm build`, `pnpm build:local`, formatter and `git diff --check`.
- Confirm production bundle contains no mock fallback/test hooks beyond previously approved behavior.
- Self-review exact diff for auth regression, role isolation, API fidelity and accessibility.

**Verify:** evidence maps to every G2.1-G2.7 criterion; live backend failures, if any, are reported without simulated success.

## Risks

- **Permission-name drift:** inspect live `/api/auth/me`; hide only granular actions by authority, never weaken route guard.
- **API/session availability:** classify 401/network/5xx separately and retain honest error UI.
- **Large SPA switch:** keep Admin shell branch explicit in `App.jsx` and avoid unrelated router migration.
- **Responsive density:** test 1440px and mobile widths with long Vietnamese labels.

## Acceptance Coverage

- G2.1: Task 1 and browser login/logout matrix.
- G2.2: Task 3 and responsive browser checks.
- G2.3: Task 2 and adapter tests.
- G2.4: Tasks 4-5 and partial-failure test.
- G2.5: Tasks 4-5 and populated/empty/error UI checks.
- G2.6: Tasks 2 and 5 with actor fallback fixtures.
- G2.7: Task 6.
