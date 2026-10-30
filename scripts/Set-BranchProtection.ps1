param(
    [string]$Repository = 'AnthidaC/THAI_Please_WebApp'
)

$ErrorActionPreference = 'Stop'
$configPath = Join-Path $PSScriptRoot '../.github/branch-protection.json'

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw 'Install GitHub CLI and run gh auth login with repository administration permission first.'
}

foreach ($branch in @('main', 'dev')) {
    $endpoint = "repos/$Repository/branches/$branch/protection"
    & gh api --method PUT $endpoint --input $configPath --silent
    if ($LASTEXITCODE -ne 0) {
        throw "Could not apply protection to $branch. Check GitHub authentication and administration permission."
    }

    $response = & gh api $endpoint
    if ($LASTEXITCODE -ne 0) {
        throw "Protection was submitted for $branch, but verification failed."
    }
    $protection = $response | ConvertFrom-Json
    if (-not $protection.enforce_admins.enabled -or
        -not $protection.required_pull_request_reviews.dismiss_stale_reviews -or
        $protection.required_pull_request_reviews.required_approving_review_count -ne 1 -or
        -not $protection.required_conversation_resolution.enabled -or
        $protection.allow_force_pushes.enabled -or
        $protection.allow_deletions.enabled) {
        throw "GitHub returned unexpected protection settings for $branch."
    }
    Write-Host "Branch protection applied and verified: $branch"
}
