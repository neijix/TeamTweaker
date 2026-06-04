# TeamTweaker-Public â€” Claude Code Context

<!-- Files loaded automatically by Claude Code -->
@.github/copilot-instructions.md
@.github/PROJECT_STATE.md
@.github/KNOWLEDGE.md

---

## Claude Code â€” Behavioral Notes

The directives in `.github/copilot-instructions.md` govern this session. This section maps them to Claude Code's execution model.

### `.claude/` Structure â€” Plugin System

```
.claude/
â”œâ”€â”€ settings.json          # Pre-authorized commands and permissions
â””â”€â”€ commands/
    â””â”€â”€ learn.md           # /learn â€” extract conversation insights â†’ KNOWLEDGE.md
```

**Adding custom slash commands:** create a `.md` file in `.claude/commands/` with this frontmatter:

```markdown
---
description: What this command does and when to use it
argument-hint: [optional: describes $ARGUMENTS]
model: opus          # opus | sonnet | haiku
allowed-tools: Read, Write, Edit, Glob, Grep
---
```

**Available slash commands in this project:**

| Command | Description |
|---|---|
| `/learn [topic]` | Analyze the current conversation and save non-obvious insights to `.github/KNOWLEDGE.md`. Uses Opus. |

### Orchestrator-Worker â€” Claude Code Implementation

Apply the Orchestrator-Worker Protocol from `copilot-instructions.md` using Claude Code's native `Agent` tool:

```
# Low-complexity worker task â†’ spawn Haiku sub-agent
Agent(subagent_type="haiku", prompt="[worker task description + inputs]")

# Medium task â†’ spawn Sonnet sub-agent
Agent(subagent_type="sonnet", prompt="[task]")

# Run independent worker tasks in parallel (single message, multiple Agent calls)
```

**Rules for sub-agents:**
- Pass all required context in the prompt â€” sub-agents start cold with no conversation history
- Run independent tasks in parallel (single message, multiple Agent calls)
- Never spawn a sub-agent for tasks under 2 minutes â€” direct execution is faster
- Haiku for: boilerplate, formatting, renaming, JSDoc, simple config edits, test stubs
- Sonnet/current model for: architecture, security, complex debugging, design decisions

### Pre-Authorized Commands

The following commands are pre-authorized via `.claude/settings.json` and run without prompting:

| Command | Purpose |
|---|---|
| `git init` | Bootstrap â€” initialize repo if absent |
| `git add -A` / `git add .` | Stage changes after completing a task |
| `git commit -m "..."` | Commit with Conventional Commit message |
| `git status` / `git log` / `git diff` | Read-only Git inspection |
| `git branch` / `git checkout` / `git switch` | Branch management |
| `git stash` / `git fetch` / `git pull` / `git push` | Remote sync |

For project-specific commands (build, test, lint), add them to `.claude/settings.json`.

### Session Start

At the beginning of every new session, before anything else:

1. `git log --oneline -10` â€” see where the last agent left off
2. `git status` â€” check for uncommitted work
3. Read `.github/PROJECT_STATE.md` â€” get current state
4. If last commit starts with `wip:` â†’ tell the user what's in progress and ask to continue or start fresh

### Bootstrap Mode

**Trigger**: Any `[BRACKETED]` placeholder still exists in this file, `PROJECT_STATE.md`, or `KNOWLEDGE.md`.

Execute automatically, in order:

1. Scan `package.json`, `requirements.txt`, `*.csproj`, `Dockerfile`, `go.mod`, `Cargo.toml`, and key source files to identify language, framework, platform, entry points, and architecture
2. Fill all `[BRACKETED]` placeholders in `.github/copilot-instructions.md`, `PROJECT_STATE.md`, and `KNOWLEDGE.md`
3. Run `git init` if no `.git` directory exists, then create a `.gitignore` for the detected stack
4. Commit: `git add -A && git commit -m "docs: bootstrap project documentation"`
5. Report what was discovered; flag any items requiring human input (secrets, URLs, credentials)

### Post-Task Checklist â€” Checkpoint Policy

Commit at the end of **every response** that modifies files, whether the task is complete or not.
This is the cross-provider continuity mechanism: if context/tokens run out, any agent can run
`git log --oneline` + `git diff HEAD` to resume where you left off.

1. Verify the change (syntax, lint, tests if applicable)
2. Update `.github/PROJECT_STATE.md` if structure or features changed
3. Update `.github/KNOWLEDGE.md` if a non-obvious solution was found
4. **Commit** â€” always, every response:
   - Completed task: `git add -A && git commit -m "feat(scope): description"`
   - In-progress task: `git add -A && git commit -m "wip(scope): step N/M â€” done; next: X"`
5. Briefly confirm: what changed, which docs were updated, commit hash

Skipping the commit means the task is incomplete.
