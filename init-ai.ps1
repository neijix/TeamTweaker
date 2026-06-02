param([string]$ProjectPath, [string]$ProjectName)

$INIT_SCRIPT = "D:\Code\CopilotInstructionTemplate\init-project.ps1"

if (-not $ProjectPath) { $ProjectPath = $PSScriptRoot }
if (-not $ProjectName) { $ProjectName = Split-Path $ProjectPath -Leaf }

try {

$files = [ordered]@{
    'CLAUDE.md'                       = "$ProjectPath\CLAUDE.md"
    'GEMINI.md'                       = "$ProjectPath\GEMINI.md"
    'AGENTS.md'                       = "$ProjectPath\AGENTS.md"
    '.windsurfrules'                  = "$ProjectPath\.windsurfrules"
    'opencode.json'                   = "$ProjectPath\opencode.json"
    '.github\copilot-instructions.md' = "$ProjectPath\.github\copilot-instructions.md"
    '.github\PROJECT_STATE.md'        = "$ProjectPath\.github\PROJECT_STATE.md"
    '.github\KNOWLEDGE.md'            = "$ProjectPath\.github\KNOWLEDGE.md"
    '.cursor\rules\project.mdc'       = "$ProjectPath\.cursor\rules\project.mdc"
    '.claude\settings.json'           = "$ProjectPath\.claude\settings.json"
    '.gemini\settings.json'           = "$ProjectPath\.gemini\settings.json"
}

Clear-Host
Write-Host ""
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  AI Project Bootstrap" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Project : $ProjectName"
Write-Host "  Path    : $ProjectPath"
Write-Host ""

# --- Audit ------------------------------------------------------------------
Write-Host "  Checking template files..." -ForegroundColor Gray
Write-Host ""

$missing = 0
foreach ($entry in $files.GetEnumerator()) {
    if (Test-Path $entry.Value) {
        Write-Host "   [OK] $($entry.Key)" -ForegroundColor Green
    } else {
        Write-Host "   [--] $($entry.Key)   <-- missing" -ForegroundColor Yellow
        $missing++
    }
}

Write-Host ""
if ($missing -eq 0) {
    Write-Host "  All template files present [$($files.Count)/$($files.Count)]" -ForegroundColor Green
} else {
    Write-Host "  $missing file(s) missing" -ForegroundColor Yellow
}
Write-Host ""

# --- Template script check --------------------------------------------------
if (-not (Test-Path $INIT_SCRIPT)) {
    Write-Host "  [ERROR] Template script not found:" -ForegroundColor Red
    Write-Host "  $INIT_SCRIPT" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Edit INIT_SCRIPT in init-ai.ps1 to point to your template directory."
    Read-Host "  Press Enter to exit"
    exit 1
}

# --- Project name -----------------------------------------------------------
$nameInput = Read-Host "  Project name [$ProjectName]"
if ($nameInput.Trim() -ne '') { $ProjectName = $nameInput.Trim() }

# --- Mode selection ---------------------------------------------------------
Write-Host ""
Write-Host "  Mode:" -ForegroundColor Cyan
Write-Host "    1. Init new project        (write missing files only)"
Write-Host "    2. Update agent templates  (refresh AI config, keep project docs)"
Write-Host "    3. Force overwrite all     (CAUTION: overwrites project docs too)"
Write-Host "    4. Check only              (audit without writing anything)"
Write-Host "    5. Status                  (git log + uncommitted work)"
Write-Host ""

$defaultMode = if ($missing -eq $files.Count) { '1' } else { '2' }
$modeInput = Read-Host "  Mode [1/2/3/4/5] (default: $defaultMode)"
if ($modeInput.Trim() -eq '') { $modeInput = $defaultMode }

if ($modeInput -eq '4') {
    Write-Host ""
    Write-Host "  Audit complete. No files written." -ForegroundColor Cyan
    Write-Host ""
    Read-Host "  Press Enter to close"
    exit 0
}

if ($modeInput -eq '5') {
    Write-Host ""
    Write-Host "  === Project Status ===" -ForegroundColor Cyan
    Push-Location $ProjectPath
    $log     = git log --oneline -10 2>&1
    $status  = git status --short 2>&1
    $lastMsg = git log --format="%s" -1 2>&1
    Pop-Location

    Write-Host ""
    Write-Host "  Last 10 commits:" -ForegroundColor Gray
    $log | ForEach-Object {
        $color = if ($_ -match '^[a-f0-9]+ wip') { 'Yellow' } else { 'Green' }
        Write-Host "    $_" -ForegroundColor $color
    }

    Write-Host ""
    if ($status) {
        Write-Host "  Uncommitted changes:" -ForegroundColor Yellow
        $status | ForEach-Object { Write-Host "    $_" -ForegroundColor Yellow }
    } else {
        Write-Host "  Working tree clean." -ForegroundColor Green
    }

    Write-Host ""
    if ($lastMsg -match '^wip') {
        Write-Host "  *** WORK IN PROGRESS ***" -ForegroundColor Red
        Write-Host "  Last agent left mid-task: $lastMsg" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "  Tell your next agent:" -ForegroundColor Cyan
        Write-Host "  'Run git log --oneline -10 and read PROJECT_STATE.md, then continue.'" -ForegroundColor White
    } else {
        Write-Host "  Last session completed cleanly." -ForegroundColor Green
    }

    Read-Host "  Press Enter to close"
    exit 0
}

# --- Run --------------------------------------------------------------------
$params = @{
    ProjectPath = $ProjectPath
    ProjectName = $ProjectName
}
if ($modeInput -eq '2') { $params['UpdateTemplatesOnly'] = $true }
if ($modeInput -eq '3') { $params['Force'] = $true }

Write-Host ""
Write-Host "  Running mode $modeInput for '$ProjectName'..." -ForegroundColor Cyan
Write-Host ""

& $INIT_SCRIPT @params

# --- Post-run verification --------------------------------------------------
Write-Host ""
Write-Host "  Post-run verification:" -ForegroundColor Cyan
Write-Host ""

$stillMissing = 0
foreach ($entry in $files.GetEnumerator()) {
    if (Test-Path $entry.Value) {
        Write-Host "   [OK] $($entry.Key)" -ForegroundColor Green
    } else {
        Write-Host "   [!!] $($entry.Key)   <-- still missing" -ForegroundColor Red
        $stillMissing++
    }
}

Write-Host ""
if ($stillMissing -eq 0) {
    Write-Host "  All files verified [$($files.Count)/$($files.Count)] - ready for AI agents." -ForegroundColor Green
} else {
    Write-Host "  WARNING: $stillMissing file(s) still missing." -ForegroundColor Red
}

} catch {
    Write-Host ""
    Write-Host "  [ERROR] $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  Line $($_.InvocationInfo.ScriptLineNumber): $($_.InvocationInfo.Line.Trim())" -ForegroundColor Red
}

Read-Host "  Press Enter to close"
