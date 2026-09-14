```powershell
# ================================================================
# Antigravity Autonomous Development Setup
# ================================================================
#
# Purpose:
#   Configure Antigravity CLI for high-autonomy software development.
#
# Settings:
#   toolPermission           = always-proceed
#   artifactReviewPolicy     = always-proceed
#   agentMode                = accept-edits
#   enableTerminalSandbox    = true
#   allowNonWorkspaceAccess  = false
#
# The script:
#   1. Detects the Antigravity settings location
#   2. Creates the settings directory if necessary
#   3. Backs up existing settings
#   4. Preserves unrelated existing settings
#   5. Updates only the settings listed above
#   6. Validates the resulting JSON
#   7. Prints a PASS/FAIL report
#   8. Checks whether AGY / Antigravity CLI is available
#
# ================================================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "      ANTIGRAVITY AUTONOMOUS DEVELOPMENT SETUP" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# ------------------------------------------------
# 1. Locate Antigravity settings
# ------------------------------------------------

$settingsDirectory = Join-Path $HOME ".gemini\antigravity-cli"
$settingsFile = Join-Path $settingsDirectory "settings.json"

Write-Host "[1/8] Checking Antigravity settings location..." -ForegroundColor Yellow
Write-Host "      $settingsFile"
Write-Host ""

# ------------------------------------------------
# 2. Create directory if needed
# ------------------------------------------------

if (-not (Test-Path $settingsDirectory)) {

    Write-Host "Creating settings directory..." -ForegroundColor DarkYellow

    New-Item `
        -ItemType Directory `
        -Path $settingsDirectory `
        -Force | Out-Null
}

# ------------------------------------------------
# 3. Backup existing settings
# ------------------------------------------------

Write-Host "[2/8] Backing up existing settings..." -ForegroundColor Yellow
Write-Host ""

if (Test-Path $settingsFile) {

    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

    $backupFile = Join-Path `
        $settingsDirectory `
        "settings.backup-$timestamp.json"

    Copy-Item `
        -Path $settingsFile `
        -Destination $backupFile `
        -Force

    Write-Host "Backup created:" -ForegroundColor Green
    Write-Host "  $backupFile"
    Write-Host ""
}
else {

    Write-Host "No existing settings.json found." -ForegroundColor DarkYellow
    Write-Host "A new configuration will be created."
    Write-Host ""
}

# ------------------------------------------------
# 4. Read existing configuration
# ------------------------------------------------

Write-Host "[3/8] Reading existing configuration..." -ForegroundColor Yellow
Write-Host ""

if (Test-Path $settingsFile) {

    $rawJson = Get-Content `
        -Path $settingsFile `
        -Raw

    if ([string]::IsNullOrWhiteSpace($rawJson)) {

        Write-Host "Existing settings file is empty." -ForegroundColor DarkYellow

        $config = [PSCustomObject]@{}
    }
    else {

        try {

            $config = $rawJson | ConvertFrom-Json

            Write-Host "Existing JSON is valid." -ForegroundColor Green
        }
        catch {

            Write-Host ""
            Write-Host "ERROR: Existing settings.json contains invalid JSON." -ForegroundColor Red
            Write-Host ""
            Write-Host "Your original file was backed up before this script attempted"
            Write-Host "to modify anything."
            Write-Host ""
            Write-Host "Backup location:" -ForegroundColor Yellow
            Write-Host "  $backupFile"
            Write-Host ""

            exit 1
        }
    }
}
else {

    $config = [PSCustomObject]@{}
}

# ------------------------------------------------
# Helper function
# ------------------------------------------------

function Set-JsonProperty {

    param(
        [Parameter(Mandatory = $true)]
        [object]$Object,

        [Parameter(Mandatory = $true)]
        [string]$Name,

        [Parameter(Mandatory = $true)]
        [object]$Value
    )

    $property = $Object.PSObject.Properties[$Name]

    if ($null -ne $property) {

        $property.Value = $Value
    }
    else {

        $Object |
            Add-Member `
                -MemberType NoteProperty `
                -Name $Name `
                -Value $Value
    }
}

# ------------------------------------------------
# 5. Apply recommended configuration
# ------------------------------------------------

Write-Host "[4/8] Applying recommended autonomous settings..." -ForegroundColor Yellow
Write-Host ""

# Automatically execute tools/commands without normal approval prompts.
Set-JsonProperty `
    -Object $config `
    -Name "toolPermission" `
    -Value "always-proceed"

Write-Host "  toolPermission          = always-proceed" -ForegroundColor Green

# Automatically write generated artifacts/code without asking for review.
Set-JsonProperty `
    -Object $config `
    -Name "artifactReviewPolicy" `
    -Value "always-proceed"

Write-Host "  artifactReviewPolicy    = always-proceed" -ForegroundColor Green

# Automatically accept file edits/creation.
Set-JsonProperty `
    -Object $config `
    -Name "agentMode" `
    -Value "accept-edits"

Write-Host "  agentMode               = accept-edits" -ForegroundColor Green

# Keep OS-level terminal sandbox enabled.
Set-JsonProperty `
    -Object $config `
    -Name "enableTerminalSandbox" `
    -Value $true

Write-Host "  enableTerminalSandbox   = true" -ForegroundColor Green

# Keep the agent confined to the active workspace.
Set-JsonProperty `
    -Object $config `
    -Name "allowNonWorkspaceAccess" `
    -Value $false

Write-Host "  allowNonWorkspaceAccess = false" -ForegroundColor Green

Write-Host ""

# ------------------------------------------------
# 6. Write configuration
# ------------------------------------------------

Write-Host "[5/8] Writing settings.json..." -ForegroundColor Yellow
Write-Host ""

$config |
    ConvertTo-Json -Depth 50 |
    Set-Content `
        -Path $settingsFile `
        -Encoding UTF8

Write-Host "Configuration written successfully." -ForegroundColor Green
Write-Host ""

# ------------------------------------------------
# 7. Validate written JSON
# ------------------------------------------------

Write-Host "[6/8] Validating settings.json..." -ForegroundColor Yellow
Write-Host ""

try {

    $verifiedConfig = Get-Content `
        -Path $settingsFile `
        -Raw |
        ConvertFrom-Json

    Write-Host "JSON validation: PASS" -ForegroundColor Green
}
catch {

    Write-Host "JSON validation: FAIL" -ForegroundColor Red
    Write-Host ""
    Write-Host "The settings file could not be parsed."
    Write-Host "Restore the backup if necessary:"
    Write-Host "  $backupFile"
    exit 1
}

# ------------------------------------------------
# 8. PASS / FAIL verification
# ------------------------------------------------

Write-Host "[7/8] Verifying individual settings..." -ForegroundColor Yellow
Write-Host ""

$checks = @(
    @{
        Name     = "Tool Permission"
        Property = "toolPermission"
        Expected = "always-proceed"
    },
    @{
        Name     = "Artifact Review"
        Property = "artifactReviewPolicy"
        Expected = "always-proceed"
    },
    @{
        Name     = "Agent Mode"
        Property = "agentMode"
        Expected = "accept-edits"
    },
    @{
        Name     = "Terminal Sandbox"
        Property = "enableTerminalSandbox"
        Expected = $true
    },
    @{
        Name     = "Non-Workspace Access"
        Property = "allowNonWorkspaceAccess"
        Expected = $false
    }
)

$allPassed = $true

foreach ($check in $checks) {

    $actual = $verifiedConfig.($check.Property)

    if ($actual -eq $check.Expected) {

        Write-Host `
            ("  [PASS] {0} = {1}" -f $check.Name, $actual) `
            -ForegroundColor Green
    }
    else {

        Write-Host `
            ("  [FAIL] {0} = {1} (expected {2})" -f `
                $check.Name,
                $actual,
                $check.Expected) `
            -ForegroundColor Red

        $allPassed = $false
    }
}

Write-Host ""

# ------------------------------------------------
# 9. Detect CLI
# ------------------------------------------------

Write-Host "[8/8] Checking Antigravity CLI..." -ForegroundColor Yellow
Write-Host ""

$agyCommand = Get-Command "agy" -ErrorAction SilentlyContinue
$antigravityCommand = Get-Command "antigravity" -ErrorAction SilentlyContinue

if ($null -ne $agyCommand) {

    Write-Host "  [FOUND] agy" -ForegroundColor Green
    Write-Host "  Path: $($agyCommand.Source)"

    try {

        Write-Host ""
        Write-Host "  Version:"
        & agy --version
    }
    catch {

        Write-Host "  Could not retrieve agy version." -ForegroundColor DarkYellow
    }
}
elseif ($null -ne $antigravityCommand) {

    Write-Host "  [FOUND] antigravity" -ForegroundColor Green
    Write-Host "  Path: $($antigravityCommand.Source)"

    try {

        Write-Host ""
        Write-Host "  Version:"
        & antigravity --version
    }
    catch {

        Write-Host "  Could not retrieve Antigravity version." -ForegroundColor DarkYellow
    }
}
else {

    Write-Host "  [WARNING] Antigravity CLI command was not found in PATH." `
        -ForegroundColor DarkYellow

    Write-Host ""
    Write-Host "  This does NOT necessarily mean Antigravity is not installed."
    Write-Host "  The CLI may not currently be exposed through PATH."
}

# ------------------------------------------------
# Final report
# ------------------------------------------------

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan

if ($allPassed) {

    Write-Host "                 CONFIGURATION: PASS" -ForegroundColor Green
}
else {

    Write-Host "                 CONFIGURATION: FAIL" -ForegroundColor Red
}

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Settings file:" -ForegroundColor White
Write-Host "  $settingsFile"
Write-Host ""

if ($backupFile) {

    Write-Host "Backup:" -ForegroundColor White
    Write-Host "  $backupFile"
    Write-Host ""
}

Write-Host "Configured:" -ForegroundColor White
Write-Host "  Tool Permission          : always-proceed"
Write-Host "  Artifact Review          : always-proceed"
Write-Host "  Agent Mode               : accept-edits"
Write-Host "  Terminal Sandbox         : ON"
Write-Host "  Non-Workspace Access     : OFF"
Write-Host ""

Write-Host "IMPORTANT:" -ForegroundColor Yellow
Write-Host "  Restart Antigravity CLI/agent sessions after changing"
Write-Host "  persistent settings so the new configuration is loaded."
Write-Host ""

Write-Host "Next recommended command:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  agy --mode=accept-edits"
Write-Host ""

Write-Host "To inspect settings interactively inside Antigravity:"
Write-Host ""
Write-Host "  /config"
Write-Host ""
Write-Host "or:"
Write-Host ""
Write-Host "  /settings"
Write-Host ""

if ($allPassed) {

    Write-Host "Autonomous configuration completed successfully." `
        -ForegroundColor Green
}
else {

    Write-Host "One or more settings failed validation." `
        -ForegroundColor Red

    exit 1
}
```