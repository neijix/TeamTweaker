# TeamTweaker-Public - OpenCode Rules

## Project Purpose

Describe in 3-6 bullets what this project does and what OpenCode is expected to help with.

- [Primary business or technical goal]
- [Main technologies or subsystems]
- [Important integrations]

## Session Start

At the beginning of every new session, before anything else:

1. `git log --oneline -10` â€” see where the last agent left off
2. `git status` â€” check for uncommitted work
3. Read `.github/PROJECT_STATE.md` â€” get current state
4. If last commit starts with `wip:` â†’ tell the user what's in progress and ask to continue or start fresh

## Mandatory Reading

Read these files before making changes:

- `.github/copilot-instructions.md` - full AI directives
- `.github/PROJECT_STATE.md` - current state of the project
- `.github/KNOWLEDGE.md` - solutions, workarounds, and learned patterns
- `[README.md / docs/architecture.md / CONTRIBUTING.md]` - project-specific docs

## Critical Rules

1. After every meaningful change, update `.github/PROJECT_STATE.md`
2. Add non-obvious fixes, quirks, and workarounds to `.github/KNOWLEDGE.md`
3. Validate JSON after editing `.json` config files
4. Do not commit or expose secrets, tokens, or auth files
5. Follow existing project conventions before introducing new patterns

## Preferred Workflow

1. Read the relevant code and documentation first
2. Reuse existing patterns before inventing a new one
3. Make the smallest safe change that solves the problem
4. Verify the result with the appropriate command, test, or validation step
5. Update documentation before considering the task complete

## Project Notes

- Platform: [Windows / Linux / macOS / cross-platform]
- Primary language(s): [language list]
- Main framework(s): [framework list]
- Key commands: `[build]`, `[test]`, `[lint]`

## After Every Response (Checkpoint Policy)

Commit at the end of **every response** that modifies files â€” completed or in-progress.
This allows any agent on any platform to resume: `git log --oneline` + `git diff HEAD`.

1. Verify the change applied correctly
2. Update `.github/PROJECT_STATE.md` with the current state
3. Update `.github/KNOWLEDGE.md` if something useful was learned
4. **Commit**:
   - Completed: `git add -A && git commit -m "feat(scope): description"`
   - In-progress: `git add -A && git commit -m "wip(scope): step N/M â€” done; next: X"`
5. Confirm briefly: what changed, which docs updated, commit hash
