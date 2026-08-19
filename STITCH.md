# STITCH — Kolonios Design Project

Agent + human reference for the Kolonios Stitch project. Screens are
**mobile-only**, dark-mode-first, aligned with the technician/HR workforce
dashboard in this repo. Re-order screens in the Stitch UI; keep this doc's
groupings in sync.

## Project

| Field | Value |
|-------|-------|
| Project ID | `10448614958021163807` |
| Resource name | `projects/10448614958021163807` |
| Title | `Kolonios` |
| Visibility | `PRIVATE` |
| Type | `PROJECT_DESIGN` |
| Origin | `STITCH` |
| Device type | `MOBILE` |

## Design System (Stitch theme)

- **Color mode**: `DARK` (dark-mode-first)
- **Color variant**: `MONOCHROME`
- **Roundness**: `ROUND_TWELVE`
- **Custom color**: `#18181B` (zinc/charcoal surface)
- **Override primary**: `#E4E4E7` (light neutral buttons on dark)
- **Override neutral**: `#18181B`
- **Fonts**: `INTER` (headline / body / label)

**Creative brief** (from the Stitch `designMd`): neutral zinc/charcoal palette,
high-contrast white text, muted gray secondary text, thin low-contrast borders,
restrained shadows, compact cards with generous touch targets, `rounded-2xl`
cards, `rounded-full` status badges, light neutral primary actions on dark
surfaces, dense mobile hierarchy (greeting header → attendance → assigned work →
available jobs → performance), fixed bottom nav with 5 destinations and a
centered check-in action. No gradients, illustrations, decorative marketing, or
excessive color.

Local DESIGN.md: `./DESIGN.md` (light-mode web UI tokens; the Stitch theme is
the dark technician variant).

## Screen Inventory (visible — 36 screens)

Source of truth: `list_screens` + `get_project` (2026-08-18). 56 instances total — 36 visible, 20 hidden (junk). Status: ✅ built, 🔨 not built, ⚠️ partial/rework, 🔁 duplicate.

### Full Status Table

| # | Screen (Stitch title) | Role | Stitch | Code | Status | Route / Notes |
|---|---|---|---|---|---|---|
| 1 | Staff Dashboard | Technician | ✅ | ✅ | ✅ | `/dashboard/overview` |
| 2 | My Work Tab (Self Service) Updated | Technician | ✅ | ✅ | ✅ | `/dashboard/my-work` |
| 3 | Office Tab (Admin Tools) Updated | Technician | ✅ | ✅ | ✅ | `/dashboard/overview` (role branch) |
| 4 | Notifications Center | Technician | ✅ | ✅ | ✅ | `/dashboard/notifications` |
| 5 | Check-In (Scan) | Technician | ✅ | ✅ | ✅ | `/dashboard/attendance/check-in` — GPS + face, 2-step, server-side verification |
| 6 | Check-In Camera (Updated Nav) | Technician | ✅ | ✅ | ✅ | **Canonical** — Human.js overlay |
| 7 | Check-In Camera | Technician | ✅ | ✅ | 🔁 | Duplicate of #6 — hide this one |
| 8 | Check-In Success | Technician | ✅ | ✅ | ✅ | confirmation + badges |
| 9 | Face Enrollment | Technician | ✅ | ✅ | ✅ | `/dashboard/attendance/face-settings` (self-service) |
| 10 | Attendance Settings | Technician | ✅ | ✅ | ✅ | `/dashboard/admin/attendance/face-settings` (`company_settings`) |
| 11 | Attendance Correction | Technician | ✅ | ✅ | ✅ | `/dashboard/attendance` (sheet) |
| 12 | Attendance History (Updated Nav) | Technician | ✅ | ✅ | ✅ | **Canonical** |
| 13 | Attendance History | Technician | ✅ | ✅ | 🔁 | Duplicate of #12 — hide this one |
| 14 | Work Session (Unified) Updated | Technician | ✅ | ✅ | ✅ | `/dashboard/work-session/$ticketId` — on-site state folded in |
| 15 | Work Session (Dynamic Materials) | Technician | ✅ | ✅ | ✅ | same route — materials/photos/log variant |
| 16 | Handoff Confirmation | Technician | ✅ | ✅ | ✅ | `/dashboard/work-session/$ticketId/handoff` |
| 17 | Daily Checklist | Technician | ✅ | ❌ | 🔨 | Stitch exists, no route |
| 18 | En Route Navigation | Technician | ✅ | ✅ | ✅ | `/dashboard/en-route/$ticketId` — MapLibre preview (blue device marker via live GPS, orange destination pin, dashed guide line, fitBounds), TurfJS distance readout, Open Maps handoff, Call Customer, "I've Arrived" (`assigned → in_progress` + worklog) |
| 19 | Open Tickets | Technician | ✅ | ✅ | ✅ | `/dashboard/jobs` — was 🔨, now built (`jobs-page.tsx`) |
| 20 | Create Ticket | Technician | ✅ | ✅ | ✅ | `/dashboard/tickets/new` |
| 21 | Ticket Detail (Estafet) | Technician | ✅ | ✅ | ✅ | `/dashboard/tickets/$ticketId` |
| 22 | Ticket Detail (Rework) — T-1042 | Technician | ✅ | ✅ | ✅ | same route — rework branch |
| 23 | Ticket Completed — T-1042 | Technician | ✅ | ✅ | ✅ | `/dashboard/tickets/$ticketId/completed` |
| 24 | Next Leg Pool | Technician | ✅ | ❌ | 🔨 | Stitch exists, no route (overlaps Available Jobs) |
| 25 | My Leave | Technician | ✅ | ✅ | ✅ | `/dashboard/leave` |
| 26 | Leave History | Technician | ✅ | ✅ | ✅ | `/dashboard/leave` (tab) |
| 27 | New Leave Request | Technician | ✅ | ✅ | ✅ | `/dashboard/leave` (sheet) |
| 28 | Holiday Calendar | Technician | ✅ | ✅ | ✅ | `/dashboard/admin/holiday-calendar` |
| 29 | My Schedule | Technician | ✅ | ✅ | ✅ | `/dashboard/schedule` |
| 30 | Profile Tab | Technician | ✅ | ✅ | ⚠️ | `/dashboard/profile` — 111 lines, needs rework to match Stitch |
| 31 | Edit Profile | Technician | ✅ | ❌ | 🔨 | Stitch `Edit Profile`, no route |
| 32 | Change Password | Technician | ✅ | ❌ | 🔨 | Stitch `Change Password`, no route |
| 33 | Settings | Technician | ✅ | ❌ | 🔨 | Stitch `Settings` (mobile), no route |
| 34 | Achievements | Technician | ✅ | ✅ | ✅ | `/dashboard/achievements` |
| 35 | SPV Review Queue | SPV only | ✅ | ❌ | 🔨 | `/dashboard/spv/review` — nav-config only, no route files |
| 36 | Review Ticket (SPV) | SPV only | ✅ | ❌ | 🔨 | planned `/dashboard/spv/review/$ticketId` |
| 37 | Leave Approvals Queue | SPV only | ✅ | ❌ | 🔨 | `/dashboard/spv/leave-approvals` — nav-config only |
| — | Working (On Site) | — | hidden | — | 🔁 | Folded into #14 — do not recreate |

### Build Summary

| Role | Stitch visible | Code built | Code missing / rework | Duplicates to hide |
|------|---------------|------------|----------------------|-------------------|
| Technician | 34 (incl. 2 dups) | 27 | 6 🔨 + 1 ⚠️ | 2 |
| SPV | 34 + 3 = 37 | 27 + 0 | 6 + 3 = 9 + 1 ⚠️ | 2 |
| Admin/HR (desktop) | 9 | 6 | 3 🔨 + 1 ⚠️ | 0 |
| **Total unique** | **36 visible** (56 instances) | **~27 routes** (62 files in `src/routes/dashboard/**`) | **9 without route + 1 rework** | **3 hidden junk** |

### Unbuilt / Rework by Priority

| Priority | Screen | Blocker |
|---|---|---|
| 1 | Daily Checklist | needs route + checklist API |
| 2 | Next Leg Pool | needs route (currently overlaps `/dashboard/jobs`) |
| 3 | SPV Review Queue | needs `src/routes/dashboard/spv/**` |
| 4 | Review Ticket (SPV) | needs evidence review + approve/reject |
| 5 | Leave Approvals Queue | needs `src/routes/dashboard/spv/**` |
| 6 | Settings (Mobile) | needs mobile settings route |
| 7 | Change Password | needs route + strength meter + forgot link |
| 8 | Edit Profile | needs route (email locked) |
| 9 | Profile Tab rework | expand `profile-page.tsx` to Stitch hierarchy |
| 10 | Forgot Password flow | requires email provider |

> Old `docs/TODO.md` / `docs/TICKETS.md` refs removed — `docs/` now only contains `superpowers/`.

## Hidden Screens (junk — not counted, keep hidden)

Hidden screens are deleted/experimental — ignore them entirely:
- Working (On Site) — folded into work-session route's on-site state
- Technician Dashboard (alternate) — role branch of Staff Dashboard
- Various experiment variants

## Notes

- Screens are 780px-wide HTML exports (design width 390, mobile) generated via
  Stitch.
- Technician + SPV use the `fieldops` shell (MobileShell on mobile). SPV gets
  review tools via role-group permissions — no separate shell.
- Admin/HR keep current desktop pages (My Leave, Holiday Calendar, Leave
  Approvals stay sidebar/desktop). Stitch mobile versions are not built for
  backoffice.
- SPV-only screens (Review Queue, Review Ticket) are SPV-only; admin & HR get
  a visibility toggle for role-specific features.

## Stitch MCP Tools

All screen operations go through the Stitch MCP server. Use these tools
directly — no API key needed when called via MCP.

| Tool | Purpose |
|------|---------|
| `list_projects` | Find project IDs |
| `get_project` | Full project metadata + screen instances |
| `list_screens` | List all screens in a project |
| `get_screen` | Screen detail: screenshot + HTML download URLs |
| `generate_screen_from_text` | Create new screen from a text prompt |
| `edit_screens` | Modify existing screens with a prompt |
| `generate_variants` | Explore layout/color/content variations |
| `create_project` | Create a new Stitch project |
| `upload_design_md` | Upload DESIGN.md to a project |
| `create_design_system_from_design_md` | Create design system from uploaded DESIGN.md |
| `update_design_system` | Update an existing design system |
| `apply_design_system` | Apply design system to existing screens |

## Stitch Skills (`.opencode/skills/`)

11 skills covering the full Stitch workflow. **Always check which skill fits
before doing Stitch work** — they chain together and each has specific
prerequisites.

### Core Generation

| Skill | When to use |
|-------|-------------|
| **generate-design** | Create new screens from text/images, edit existing screens, generate variants. Includes prompt enhancement pipeline (terminology refinement, design system injection). |
| **enhance-prompt** | Polish a vague UI idea into a structured Stitch-optimized prompt before calling generation tools. |

### Design System

| Skill | When to use |
|-------|-------------|
| **manage-design-system** | Create, update, or apply design systems in Stitch. Handles the two-step flow: upload DESIGN.md → `create_design_system_from_design_md`. Also applies design systems to existing screens via `apply_design_system`. |
| **design-md** | Analyze existing Stitch screens and synthesize a DESIGN.md from rendered HTML/screenshot. Use when you have a Stitch project with screens and want to extract the design language. |
| **extract-design-md** | Extract DESIGN.md from frontend **source code** (React, Vue, Angular, Tailwind config, CSS). Works without running the app — reads component files, stylesheets, and theme configs directly. |
| **taste-design** | Generate premium, anti-generic DESIGN.md files with strict typography, calibrated color, asymmetric layouts, and motion philosophy. Use for new projects or redesigns that need a distinctive aesthetic. |

### Code → Stitch Pipeline

| Skill | When to use |
|-------|-------------|
| **code-to-design** | Orchestrates the full pipeline: extract static HTML from running app → extract DESIGN.md from source → upload both to Stitch. Use when the user wants to "save", "migrate", or "upload" existing web apps into Stitch. |
| **extract-static-html** | Capture a self-contained HTML file from a running dev server (Puppeteer) or via browser interaction. Use standalone or as part of `code-to-design`. Supports auth-gated pages, canvas inlining, dark mode. |

### Upload & Iteration

| Skill | When to use |
|-------|-------------|
| **upload-to-stitch** | Upload local assets (images, HTML, markdown) to Stitch via Python script. Use when direct MCP calls fail or truncate due to base64 token limits. |
| **stitch-loop** | Autonomous baton-passing build loop: read `.stitch/next-prompt.md` → generate → integrate → write next prompt. Use for continuous, multi-screen site building. |

### Polish & Audit

| Skill | When to use |
|-------|-------------|
| **impeccable** | Design audit, critique, polish, and refinement. Covers UX review, visual hierarchy, accessibility, responsive behavior, theming, and anti-patterns. Use when the user wants to "review", "polish", "audit", or "improve" a UI. |

### Typical Workflows

**Generate a new screen:**
`enhance-prompt` → `generate-design` → `manage-design-system` (if no DS yet)

**Upload existing app to Stitch:**
`code-to-design` (chains `extract-static-html` → `extract-design-md` → `upload-to-stitch` → `manage-design-system`)

**Iterate on existing screens:**
`generate-design` (edit flow) → `manage-design-system` (apply DS to updated screens)

**Extract design system from code:**
`extract-design-md` → `manage-design-system`

**Polish/refine a design:**
`impeccable` → `generate-design` (edit flow) for targeted fixes
