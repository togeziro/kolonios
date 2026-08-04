# Code Quality Review Skill Design

## Status

Proposed design for review.

## Overview

A new agent skill, `code-quality-review`, that audits source code against seven
quality concepts: Clean Code, Dead Code, Code Smells, Technical Debt, Spaghetti
Code, Magic Numbers / Magic Strings, and Boilerplate Code. The skill is
triggered when the user asks to review, audit, refactor, or clean up code, or to
find specific anti-patterns. It scans a file, a glob pattern, or the whole
codebase, classifies findings by priority, and reports them in a summary plus a
table.

The target audience is the agent operating in this repository (TanStack / TS /
JS / React), but the seven concepts are language-agnostic. Each concept carries
one TS/JS example for detection, so the skill works generally while staying
concrete in this codebase.

## Scope

The skill is a documentation-only skill (SKILL.md). No scripts, no heuristics.
Detection relies on the agent reading files plus CodeGraph for dead-code and
call-path analysis, because most of the seven concepts require judgment rather
than regex.

Included:
- Seven-concept reference table (definition + TS detection example + fix).
- Five-step audit workflow.
- Priority classification (High / Medium / Low).
- Output format: summary + findings table (`# | Lokasi | Konsep | Prioritas |
  Detail | Saran`).
- CodeGraph integration for symbol lookup and flow tracing.
- Common mistakes section and a quick-reference detection table.

Not included:
- External scanner script or regex heuristics.
- Language-specific variants beyond TS/JS examples.
- Auto-rewriting of code (the skill reports; it does not modify).

## Location

`~/.agents/skills/code-quality-review/SKILL.md`

A design doc is kept in this repo (`docs/superpowers/specs/`) per project
convention, but the skill itself lives outside the repo in the user's cross-
runtime skills directory.

## Skill Structure

1. **Frontmatter** — `name: code-quality-review`; `description` starts with
   "Use when…" and lists triggering symptoms (review, audit, refactor, clean up,
   dead code, code smells, magic numbers/strings, spaghetti, boilerplate). No
   workflow summary in the description.
2. **Overview** — core principle in 1-2 sentences.
3. **Workflow** — five steps:
   1. Resolve target (file/pattern from user, or offer to scan whole repo).
   2. Build context with CodeGraph (`codegraph explore` / `files` / `query`).
   3. Scan the seven concepts; each uses its own detection method.
   4. Classify priority (impact x frequency x risk).
   5. Output summary + findings table.
4. **Seven concepts** — table with definition, detection example, and fix.
5. **Priority criteria** — how to assign High / Medium / Low.
6. **CodeGraph integration** — the specific commands and when to use each.
7. **Output format template** — summary + table.
8. **Common mistakes** — over-reporting, false positives, missing severity.
9. **Quick reference** — detection-method-per-concept table.

## Seven Concepts Reference

| # | Concept | Detection approach |
|---|---------|--------------------|
| 1 | Clean Code | Read for clarity, readability, naming, single responsibility |
| 2 | Dead Code | CodeGraph `query`/`node` for symbols with no callers/dependents |
| 3 | Code Smells | Read for structural surface issues (long methods, god objects) |
| 4 | Technical Debt | Grep TODO/FIXME/HACK comments + shortcut smells |
| 5 | Spaghetti Code | Read + CodeGraph call paths for tangled control flow |
| 6 | Magic Numbers/Strings | Grep literals + judgment on whether a constant is warranted |
| 7 | Boilerplate Code | Read for repetitive sections; propose helper/generator |

## Priority Criteria

- **High** — breaks behavior, high frequency, high risk to change.
- **Medium** — reduces maintainability, moderate frequency/risk.
- **Low** — minor style/convention issues.

Rule: a finding that changes runtime behavior is never Low; a pure style nit is
never High.

## CodeGraph Integration

- `codegraph explore <file>` — read a target file's structure before auditing.
- `codegraph files` — list project files when the user wants a whole-repo scan.
- `codegraph query <symbol>` — find symbols; useful to confirm usage.
- `codegraph node <symbol>` / `explore` — detect dead code (no callers) and
  trace tangled flow.

If `.codegraph/` is absent, fall back to grep/read and note the fallback.

## Output Format

```
## Ringkasan
- Cakupan: <file/pattern>
- Temuan: 3 Tinggi · 2 Sedang · 1 Rendah

## Temuan
| # | Lokasi | Konsep | Prioritas | Detail | Saran |
|---|--------|--------|-----------|--------|-------|
| 1 | file:line | Magic Number | Tinggi | detail | saran |
```

## Acceptance Criteria

Used as a checklist for the skill.

- [ ] Triggered by the symptom phrases in `description`.
- [ ] Resolves a user-specified file/pattern, or offers whole-repo scan.
- [ ] Audits all seven concepts.
- [ ] Each finding has location (`file:line`), concept, priority, detail, fix.
- [ ] Output is summary + table with High/Medium/Low counts.
- [ ] Uses CodeGraph for dead code and flow tracing when available.
- [ ] Falls back to grep/read when `.codegraph/` is absent.
- [ ] Descriptions never summarize the skill workflow.