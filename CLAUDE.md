# Claude Code Context

<!-- Claude Code reads CLAUDE.md, not AGENTS.md; this @import is the bridge. Everything imported
     here is loaded into every session, so keep it lean: KNOWLEDGE.md is searched on demand. -->
@AGENTS.md
@.github/PROJECT_STATE.md

---

## Claude Code notes

- Skip steps 1 and 2 of the AGENTS.md session start (still read `PROJECT_STATE.md`): the
  `SessionStart` hook already refreshed the shared AI files (it prints an `ai-sync: refreshed`
  line only when something changed; an `ai-sync: dev-context` line is not a file change) and the
  harness already injects git status and recent commits (still
  mention uncommitted work or a `wip:` HEAD). Those files — this
  one, `.claude/settings.json`, `.claude/agents/*`, `.claude/commands/*`,
  `.antigravity/rules.md`, `.gemini/settings.json`, `.github/copilot-instructions.md`,
  `.github/agents/*` — are copies: edit the `*.template` in the AICodeFactory repo
  (`$AI_CODE_ROOT/AICodeFactory`), never the copy. If the hook reported the template as not found,
  say so once and carry on.
- Project-specific command permissions go in `.claude/settings.local.json`; the sync overwrites
  `.claude/settings.json` and gitignores the `.local.json`, so per-machine permissions stay on
  this machine.
- If `CLAUDE.local.md` exists, it is this code root's dev-context (`neijix` under a directory
  named `Code`, `ubisoft` under `UbisoftCode`): development rules from AppsSync,
  gitignored. Follow it. Do not apply the other root. Edit the AppsSync pack, not this copy.
