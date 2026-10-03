#requires -Version 7.0
param([ValidateSet('start','stop','status','backend','frontend')][string]$Action = 'status', [switch]$Wait)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$runtime = Join-Path $repo '.zupfer-local'
$statePath = Join-Path $runtime 'processes.json'
if ($Action -eq 'backend') {
    Set-Location $repo
    & .\mvnw.cmd spring-boot:run '-Dskip.installnodenpm=true' '-Dskip.npm=true' '-Dspring-boot.run.arguments=--server.port=8081'
    exit $LASTEXITCODE
}
if ($Action -eq 'frontend') {
    Set-Location (Join-Path $repo 'src/main/frontend')
    & node.exe (Join-Path $repo 'scripts/local-web.cjs')
    exit $LASTEXITCODE
}
function Get-ManagedProcesses {
    if (!(Test-Path $statePath)) { return @() }
    @(Get-Content $statePath -Raw | ConvertFrom-Json) | Where-Object {
        $process = Get-Process -Id $_.Id -ErrorAction SilentlyContinue
        $process -and $process.StartTime.ToUniversalTime().Ticks -eq ([datetime]$_.Started).ToUniversalTime().Ticks
    }
}
function Stop-ProcessTree([int]$ProcessId) {
    Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Parent -and $_.Parent.Id -eq $ProcessId } | ForEach-Object { Stop-ProcessTree $_.Id }
    Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
}
$managed = @(Get-ManagedProcesses)
if ($Action -eq 'status') {
    if ($managed.Count -eq 0) { Write-Output 'Zupfer ist gestoppt.' }
    else { $managed | Select-Object Name, Id; Write-Output 'Frontend: http://localhost:3000; Backend: http://localhost:8081' }
    exit
}
if ($Action -eq 'stop') {
    foreach ($entry in $managed) { Stop-ProcessTree $entry.Id }
    if (Test-Path $statePath) { Remove-Item -LiteralPath $statePath }
    Write-Output 'Zupfer ist gestoppt.'
    exit
}
if ($managed.Count -gt 0) { throw 'Zupfer-Prozesse laufen bereits. Zuerst status oder stop verwenden.' }
$config = Join-Path $repo 'src/main/resources/application.yml'
if (!(Test-Path $config)) { throw 'Lokale application.yml fehlt.' }
if ((Get-Content $config -Raw) -match '<DB_HOST>|<DB_NAME>') {
    if (!$env:SPRING_DATASOURCE_URL) { throw 'Datenbankadresse fehlt: application.yml konfigurieren oder SPRING_DATASOURCE_URL setzen.' }
}
foreach ($port in 3000,8081) {
    $client = [Net.Sockets.TcpClient]::new()
    $connected = $false
    try { $client.Connect('localhost', $port); $connected = $true } catch {} finally { $client.Dispose() }
    if ($connected) { throw "Port $port ist bereits belegt." }
}
if (!(Test-Path (Join-Path $repo 'src/main/frontend/node_modules/next'))) { throw 'Frontend-Abhaengigkeiten fehlen. Zuerst npm ci in src/main/frontend ausfuehren.' }
New-Item -ItemType Directory -Force $runtime | Out-Null
$entries = @()
foreach ($name in 'backend','frontend') {
    $process = Start-Process (Join-Path $PSHOME 'pwsh.exe') -WindowStyle Hidden -PassThru -WorkingDirectory $repo -ArgumentList @('-NoProfile', '-File', ('"' + $PSCommandPath + '"'), $name) -RedirectStandardOutput (Join-Path $runtime "$name.log") -RedirectStandardError (Join-Path $runtime "$name.error.log")
    $entries += @{ Name=$name; Id=$process.Id; Started=$process.StartTime.ToUniversalTime().ToString('o') }
    ConvertTo-Json -InputObject @($entries) | Set-Content $statePath
}
Write-Output 'Start angefordert. Logs liegen in .zupfer-local; Erreichbarkeit vor Erfolgsmeldung pruefen.'

if ($Wait) { Wait-Process -Id @($entries | ForEach-Object { $_.Id }) -ErrorAction SilentlyContinue }



