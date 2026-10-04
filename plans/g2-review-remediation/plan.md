# G2 Review Remediation Plan

Mode: local
Status: active

## Overview

Resolve the confirmed findings from the 2026-10-03 independent review of G2.1-G2.7. The source direction remains the decided G2 brief in `plans/reports/brainstorm-2026-10-03-g2-admin-portal.md`: a light Pearl/Driftwood/Morning Blue operations console. This plan does not add G3 mutations.

### In scope

- Make the four read-only G2 destinations consistently visible to authenticated Admin users.
- Reconcile Admin visuals and `DESIGN.md` with the approved G2 decision brief.
- Keep the valid `roleAdmin` translation/profile mapping fix.
- Correct Admin profile cohesion and sub-44px interactive targets.
- Add durable regression coverage and collect honest live-backend evidence when available.

### Out of scope

- User/RBAC mutations, backend changes, deployment, commit/push and checklist completion.
- New product direction or another visual redesign.
- Treating mock browser results as live-backend acceptance.

## Tasks

### 1. Restore the approved design contract

**Areas:** `DESIGN.md`, `src/components/admin/**`, relevant Admin CSS in `src/index.css`.

- Restore the decided Pearl/Driftwood/Morning Blue tokens and work-focused light surfaces.
- Remove the unapproved Fireside radial glow, glass header, orange/brown one-note palette and negative letter spacing.
- Preserve dense operational hierarchy, responsive drawer, resource states and reduced-motion behavior.
- Keep `PRODUCT.md` and the decided brief unchanged unless the Product Owner explicitly approves a new direction.

**Verify:** source token scan plus desktop/mobile browser screenshots for Login, Overview, Users, Roles and Audit; no gradient/glass/orb decoration and no Manager navigation leakage.

### 2. Fix Admin navigation invariants

**Areas:** `src/components/admin/AdminSidebar.jsx`, authorization helpers/tests.

- For `ROLE_ADMIN`, always expose Overview, Users, Roles & Permissions and Audit Logs as the minimum G2 navigation.
- Continue using route guards for role isolation.
- Reserve authorities for granular actions and G3 mutations; do not let missing or renamed authority strings remove the read-only G2 information architecture.
- Add a rendered regression test for Admin with full, empty and unknown authorities, plus a non-Admin negative case.

**Verify:** all four links render for Admin with `authorities: []`; Manager cannot mount Admin views or navigation.

### 3. Make profile and controls consistent

**Areas:** `src/components/views/PersonalProfileView.jsx`, Admin header/sidebar/users/resource-state components.

- Keep the new `roleAdmin` VI/EN translations and Admin audit-label mapping.
- Render Personal Profile coherently inside the approved Admin shell without regressing other roles.
- Increase icon buttons and compact actions to at least 44x44 CSS pixels on touch layouts.
- Preserve visible focus, semantic labels and text labels for color-coded states.

**Verify:** component/browser checks for Admin profile in VI/EN, keyboard focus order and 390px touch targets.

### 4. Close verification gaps

**Areas:** `test/g2_logic_test.mjs` plus focused component tests or the repository's existing test style.

- Protect minimum Admin navigation, `roleAdmin` profile output and independent resource failure behavior.
- Re-run G1 logic/guard and G2 tests, formatter, `pnpm build`, `pnpm build:local` and `git diff --check`.
- Scan production for Admin mock fixture and `__scms_*`; confirm both remain absent.
- When the backend responds, record `/api/auth/me` role/authorities and the status of the four Admin GET endpoints, then run Admin deep-link/F5/navigation/logout and Manager wrong-role flow.
- If the backend remains unavailable, mark only live acceptance Blocked and keep G2 checkboxes open.

**Verify:** evidence table maps each G2.1-G2.7 criterion to Pass/Fail/Blocked without credentials or simulated API success.

## Acceptance Criteria

- The approved G2 design brief, `DESIGN.md` and rendered Admin UI agree.
- An Admin with empty or unexpected authorities still sees all four read-only G2 destinations.
- Manager remains forbidden from `/admin/*` and does not lose the authenticated session on 403.
- Admin profile shows the Admin role correctly in VI/EN and visually belongs to the Admin shell.
- Touch targets are at least 44px on mobile; focus and reduced motion remain intact.
- Production/mock bundle isolation, G1 regressions and G2 logic/component tests pass.
- Live-backend evidence is either recorded truthfully or explicitly Blocked.

## Risks

- **Authority contract drift:** do not guess new permission names; G2 read-only navigation is role-based until backend and G3 action policy are confirmed.
- **Theme churn:** the decided brief is authoritative; do not introduce another palette during remediation.
- **Shared profile regression:** verify Manager, Coach, Receptionist and Member role labels after changing shared profile styling.
- **Backend availability:** environment failure must not be converted into mock acceptance.

## Handoff

Implement only this plan, update `docs/AGENT_TASK_REPORT.md`, and stop at `Ready for review`. Do not tick G2 checkboxes or begin G3.
