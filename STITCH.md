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

## Screen Inventory (visible)

33 visible screens. Grouped by role and navigation order — reorder in the
Stitch UI. Status: ✅ built, 🔨 unbuilt. See `docs/TICKETS.md` for codebase
implementation status, `docs/TODO.md` for build order.

---

### Technician screens (mobile — MobileShell)

All screens below are **technician-only**. SPV also has all of these + review
tools (see "SPV-only" section).

#### Dashboard / Home
- ✅ Staff Dashboard (technician branch)
- ✅ My Work Tab (Self Service) Updated
- ✅ Office Tab (Admin Tools) Updated
- ✅ Notifications Center

#### Attendance / Work Session
- ✅ Check-In (Scan) — GPS + face card, 2-step flow (`/dashboard/attendance/check-in`)
- ✅ Check-In Camera — Face capture with Human.js live overlay
- ✅ Check-In Success — Confirmation screen with status badges
- ✅ Attendance Correction
- ✅ Attendance History
- ✅ Work Session (Unified) Updated
- ✅ Work Session (Dynamic Materials)
- 🔨 **Daily Checklist** — checklist items with status/photo/note, progress, submit for review
- ✅ Handoff Confirmation
- 🔨 **En Route Navigation** — MapLibre map, route line, call customer, "I've Arrived"
- 🔨 **Working (On Site)** — on-site state of the session: map + task card + Finish & Submit (folded into work-session route)

#### Tickets / Jobs
- 🔨 **Open Tickets** — filter chips (All/Field/Backoffice), priority badges, Take button
- ✅ Create Ticket
- ✅ Ticket Detail (Estafet)
- ✅ Ticket Detail (Rework) — T-1042
- ✅ Ticket Completed — T-1042
- 🔨 **Next Leg Pool** — filterable available next legs with Take

#### Leave / Schedule
- ✅ My Leave
- ✅ Leave History
- ✅ New Leave Request
- ✅ Holiday Calendar
- ✅ My Schedule

#### Profile / Settings
- ✅ Profile Tab
- 🔨 **Edit Profile** — personal info editable, email locked, work info read-only
- 🔨 **Change Password** — current/new/confirm, strength meter, "Forgot password?" link
- 🔨 **Settings (Mobile)** — profile card, preferences (language/theme/notifications), account, danger zone
- ✅ Achievements

---

### SPV-only screens (mobile — MobileShell, `spv_review` permission)

SPV sees **all technician screens above** + these review/approval screens:

#### Tickets / Jobs
- 🔨 **SPV Review Queue** — pending summary strip, review cards, approve/reject
- 🔨 **Review Ticket (SPV)** — evidence review (photos, summary, materials, SOP), approve/reject

#### Leave / Schedule
- 🔨 **Leave Approvals Queue** — summary pills, segmented tabs, approve/reject

---

### Admin / HR screens (desktop sidebar)

Admin/HR keep current desktop pages. Stitch mobile versions are not built
for backoffice.

#### Dashboard / Home
- ✅ Staff Dashboard (admin/HR branch)

#### Attendance
- ✅ Attendance Settings — face validation config (native UI component `<FaceSettings />`)

#### Tickets / Jobs
- ✅ Create Ticket
- ✅ Ticket Detail

#### Leave / Schedule
- ✅ Holiday Calendar (`/dashboard/admin/holiday-calendar`)

#### Profile / Settings
- ✅ Profile Tab
- 🔨 Edit Profile
- 🔨 Change Password
- 🔨 Settings

---

## Build Summary

| Role | Built | Unbuilt | Total |
|------|-------|---------|-------|
| Technician | 24 | 8 | 32 |
| SPV | 24 + 0 | 8 + 3 | 35 |
| Admin/HR (desktop) | 7 | 3 | 10 |

### Unbuilt screens by priority (from `docs/TODO.md`)

**Phase 1 — remaining:**
1. Open Tickets (technician + SPV + admin)

**Phase 2 — field work session (technician + SPV):**
2. Daily Checklist
3. En Route Navigation
4. Working (On Site)
5. Next Leg Pool

**Phase 3 — SPV-only:**
6. SPV Review Queue
7. Review Ticket (SPV)
8. Leave Approvals Queue

**Phase 3 — self-service (technician + SPV + admin):**
9. Settings (Mobile)
10. Change Password
11. Edit Profile
12. Profile Tab rework

**Cross-cutting:**
13. Forgot Password flow (all roles — requires email provider)

## Hidden Screens (junk — not counted)

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
