param(
    [string]$Repo = "",
    [string]$Environment = "production",
    [string]$EnvFile = "deploy/.env.server",
    [string]$DeployPath = "/var/www/livingilabs/edunurse",
    [string]$SshKeyFile = "$HOME/.ssh/id_rsa",
    [string]$SshHost = $env:SSH_HOST,
    [string]$SshUser = $env:SSH_USER,
    [string]$SshPort = $(if ($env:SSH_PORT) { $env:SSH_PORT } else { "22" }),
    [string]$GhcrUsername = $env:GHCR_USERNAME,
    [string]$GhcrToken = $env:GHCR_TOKEN,
    [switch]$NoSyncEnvKeys
)

$ErrorActionPreference = "Stop"

function Require-Command($name) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        throw "$name is required but not found in PATH."
    }
}

function Set-GhSecret([string]$Name, [string]$Value) {
    gh secret set $Name --repo $Repo --env $Environment --body $Value | Out-Null
    Write-Host "Set secret: $Name"
}

function Set-GhVariable([string]$Name, [string]$Value) {
    gh variable set $Name --repo $Repo --env $Environment --body $Value | Out-Null
    Write-Host "Set variable: $Name"
}

Require-Command "gh"

if ([string]::IsNullOrWhiteSpace($Repo)) {
    $Repo = (gh repo view --json nameWithOwner -q .nameWithOwner).Trim()
}
if ([string]::IsNullOrWhiteSpace($Repo)) {
    throw "Could not resolve repo. Pass -Repo owner/name."
}

if (-not (Test-Path $EnvFile)) {
    throw "Env file not found: $EnvFile"
}

if (-not (Test-Path $SshKeyFile)) {
    throw "SSH key file not found: $SshKeyFile"
}

if ([string]::IsNullOrWhiteSpace($SshHost) -or [string]::IsNullOrWhiteSpace($SshUser) -or [string]::IsNullOrWhiteSpace($GhcrToken)) {
    throw "Missing required values. Set SSH_HOST, SSH_USER, GHCR_TOKEN or pass parameters."
}

if ([string]::IsNullOrWhiteSpace($GhcrUsername)) {
    $GhcrUsername = (gh api user -q .login).Trim()
}
if ([string]::IsNullOrWhiteSpace($GhcrUsername)) {
    throw "Could not resolve GHCR username. Pass -GhcrUsername."
}

$sshKeyContent = Get-Content -Raw -Path $SshKeyFile
$envFileRaw = Get-Content -Raw -Path $EnvFile

Set-GhSecret -Name "SSH_HOST" -Value $SshHost
Set-GhSecret -Name "SSH_USER" -Value $SshUser
Set-GhSecret -Name "SSH_PORT" -Value $SshPort
Set-GhSecret -Name "SERVER_HOST" -Value $SshHost
Set-GhSecret -Name "SERVER_USER" -Value $SshUser
Set-GhSecret -Name "SSH_PRIVATE_KEY" -Value $sshKeyContent
Set-GhSecret -Name "GHCR_USERNAME" -Value $GhcrUsername
Set-GhSecret -Name "GHCR_TOKEN" -Value $GhcrToken
Set-GhSecret -Name "SERVER_ENV_FILE" -Value $envFileRaw

Set-GhVariable -Name "DEPLOY_PATH" -Value $DeployPath

$viteApiBase = $env:VITE_API_BASE_URL
$viteClient = $env:VITE_GOOGLE_OAUTH_CLIENT_ID
$viteRedirect = $env:VITE_GOOGLE_OAUTH_REDIRECT_URI

if (-not [string]::IsNullOrWhiteSpace($viteApiBase)) {
    Set-GhVariable -Name "VITE_API_BASE_URL" -Value $viteApiBase
}
if (-not [string]::IsNullOrWhiteSpace($viteClient)) {
    Set-GhVariable -Name "VITE_GOOGLE_OAUTH_CLIENT_ID" -Value $viteClient
}
if (-not [string]::IsNullOrWhiteSpace($viteRedirect)) {
    Set-GhVariable -Name "VITE_GOOGLE_OAUTH_REDIRECT_URI" -Value $viteRedirect
}

if (-not $NoSyncEnvKeys) {
    $lines = Get-Content -Path $EnvFile
    foreach ($rawLine in $lines) {
        $line = $rawLine.Trim()
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        if ($line.StartsWith("#")) { continue }
        $idx = $line.IndexOf("=")
        if ($idx -lt 1) { continue }
        $key = $line.Substring(0, $idx).Trim()
        $value = $line.Substring($idx + 1)
        if ([string]::IsNullOrWhiteSpace($key)) { continue }
        Set-GhSecret -Name $key -Value $value
    }
}

Write-Host "Done. Repo: $Repo, environment: $Environment"
