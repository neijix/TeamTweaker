# === MANDATORY AI DIRECTIVES FOR TeamTweaker-Public ===

**PROJECT TYPE**: [Web App / API / Desktop App / DevOps / Data Science / etc.]
**PRIMARY LANGUAGE**: [JavaScript/Python/C#/Java/etc.]
**FRAMEWORK**: [React/Django/FastAPI/.NET/etc.]

**CRITICAL MISSION:** You must read, understand, and **strictly** follow all rules in this document before writing, modifying, or configuring any code, documentation, or infrastructure.

---

## BOOTSTRAP MODE â€” Execute Once When Documentation Has Placeholders

**Trigger**: Any `[BRACKETED]` placeholder still exists in this file, `PROJECT_STATE.md`, or `KNOWLEDGE.md`.

**Execute automatically, without waiting to be asked:**

1. **Initialize Git** â€” If no `.git` directory exists, run `git init` and create a `.gitignore` appropriate for the detected language/framework
2. **Scan the codebase** â€” Read `package.json`, `requirements.txt`, `*.csproj`, `Dockerfile`, `README.md`, `go.mod`, `Cargo.toml`, and key source files to identify: language, framework, platform, dependencies, entry points, and architecture
3. **Fill this file** â€” Replace all `[BRACKETED]` placeholders with discovered values (project type, language, framework, conventions, key commands, etc.)
4. **Write `.github/PROJECT_STATE.md`** â€” Fill in: what the project does, architecture overview, active features, key commands, required env vars, known limitations, and anything that would surprise an agent reading the code cold. No history, no dates â€” Git handles that.
5. **Initialize `.github/KNOWLEDGE.md`** â€” Add entries for any non-obvious patterns, configs, or decisions discovered during the scan
6. **Commit** â€” `git add -A && git commit -m "docs: bootstrap project documentation"` to capture the baseline state
7. **Report** â€” Briefly list what was discovered and filled in, and flag any placeholders that require human input (credentials, URLs, secrets)

**This is a one-time bootstrap.** Once all placeholders are filled, follow the normal post-task workflow below.

---

## 0. MANDATORY POST-TASK CHECKLIST (EXECUTE AUTOMATICALLY - NO EXCEPTIONS)

**CRITICAL**: After EVERY modification, you MUST complete this checklist IN THE SAME RESPONSE. Do NOT wait for user reminder. Do NOT ask permission.

### When to Execute This Checklist:
- âœ… After creating/modifying code files
- âœ… After adding/configuring dependencies or packages
- âœ… After changing configuration files
- âœ… After implementing new features
- âœ… After fixing bugs or refactoring
- âœ… After modifying documentation
- âœ… After infrastructure/deployment changes

### Mandatory Steps (Execute Automatically):

1. **Verify Change Applied**
   - Confirm the technical modification was successful
   - Check for syntax errors, linting issues, or compilation errors
   - Verify tests pass (if applicable)

2. **UPDATE PROJECT_STATE.md IF STRUCTURE CHANGED**
   - Open `.github/PROJECT_STATE.md`
   - Update only if: architecture changed, feature added/removed, command changed, new env var, new AI context to note
   - **Do NOT add history or dates â€” use `git log` for that**
   - Keep it to what an agent cannot derive from reading the code in 10 seconds

3. **UPDATE KNOWLEDGE.md IF NEEDED** (WHEN LEARNING SOMETHING NEW)
   - If you solved a tricky problem â†’ Document the solution
   - If you discovered a pattern/best practice â†’ Add it
   - If you found a workaround â†’ Explain why and how
   - If you learned how something works â†’ Document it
   - **Purpose**: Create searchable institutional memory

4. **COMMIT TO GIT AFTER EVERY RESPONSE** (NON-NEGOTIABLE â€” CHECKPOINT POLICY)

   Commit at the end of **every response** that modifies files â€” whether the task is complete or not.
   This is the cross-provider continuity mechanism: if context/tokens run out mid-task, any agent on any
   platform can run `git log --oneline` + `git diff HEAD` to resume exactly where you left off.

   **Completed task** â€” use Conventional Commits:
   ```
   git add -A && git commit -m "feat(auth): add JWT refresh token rotation"
   ```
   Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

   **In-progress / multi-step task** â€” use `wip:` with a resume hint:
   ```
   git add -A && git commit -m "wip(auth): step 2/4 â€” token generation done; next: implement rotation"
   ```
   The commit message must be enough for a fresh agent to continue without rereading the conversation.

5. **Confirm to User**
   - Briefly confirm what was changed
   - Mention which documentation files were updated and the commit hash
   - NO lengthy explanations unless asked

### Examples of When This MUST Happen:

**Example 1: Feature Implementation**
```
User: "Add user authentication"
AI: [Implements auth] â†’ Updates PROJECT_STATE.md â†’ Updates KNOWLEDGE.md with auth patterns â†’ Confirms
```

**Example 2: Bug Fix**
```
User: "Fix the login timeout issue"
AI: [Fixes bug] â†’ Updates PROJECT_STATE.md â†’ Documents solution in KNOWLEDGE.md â†’ Confirms
```

**Example 3: Configuration Change**
```
User: "Update database connection settings"
AI: [Changes config] â†’ Updates PROJECT_STATE.md â†’ Confirms
```

### Failure to Execute = Critical Error

If you complete a task without updating documentation, you have FAILED the task. Treat documentation updates with the same priority as the technical change itself.

---

## 1. Core Philosophy

1.  **[Language] Only:** ALL code, variables, functions, classes, comments, and documentation MUST be written in [English/French/etc.]. No exceptions for [specify if mixed language allowed for specific things].

2.  **Code Organization:** 
    - Follow [Framework/Language] best practices and conventions
    - Use clear, descriptive naming conventions
    - Organize code by [feature/layer/domain/other]
    - Keep files focused and under [X] lines when possible

3.  **Documentation Standards:**
    - Every function/method must have clear documentation
    - Complex logic must have inline comments explaining WHY, not WHAT
    - README files for each major component/module
    - API endpoints must be documented with examples

4.  **Error Handling:**
    - Always handle errors gracefully
    - Provide meaningful error messages
    - Log errors appropriately for debugging
    - Never fail silently

5.  **Testing:**
    - [Unit tests required/recommended/optional]
    - Test coverage target: [X%]
    - Integration tests for [critical paths/all features]
    - Document how to run tests

6.  **Security:**
    - No hardcoded secrets, API keys, passwords, or tokens
    - Use environment variables via `.env` (add `.env` to `.gitignore`)
    - Provide `.env.example` with placeholder values
    - Treat auth files, exported API payloads, and local caches as sensitive until reviewed
    - [Additional security requirements specific to project]

7.  **Configuration Files:**
    - Validate JSON after editing any `.json` file
    - Do not leave trailing commas unless the format explicitly supports JSONC
    - Keep config changes reproducible and documented in `PROJECT_STATE.md`
    - Record rollback values when a config change can break startup, deployment, or runtime behavior

8.  **Version Control â€” Git is the Single Source of History and the Continuity Mechanism:**
    - A Git repo MUST exist (`git init` if absent). This is enforced during Bootstrap.
    - **Commit after EVERY response that modifies files** â€” completed or in-progress (see Checkpoint Policy in section 0)
    - Use `feat/fix/docs/refactor/test/chore` for completed work; use `wip(scope): step N â€” done; next: X` for in-progress work
    - `git log` IS the changelog â€” never maintain a separate CHANGELOG file
    - When you need project history or to resume after a context break, run `git log --oneline` + `git diff HEAD`
    - Branching strategy: [main/develop/feature branches â€” fill in]
    - Never use destructive Git commands (`reset --hard`, forced checkout, force push) unless explicitly requested
    - Never commit secrets, auth files, `.env`, or credentials dumps
    - Always provide a `.gitignore` appropriate for the language/framework

9.  **AI Decision-Making:**
    - Infer reasonable defaults by reading the codebase and existing config before asking questions
    - Ask only when ambiguity materially changes the outcome, or when secrets/credentials are required
    - When blocked, ask one targeted question and include the recommended default
    - Always finish non-blocked work before asking the user anything

10. **Technology Selection, Best Practices & Documentation Research (MANDATORY):**

    **Triggers â€” execute this research protocol automatically when:**
    - User asks to add a library, framework, or tool
    - User asks to implement a non-trivial feature (auth, payments, file uploads, real-time, etc.)
    - A placeholder `[framework]` or `[library]` is being filled during Bootstrap
    - You are about to write code for an integration you haven't verified recently

    **Research Protocol (execute in order):**
    1. **Search** for the current best options â€” check GitHub stars, last commit date, open issues, known CVEs, deprecation notices, and community adoption
    2. **Fetch the official documentation** for the chosen technology â€” read the quickstart, API reference, and any "gotchas" or migration guides
    3. **Search for best practices** â€” look for official style guides, security hardening docs, performance guides, and patterns recommended by the maintainers
    4. **Check for known issues** â€” search for common pitfalls, breaking changes in recent versions, and unpatched CVEs

    **Output format â€” always present to the user:**
    - **Recommended option** with rationale (why this one)
    - **Alternative** with pros/cons comparison
    - **Key gotchas** discovered during research
    - **Links** to the docs you read

    **After research:**
    - Save findings to `.github/KNOWLEDGE.md` under the relevant category
    - Include: what was chosen, why, links to official docs, key patterns, and gotchas
    - Commit: `git commit -m "docs(knowledge): add [technology] research and best practices"`

    **Quality bar:**
    - Never use a library with no commits in the last 12 months without flagging it
    - Never use a library with a critical unpatched CVE without flagging it
    - Prefer official/first-party over third-party when both solve the problem equally
    - Always use the latest stable version unless the project has a documented reason not to

11. **Product Direction Changes:**
    - **Trigger**: User says anything like "I want to pivot", "let's change the approach", "instead of X let's do Y", "new direction", or fundamentally changes a requirement
    - **Execute automatically:**
      1. Update `.github/copilot-instructions.md` â€” revise PROJECT TYPE, goals, and any affected conventions
      2. Rewrite `.github/PROJECT_STATE.md` Executive Summary to reflect the new direction
      3. Add an entry in `.github/KNOWLEDGE.md` under "Architecture & Design" explaining the pivot (what changed, why, what was discarded)
      4. Commit: `git commit -m "docs(direction): pivot to [new direction] â€” [reason]"`
    - The old direction is preserved in Git history; the docs reflect only the current direction

12. **Operator Environment & Available APIs â€” Credential Lookup Protocol:**

    Before telling the user "I can't do that" for any external service or API task, always run this
    lookup chain. **Never ask the user for a credential they may have already stored.**

    **Step 1 â€” Check Windows Registry (preferred storage on this machine)**

    All API tokens are stored under `HKCU:\SOFTWARE\AIWorkspace\Tokens\` by convention.
    Read a token with:
    ```powershell
    function Get-AIToken([string]$Name) {
        $val = (Get-ItemProperty -Path "HKCU:\SOFTWARE\AIWorkspace\Tokens" `
                -Name $Name -ErrorAction SilentlyContinue).$Name
        if (-not $val) {
            # Fallback: check environment variables
            $val = [System.Environment]::GetEnvironmentVariable($Name, "User")
        }
        if (-not $val) {
            $val = [System.Environment]::GetEnvironmentVariable($Name, "Machine")
        }
        return $val
    }

    # Example
    $token = Get-AIToken "SERVICE_API_TOKEN"
    ```

    **Step 2 â€” Check MCP tools loaded in the current session**

    Some services may be accessible via MCP tools. Check before falling back to REST API calls.

    **Step 3 â€” Use the REST API directly via PowerShell**

    If a token is found and no MCP tool exists, call the service REST API directly.

    **How to store a new token (run once, persists across all sessions and agents):**
    ```powershell
    # Create the key if it doesn't exist
    if (-not (Test-Path "HKCU:\SOFTWARE\AIWorkspace\Tokens")) {
        New-Item -Path "HKCU:\SOFTWARE\AIWorkspace" -Name "Tokens" -Force | Out-Null
    }
    # Store the token
    Set-ItemProperty -Path "HKCU:\SOFTWARE\AIWorkspace\Tokens" -Name "SERVICE_API_TOKEN" -Value "your-token-here"
    ```

    **When a needed token is not found anywhere:**
    - Ask the user for the token **once**
    - Immediately store it in the registry using the pattern above
    - Confirm: "Stored as `SERVICE_API_TOKEN` in `HKCU:\SOFTWARE\AIWorkspace\Tokens` â€” you won't be asked again"

    **[Document available tokens here as they are added to the registry]**
    - `TOKEN_NAME` â€” [service] â€” [what it grants access to]

---

## 2. Project Structure

[Define your project's directory structure here]

**Example Template:**

```
/project-root/
â”œâ”€â”€ .github/
â”‚   â”œâ”€â”€ copilot-instructions.md    # This file
â”‚   â”œâ”€â”€ PROJECT_STATE.md           # Current state documentation
â”‚   â””â”€â”€ KNOWLEDGE.md               # Solutions and learnings database
â”œâ”€â”€ src/                           # Source code
â”‚   â”œâ”€â”€ [components/modules/etc.]
â”œâ”€â”€ tests/                         # Test files
â”œâ”€â”€ docs/                          # Additional documentation
â”œâ”€â”€ config/                        # Configuration files
â”œâ”€â”€ .env.example                   # Environment variables template
â”œâ”€â”€ .gitignore                     # Git exclusions
â””â”€â”€ README.md                      # Project overview
```

**Key Principles:**
- [Describe your organization principles]
- [Mention any specific patterns you follow]

---

## 3. Development Standards

### 3.1 Naming Conventions

**[Language/Framework] Specific:**
- Variables: [camelCase/snake_case/PascalCase]
- Functions/Methods: [camelCase/snake_case]
- Classes: [PascalCase/snake_case]
- Constants: [UPPER_SNAKE_CASE/other]
- Files: [kebab-case/snake_case/PascalCase]

**Rules:**
- Use descriptive names (no single letters except loop counters)
- Boolean variables should be prefixed with `is`, `has`, `should`, `can`
- Function names should be verbs or verb phrases
- Class names should be nouns or noun phrases

### 3.2 Code Style

**Formatting:**
- Indentation: [2/4] spaces (never tabs)
- Line length: Maximum [80/100/120] characters
- [Other formatting rules specific to your project]

**Best Practices:**
- [DRY principle / SOLID principles / other]
- [Specific patterns or anti-patterns to follow/avoid]
- [Performance considerations]

### 3.3 Dependencies Management

- Package manager: [npm/pip/Maven/NuGet/etc.]
- Keep dependencies up to date
- Document why each major dependency is needed
- Prefer stable, well-maintained packages

---

## 4. Common Patterns and Templates

[Add templates for common tasks in your project]

### Example: [Common Task 1]

```[language]
// Template code here
```

### Example: [Common Task 2]

```[language]
// Template code here
```

---

## 5. Testing Standards

**Test Structure:**
```[language]
// Test template
```

**What to Test:**
- [Critical functionality]
- [Edge cases]
- [Error conditions]

**Running Tests:**
```bash
[command to run tests]
```

---

## 6. Deployment and Operations

**Environment Setup:**
1. [Step-by-step setup instructions]

**Deployment Process:**
1. [Deployment steps]

**Monitoring:**
- [What to monitor]
- [Where logs are stored]
- [How to debug production issues]

---

## 7. Documentation Files Structure

### `.github/PROJECT_STATE.md`

**Purpose**: Single source of truth for the CURRENT state of the project.

**Must Include:**
- Current architecture overview
- Active features and their status
- Configuration details
- Integration points
- Known limitations or technical debt
- Deployment information
- **NO changelogs** - only current state

**Update Frequency**: After EVERY modification

---

### `.github/KNOWLEDGE.md`

**Purpose**: Searchable database of solutions, patterns, and learnings discovered during development.

**Must Include:**
- Solutions to tricky problems
- "How to do X" guides
- Workarounds and why they exist
- Performance optimization discoveries
- Third-party API quirks and gotchas
- Common debugging procedures
- Lessons learned from production issues

**When to Update**: 
- When solving a non-obvious problem
- When discovering a better way to do something
- When encountering unexpected behavior
- When working around a library limitation

**Format**: 
- Organized by category/component
- Each entry should be searchable
- Include context and examples
- Date stamp each entry

---

## 8. Workflow and Automation

### Development Workflow

1. [Describe typical development workflow]
2. [Branch strategy]
3. [Code review process if applicable]
4. [CI/CD pipeline if applicable]

### Common Commands

**Development:**
```bash
# Start development server
[command]

# Build project
[command]

# Run linter
[command]
```

**Testing:**
```bash
# Run all tests
[command]

# Run specific test
[command]

# Generate coverage report
[command]
```

**Deployment:**
```bash
# Deploy to [environment]
[command]
```

---

## 9. Troubleshooting Guide

### Common Issues

**Issue 1: [Common Problem]**
- **Symptoms**: [What you see]
- **Cause**: [Why it happens]
- **Solution**: [How to fix]

**Issue 2: [Common Problem]**
- **Symptoms**: [What you see]
- **Cause**: [Why it happens]
- **Solution**: [How to fix]

### Debugging Checklist

When things go wrong:
1. [Check this first]
2. [Then check this]
3. [Look at logs here]
4. [Verify configuration]

---

## 10. AI Assistant Guidelines

**When implementing features:**
1. Understand the full context before coding
2. Ask clarifying questions only when requirements are materially ambiguous after checking the repo/config
3. Propose the solution before implementing if complex
4. Consider edge cases and error scenarios
5. Write tests alongside implementation
6. Update all documentation before marking task complete

**When fixing bugs:**
1. Reproduce the issue first
2. Identify root cause, not just symptoms
3. Fix the cause, not the symptom
4. Add tests to prevent regression
5. Document the solution in KNOWLEDGE.md
6. Update relevant documentation

**When refactoring:**
1. Ensure tests pass before starting
2. Make incremental changes
3. Keep tests passing throughout
4. Update documentation to reflect new structure
5. Verify no behavior changes unless intentional

**When working on Windows projects:**
1. Prefer PowerShell syntax for automation scripts unless the project explicitly uses Bash/WSL
2. Use Windows paths carefully and quote paths containing spaces
3. Document OS-specific assumptions in `PROJECT_STATE.md`

---

## Quick Reference: Common Operations

### [Operation 1]
**When**: [When to do this]  
**How**: [Step-by-step]  
**Docs to Update**: [Which files]

### [Operation 2]
**When**: [When to do this]  
**How**: [Step-by-step]  
**Docs to Update**: [Which files]

---

## Project-Specific Notes

[Add any project-specific quirks, requirements, or important context here]

---

**Remember:** This project uses a documentation-first approach. Updating PROJECT_STATE.md and KNOWLEDGE.md is NOT optional - it's part of completing every task.
