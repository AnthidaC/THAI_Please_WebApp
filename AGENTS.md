# THAI_Please_WebApp — Agent Instructions

These instructions apply to Codex and delegated coding agents working in this repository. Follow the user's request and existing project conventions first. Skill instructions supplement these rules; they do not authorize unrelated changes.

## Skills — automatic routing

Use **only** the following two skills when applicable:

- Vercel `web-design-guidelines`: https://github.com/vercel-labs/agent-skills/blob/main/skills/web-design-guidelines/SKILL.md
- Claude `frontend-design`: https://github.com/anthropics/claude-code/blob/main/plugins/frontend-design/skills/frontend-design/SKILL.md

Before using a skill, read its actual `SKILL.md` from the installed skill location. Codex project skills commonly live at `.agents/skills/<skill-name>/SKILL.md`, but use the path exposed by the environment. A reference in this file does not install a skill. If a required skill is unavailable, state that fact and follow the relevant principles below; never claim it was executed.

| Task | Skill | Action |
| --- | --- | --- |
| New page, component, or substantial visual redesign | `frontend-design` → `web-design-guidelines` | Design and implement, then audit affected UI. |
| Small UI change or visual fix | `web-design-guidelines` | Preserve the current design and audit the change; use `frontend-design` only if new design decisions are needed. |
| UI/UX or accessibility review only | `web-design-guidelines` | Report findings without editing code unless requested. |
| Backend, data, infrastructure, or non-UI work | None | Follow repository conventions and validate relevant behavior. |

Do not require, invoke, or delegate other skills or graph tools as part of this workflow unless the user explicitly requests them.

## Claude frontend-design — creating or redesigning UI

Read and follow the installed `frontend-design` skill before design work.

1. Understand the page purpose, audience, current design system, branding, actual content, and surrounding screens.
2. Choose a clear visual direction for substantial work: typography, color palette, spacing, hierarchy, and one intentional distinguishing feature. For narrow fixes, retain the existing design direction.
3. Avoid generic layouts, unnecessary gradients, excessive cards, decorative headings, and gratuitous animations. Keep the application visually consistent.
4. Implement within existing React, TypeScript, Tailwind, and component conventions when applicable. Reuse design tokens and components; do not add dependencies solely for appearance.
5. Account for responsive behavior, keyboard interactions, focus states, contrast, and reduced-motion preferences during implementation.
6. When browser/visual verification is available, inspect mobile and desktop results. Otherwise report visual checks as unverified.

## Vercel web-design-guidelines — UI quality gate

Read and follow the installed `web-design-guidelines` skill. When network access is available, fetch the current official checklist from https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md before auditing. If unavailable, do not claim the audit used the latest guidelines.

- After UI implementation, audit the affected UI files. For review-only requests, audit the files or pages specified by the user.
- Check semantic HTML, accessible names, keyboard support, visible focus, form feedback, interaction target sizes, responsiveness, readable copy, images, motion preferences, performance, and locale formatting where applicable.
- For review-only tasks, return actionable findings with precise `file:line` references using the skill's required format. Do not edit code unless requested.
- For implementation tasks, fix in-scope findings and report any remaining issues with file locations. Avoid unrelated rewrites.

## Default workflow

1. **Understand:** Identify whether the task needs either skill. Read applicable `SKILL.md` files and inspect relevant source code.
2. **Plan:** Identify affected files, dependencies, and regression risks. Define a visual direction when substantial UI design is involved.
3. **Implement:** Follow existing architecture and make focused, coherent changes without unrelated refactors.
4. **Validate:** Run applicable tests, TypeScript checks, lint, and builds. For UI changes, apply `web-design-guidelines` and inspect rendered mobile/desktop views when possible. Never claim checks ran if they did not.
5. **Report:** Summarize changed files, decisions, validation results, and outstanding issues.

## Delegation and precedence

- In subagent instructions, name only the applicable skill(s) from this file and require reading their actual `SKILL.md` files.
- User requirements, security, correctness, accessibility, and repository conventions take precedence over visual novelty.
- `frontend-design` guides substantial UI design; `web-design-guidelines` reviews the UI's quality and accessibility.
- Do not change application code solely to satisfy a skill or make an audit appear cleaner.
