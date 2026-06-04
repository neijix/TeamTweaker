# TeamTweaker-Public â€” Google Antigravity Rules

## Project Overview

- **Type**: [Web App / API / Desktop App / DevOps / Data Science / etc.]
- **Language**: [JavaScript/Python/C#/Java/etc.]
- **Framework**: [React/Django/FastAPI/.NET/etc.]
- **Platform**: [Windows / Linux / macOS / cross-platform]

## Mandatory Reading

Before making any changes, read these files in order:

1. `.github/copilot-instructions.md` â€” full AI directives, post-task checklist, and credential protocol
2. `.github/PROJECT_STATE.md` â€” current state of the project
3. `.github/KNOWLEDGE.md` â€” solutions, workarounds, and learned patterns

These three files are the single source of truth. Do not duplicate their content here.

## Orchestrator-Worker Protocol â€” Google Antigravity Implementation

Apply the Orchestrator-Worker Protocol from `.github/copilot-instructions.md`. In Antigravity:

1. **Route by complexity**:
   - **Gemini Pro / Ultra** â†’ orchestration: architecture, security, complex reasoning
   - **Gemini Flash** â†’ worker tasks: boilerplate, formatting, renaming, test stubs, JSDoc, CRUD scaffolding
2. **Plan before executing**: For 3+ step tasks, output the decomposition JSON first
3. **Minimize context for worker agents**: Pass only the task description + required inputs â€” no full conversation history

Worker tasks are: boilerplate, CRUD, renaming, formatting, JSDoc, test stubs, simple config edits.
Orchestrator tasks are: architecture, security decisions, complex debugging, API design.

## Critical Rules

1. After every change â†’ update `.github/PROJECT_STATE.md` (current state only, never a changelog)
2. After learning something new â†’ add it to `.github/KNOWLEDGE.md`
3. Validate JSON after editing any `.json` file
4. Never commit secrets, API keys, or tokens â€” use SecretStore or registry (see credential protocol in copilot-instructions.md)
5. Follow existing patterns before creating new ones
6. Ask clarifying questions only when ambiguity materially changes the outcome
7. Prefer PowerShell syntax for automation scripts on Windows projects

## Coding Conventions

- Variables: [camelCase/snake_case/PascalCase]
- Functions: [camelCase/snake_case]
- Classes: [PascalCase]
- Files: [kebab-case/snake_case/PascalCase]
- Indentation: [2/4] spaces
- Comments: explain WHY not WHAT

## Post-Response Checklist â€” Checkpoint Policy

Commit at the end of **every response** that modifies files â€” completed or in-progress.
This is the cross-provider continuity mechanism: any agent (Claude, Copilot, Cursor, Windsurf, Antigravity, Gemini) can resume with `git log --oneline` + `git diff HEAD`.

1. Verify the change (syntax, lint, tests if applicable)
2. Update `.github/PROJECT_STATE.md`
3. Update `.github/KNOWLEDGE.md` if a non-obvious solution was found
4. **Commit** every response:
   - Completed: `git add -A && git commit -m "feat(scope): description"`
   - In-progress: `git add -A && git commit -m "wip(scope): step N/M â€” done; next: X"`
5. Confirm briefly: what changed, which docs updated, commit hash

## Key Commands

- Development: `[start command]`
- Build: `[build command]`
- Test: `[test command]`
- Lint: `[lint command]`

## Notes

- [Project-specific quirks or context]
