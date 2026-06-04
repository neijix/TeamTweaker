# TeamTweaker-Public â€” Gemini / Antigravity Context

## Project Overview

- **Type**: [Web App / API / Desktop App / DevOps / Data Science / etc.]
- **Language**: [JavaScript/Python/C#/Java/etc.]
- **Framework**: [React/Django/FastAPI/.NET/etc.]
- **Platform**: [Windows / Linux / macOS / cross-platform]

## Session Start

At the beginning of every new session, before anything else:

1. `git log --oneline -10` â€” see where the last agent left off
2. `git status` â€” check for uncommitted work
3. Read `.github/PROJECT_STATE.md` â€” get current state
4. If last commit starts with `wip:` â†’ tell the user what's in progress and ask to continue or start fresh

## Mandatory Reading

Before making any changes, read these files **in order**:

1. `.github/copilot-instructions.md` â€” full AI directives and post-task checklist
2. `.github/PROJECT_STATE.md` â€” current state of the project (architecture, features, config)
3. `.github/KNOWLEDGE.md` â€” solutions, workarounds, and learned patterns

These three files are the **single source of truth**. Do not duplicate their content; reference them.

## Project Purpose

- [Primary business or technical goal]
- [Main technologies or subsystems]
- [Important integrations]

## Directory Map

```
/project-root/
â”œâ”€â”€ .github/
â”‚   â”œâ”€â”€ copilot-instructions.md    # Master AI rulebook
â”‚   â”œâ”€â”€ PROJECT_STATE.md           # Current state documentation
â”‚   â”œâ”€â”€ KNOWLEDGE.md               # Solutions and learnings database
â”‚   â””â”€â”€ instructions/              # VS Code Copilot scoped instructions
â”œâ”€â”€ src/                           # Source code
â”œâ”€â”€ tests/                         # Test files
â”œâ”€â”€ config/                        # Configuration files
â”œâ”€â”€ .env.example                   # Environment variables template
â””â”€â”€ README.md                      # Project overview
```

## Orchestrator-Worker Protocol â€” Gemini Implementation

Apply the Orchestrator-Worker Protocol from `.github/copilot-instructions.md`:

1. **Route by model capability**:
   - **Gemini Pro / Ultra / 2.0** â†’ orchestration: architecture, security, complex reasoning, API design
   - **Gemini Flash** â†’ worker tasks: boilerplate, formatting, renaming, test stubs, JSDoc, CRUD
2. For any task with 3+ steps, output the decomposition JSON before executing
3. Keep worker task context minimal â€” pass only the task description + required file content

Worker tasks: boilerplate, CRUD, renaming, formatting, JSDoc, test stubs, simple config edits.
Orchestrator tasks: architecture, security decisions, complex debugging, API design.

## Critical Rules

1. **After every change**, update `.github/PROJECT_STATE.md` with the current state
2. **After learning something new**, add it to `.github/KNOWLEDGE.md`
3. Validate JSON after editing any `.json` config file
4. Never commit secrets, API keys, passwords, or tokens
5. Follow existing project conventions before introducing new patterns
6. Ask questions only when ambiguity materially changes the outcome

## Post-Response Checklist â€” Checkpoint Policy

Commit at the end of **every response** that modifies files â€” completed or in-progress.
This allows any agent on any platform to resume: `git log --oneline` + `git diff HEAD`.

1. âœ… Verify the change applied correctly (syntax, lint, tests)
2. âœ… Update `.github/PROJECT_STATE.md` â€” current state only, **not** a changelog
3. âœ… Update `.github/KNOWLEDGE.md` if a non-obvious solution was found
4. âœ… **Commit** every response:
   - Completed: `git add -A && git commit -m "feat(scope): description"`
   - In-progress: `git add -A && git commit -m "wip(scope): step N/M â€” done; next: X"`
5. âœ… Confirm briefly: what changed, which docs updated, commit hash

## Preferred Workflow

1. Read the relevant code and documentation first
2. Reuse existing patterns before inventing a new one
3. Make the smallest safe change that solves the problem
4. Verify the result with the appropriate command, test, or validation step
5. Update documentation before considering the task complete

## Key Commands

```bash
# Development
[start command]

# Build
[build command]

# Test
[test command]

# Lint
[lint command]
```

## Notes

- [Project-specific quirks, requirements, or context]
