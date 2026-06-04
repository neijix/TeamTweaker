---
description: Analyze the conversation for learnings and save them to KNOWLEDGE.md
argument-hint: [optional topic hint]
model: opus
allowed-tools: Read, Write, Edit, Glob, Grep, AskUserQuestion
---

# Learn from Conversation

Analyze this conversation for insights worth preserving in `.github/KNOWLEDGE.md`.

**If a topic hint was provided via `$ARGUMENTS`, focus on capturing that specific learning.**
**If no hint provided, analyze the full conversation for valuable insights.**

## Phase 1: Deep Analysis

Think carefully about what was learned in this conversation:
- What non-obvious patterns or approaches were discovered?
- What gotchas or pitfalls were encountered?
- What architecture or design decisions were made and why?
- What conventions or standards were established?
- What debugging solutions or workarounds were found?
- What tool-specific behavior was discovered (Claude Code, Copilot, Cursor, Antigravity, etc.)?

Only capture insights that are **all three** of:
1. **Reusable** â€” will help in future similar situations
2. **Non-obvious** â€” not already common knowledge or derivable from reading the code
3. **Project-relevant** â€” applies to this codebase or workflow

If nothing valuable was learned, say so and stop.

## Phase 2: Categorize and Locate

Read `.github/KNOWLEDGE.md` to find the right category for the learning.

Common categories already in use:
- Architecture & Design
- Debugging & Troubleshooting
- Tooling & Configuration
- Security & Credentials
- AI Agent Behavior
- Performance & Optimization
- Gotchas & Pitfalls

If no existing category fits, propose a new one with a kebab-case heading.

**Note:** `.github/copilot-instructions.md` is the master rulebook â€” it stays stable. All detailed learnings go to `KNOWLEDGE.md` only.

## Phase 3: Draft the Learning

Format the insight to match the existing style in `KNOWLEDGE.md`:

```markdown
### [Short descriptive title]

**Context:** When does this apply?
**Insight:** What was learned?
**How to apply:** What should be done differently because of this?
```

Include code examples where they clarify the insight. Be concise â€” one clear entry, not a paragraph dump.

## Phase 4: User Approval (BLOCKING)

Present the proposed change:
1. The insight identified
2. Where it will be saved (category + section in KNOWLEDGE.md)
3. The exact content to add

**Wait for explicit user approval before saving.**

## Phase 5: Save

After approval:
1. Edit `.github/KNOWLEDGE.md` â€” add the entry under the appropriate category
2. Confirm: "Saved to KNOWLEDGE.md under [Category] â€” [title]"
