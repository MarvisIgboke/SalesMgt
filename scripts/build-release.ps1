#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Build a production release bundle for cPanel / shared hosting.

.DESCRIPTION
  1. Builds the SPA (dist/).
  2. Installs production-only Composer dependencies.
  3. Assembles:
       release/api          -> the Laravel application (upload to ~/salesmgt)
       release/public_html  -> SPA build + Apache front controller (upload to public_html)
  4. Zips everything to release.zip.

.EXAMPLE
  pwsh scripts/build-release.ps1
  pwsh scripts/build-release.ps1 -OutDir build
#>
param(
    [string]$OutDir = "release"
)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot

function Copy-Tree {
    param([string]$Src, [string]$Dst, [string[]]$ExcludeDirs, [string[]]$ExcludeFiles)

    $rcArgs = @($Src, $Dst, "/E", "/NFL", "/NDL", "/NJH", "/NJS", "/NP")
    if ($ExcludeDirs) { $rcArgs += "/XD"; $rcArgs += $ExcludeDirs }
    if ($ExcludeFiles) { $rcArgs += "/XF"; $rcArgs += $ExcludeFiles }

    & robocopy @rcArgs | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy failed ($LASTEXITCODE): $Src -> $Dst" }
}

Write-Host "==> Building frontend (SPA)" -ForegroundColor Cyan
Push-Location $repo
try {
    if (Test-Path "package-lock.json") { npm ci } else { npm install }
    npm run build
} finally { Pop-Location }

Write-Host "==> Installing production PHP dependencies" -ForegroundColor Cyan
Push-Location (Join-Path $repo "backend")
try {
    composer install --no-dev --optimize-autoloader --no-interaction --prefer-dist
} finally { Pop-Location }

$release = Join-Path $repo $OutDir
if (Test-Path $release) { Remove-Item -Recurse -Force $release }
New-Item -ItemType Directory -Path (Join-Path $release "api") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $release "public_html") -Force | Out-Null

Write-Host "==> Assembling release/api (Laravel)" -ForegroundColor Cyan
Copy-Tree -Src (Join-Path $repo "backend") -Dst (Join-Path $release "api") `
    -ExcludeDirs @("node_modules", "tests", ".phpunit.cache") -ExcludeFiles @(".env")

Write-Host "==> Assembling release/public_html (SPA + webroot)" -ForegroundColor Cyan
Copy-Tree -Src (Join-Path $repo "dist") -Dst (Join-Path $release "public_html")
Copy-Item (Join-Path $repo "deploy\cpanel\webroot\.htaccess")  (Join-Path $release "public_html") -Force
Copy-Item (Join-Path $repo "deploy\cpanel\webroot\index.php")  (Join-Path $release "public_html") -Force
Copy-Item (Join-Path $repo "deploy\cpanel\webroot\install.php") (Join-Path $release "public_html") -Force
Copy-Item (Join-Path $repo "backend\.env.production.example") (Join-Path $release "api\.env.example") -Force

Write-Host "==> Zipping" -ForegroundColor Cyan
$zip = Join-Path $repo "$OutDir.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory(
    $release, $zip, [System.IO.Compression.CompressionLevel]::Optimal, $false)

Write-Host "Done. Upload:" -ForegroundColor Green
Write-Host "  $release\api          -> ~/salesmgt          (outside public_html)"
Write-Host "  $release\public_html  -> ~/public_html"
Write-Host "Archive: $zip"
