$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$gameUrl = 'http://127.0.0.1:5173'
$runningGame = $false
try {
    $response = Invoke-WebRequest -Uri $gameUrl -UseBasicParsing -TimeoutSec 2
    if ($response.Content -notmatch 'Orbit Life') { throw 'Port 5173 is being used by another application.' }
    $runningGame = $true
} catch [System.Net.WebException] {
    $runningGame = $false
}
if (-not $runningGame) {
    if (-not (Test-Path -LiteralPath 'node_modules/vite/bin/vite.js')) {
        & npm.cmd ci
        if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
    }
    $nodePath = (Get-Command node.exe -ErrorAction Stop).Source
    $vitePath = Join-Path $PSScriptRoot 'node_modules/vite/bin/vite.js'
    Start-Process -FilePath $nodePath -ArgumentList @(('"' + $vitePath + '"'), '--host', '127.0.0.1', '--port', '5173', '--strictPort') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $PSScriptRoot 'game-server.log') -RedirectStandardError (Join-Path $PSScriptRoot 'game-server-error.log')
    $ready = $false
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        try {
            $response = Invoke-WebRequest -Uri $gameUrl -UseBasicParsing -TimeoutSec 1
            if ($response.StatusCode -eq 200 -and $response.Content -match 'Orbit Life') { $ready = $true; break }
        } catch [System.Net.WebException] {}
        Start-Sleep -Milliseconds 250
    }
    if (-not $ready) { throw 'Game did not start. Check game-server-error.log.' }
}
Start-Process $gameUrl
