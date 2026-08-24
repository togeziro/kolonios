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

## Screen Inventory (visible — 34 screens)

Source of truth: `list_screens` + `get_project` (2026-08-25). 56 instances total — 34 visible, 22 hidden (junk/superseded). Status: ✅ built, 🔨 not built, ⚠️ partial/rework. Former 🔁 duplicates (Check-In Camera, Attendance History) have been hidden — none remain.

### Full Status Table

| # | Screen (Stitch title) | Role | Stitch ID | Code | Status | Route / Notes |
|---|---|---|---|---|---|---|
| 1 | Staff Dashboard *(canvas label: Technician Dashboard)* | Technician | `825687005653053145` | ✅ | ✅ | `/dashboard/overview` |
| 2 | My Work Tab (Self Service) Updated | Technician | `012328327b50470fbd7eabfa535bdaa9` | ✅ | ✅ | `/dashboard/my-work` |
| 3 | Office Tab (Admin Tools) Updated | Technician | `9ecc850bc59e4bc9b80374f868d6d329` | ✅ | ✅ | `/dashboard/overview` (role branch) |
| 4 | Notifications Center | Technician | `6f3b9df068d5464fad53ed61e507f36a` | ✅ | ✅ | `/dashboard/notifications` |
| 5 | Check-In (Scan) | Technician | `7bc70b1f52f14d8a9396af294a9d8226` | ✅ | ✅ | `/dashboard/attendance/check-in` — GPS + face, 2-step, server-side verification |
| 6 | Check-In Camera | Technician | `70bfea38378d4a409f826cef59a67ed7` | ✅ | ✅ | **Canonical** — Human.js overlay ("Updated Nav" variant + old duplicate merged into this one) |
| 7 | Check-In Success | Technician | `3865fd5865844fb0b9205fda8411e36e` | ✅ | ✅ | confirmation + badges (step inside check-in flow) |
| 8 | Attendance Settings | Technician | `63f4c490b78646fe8fa2e585b137490d` | ✅ | ✅ | `/dashboard/admin/attendance/face-settings` (`company_settings`) |
| 9 | Attendance Correction | Technician | `c0722b72b25d4c41a92abfb0bd95dcea` | ✅ | ✅ | `/dashboard/attendance` (sheet) |
| 10 | Attendance History (Updated Nav) | Technician | `4d7e6a77ed7b426c8171213b16233c6c` | ✅ | ✅ | `/dashboard/attendance` (plain duplicate hidden) |
| 11 | Work Session (Unified) Updated | Technician | `ce4727565dd047a59c2321bbe7f95dc1` | ✅ | ✅ | `/dashboard/work-session/$ticketId` — card-only unified design (2026-08-13 plan applied) |
| 12 | Work Session (Dynamic Materials) | Technician | `7843cb56a64943439bf4931b119abc21` | ✅ | ✅ | same route — materials/photos/log variant |
| 13 | Handoff Confirmation | Technician | `e51d1b51528a4d20aa991619870a3554` | ✅ | ✅ | `/dashboard/work-session/$ticketId/handoff` |
| 14 | Daily Checklist | Technician | `dfe2cb9b5f5d41178e2fcfa689642842` | ✅ | ✅ | `/dashboard/daily-checklist` — built (was 🔨) |
| 15 | En Route Navigation | Technician | `7ae5e1931b6447f0a288459e475aeb69` | ✅ | ✅ | `/dashboard/en-route/$ticketId` — MapLibre preview, TurfJS distance, Call Customer + Check + "I've Arrived" (`assigned → in_progress` + worklog; 2026-08-13 plan applied) |
| 16 | Open Tickets | Technician | `0d5eaf8a3d9949faa70a9053410c1394` | ✅ | ✅ | `/dashboard/jobs` (`jobs-page.tsx`) |
| 17 | Create Ticket | Technician | `5e2bad10cd2e4b9aa51882f3e8398e15` | ✅ | ✅ | `/dashboard/tickets/new` |
| 18 | Ticket Detail (Estafet) | Technician | `8249677bc1534273b953516abe08f92f` | ✅ | ✅ | `/dashboard/tickets/$ticketId` |
| 19 | Ticket Detail (Rework) — T-1042 | Technician | `eded27c72d42437a8045a53e0a988bda` | ✅ | ✅ | same route — rework branch |
| 20 | Ticket Completed — T-1042 | Technician | `a998bf52e0ff46639f97cefd15a5aabc` | ✅ | ✅ | `/dashboard/tickets/$ticketId/completed` |
| 21 | Next Leg Pool | Technician | `0287162f079f4432990f80e60dd911d8` | ✅ | ❌ | 🔨 no route — overlaps Available Jobs; decide fold-into-`/dashboard/jobs` vs dedicated route |
| 22 | My Leave | Technician | `4aa1e2266fd2403bb956095431a75a3f` | ✅ | ✅ | `/dashboard/leave` |
| 23 | Leave History | Technician | `8d99e4138b1b4babb86995896b257f85` | ✅ | ✅ | `/dashboard/leave` (tab) |
| 24 | New Leave Request | Technician | `3f6719fadfb84c89bbf8a61995b5ed25` | ✅ | ✅ | `/dashboard/leave` (sheet) |
| 25 | Holiday Calendar | Technician | `33ef66e1a8ac4d2d8a03c749e4e344c5` | ✅ | ✅ | `/dashboard/admin/holiday-calendar` |
| 26 | My Schedule | Technician | `a196d1449cce405e95faae5580c3dfda` | ✅ | ✅ | `/dashboard/schedule` |
| 27 | Profile Tab | Technician | `72f4ea705f42434c9a44c4467e265c7b` | ✅ | ⚠️ | `/dashboard/profile` — needs rework to match Stitch hierarchy |
| 28 | Edit Profile | Technician | `da378d2c145b4c1a8c4b9eb0347e81b5` | ✅ | ❌ | 🔨 no route (email locked) |
| 29 | Change Password | Technician | `0d4cd11e9dba4005bf1576050d3a9167` | ✅ | ❌ | 🔨 no route (strength meter + forgot link) |
| 30 | Settings | Technician | `1273bb2ab59445719ebf0212393dec62` | ✅ | ❌ | 🔨 mobile settings page — distinct from the nav-config "Settings" umbrella (`/dashboard/users` section) |
| 31 | Achievements | Technician | `b344f9d20b6b4a7da3c4cee288eae82f` | ✅ | ✅ | `/dashboard/achievements` |
| 32 | SPV Review Queue | SPV only | `63a5234536884300b5926838766ac035` | ✅ | ❌ | 🔨 nav-config `/dashboard/spv/review`, no route files (`src/routes/dashboard/spv/**` missing) |
| 33 | Review Ticket (SPV) | SPV only | `4a8827dd87cd428c9cc01c49c55a4fbf` | ✅ | ❌ | 🔨 planned `/dashboard/spv/review/$ticketId` |
| 34 | Leave Approvals Queue | SPV only | `fd0e56b8ee5d4c49a5c0cbe25d2bdb0b` | ✅ | ❌ | 🔨 nav-config `/dashboard/spv/leave-approvals`, no route files |

### Build Summary

| Role | Stitch visible | Code built | Code missing / rework | Duplicates to hide |
|------|---------------|------------|----------------------|-------------------|
| Technician | 31 | 26 | 4 🔨 + 1 ⚠️ | 0 |
| SPV | 31 + 3 = 34 | 26 + 0 | 4 + 3 = 7 🔨 + 1 ⚠️ | 0 |
| Admin/HR (desktop) | 9 | 6 | 2 🔨 + 1 ⚠️ | 0 |
| **Total unique** | **34 visible** (56 instances) | **~27 routes** (61 files in `src/routes/dashboard/**`) | **7 without route + 1 rework** | **0** |

### Unbuilt / Rework by Priority

| Priority | Screen | Blocker |
|---|---|---|
| 1 | Next Leg Pool | needs route (currently overlaps `/dashboard/jobs`) — decide fold-in vs dedicated page |
| 2 | SPV Review Queue | needs `src/routes/dashboard/spv/**` |
| 3 | Review Ticket (SPV) | needs evidence review + approve/reject |
| 4 | Leave Approvals Queue | needs `src/routes/dashboard/spv/**` |
| 5 | Settings (Mobile) | needs mobile settings route (distinct from the `/dashboard/users` umbrella section) |
| 6 | Change Password | needs route + strength meter + forgot link |
| 7 | Edit Profile | needs route (email locked) |
| 8 | Profile Tab rework | expand `profile-page.tsx` to Stitch hierarchy |
| 9 | Forgot Password flow | requires email provider |

> Old `docs/TODO.md` / `docs/TICKETS.md` refs removed — `docs/` now only contains `superpowers/`.

## Hidden Screens (junk — not counted, keep hidden)

Hidden screens are deleted/experimental/superseded — ignore them entirely:
- Working (On Site) — superseded by Work Session (Unified) Updated (2026-08-13 task-flow plan)
- Working (Non-Location) — folded into the unified card-only Work Session design
- Face Enrollment — hidden; covered by `/dashboard/attendance/face-settings` (self-service enrollment)
- Attendance History (plain) + old Check-In Camera duplicate — duplicates cleaned up
- Technician Dashboard (alternate) — old role-branch screen; the canvas now shows a relabeled instance of Staff Dashboard
- Various experiment variants

## Notes

- 2026-08-25 refresh: Daily Checklist is now built (`/dashboard/daily-checklist`); the
  2026-08-13 technician-task-flow Stitch edits are verified applied (En Route Call
  Customer + Check actions, unified Work Session, On Site / Non-Location hidden);
  remaining gap = 7 unbuilt routes + Profile Tab rework.
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
