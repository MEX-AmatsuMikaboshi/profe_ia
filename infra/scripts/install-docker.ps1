<#
.SYNOPSIS
  Instala WSL2 + Docker Desktop para el entorno local de Profesor IA (Plan.md F3/H3).

.DESCRIPTION
  Requiere privilegios de administrador. Un proceso sin elevar no puede
  instalar el Subsistema de Windows para Linux ni Docker Desktop: el
  instalador termina con código 1 si el aviso de UAC no se acepta.

.NOTES
  Ejecutar así (clic derecho sobre PowerShell → "Ejecutar como administrador"):

      powershell -ExecutionPolicy Bypass -File infra\scripts\install-docker.ps1

  El equipo debe reiniciarse después de habilitar WSL2 y antes de que Docker
  Desktop pueda arrancar su motor.
#>

$ErrorActionPreference = 'Stop'

$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Error 'Este script requiere una consola elevada (Ejecutar como administrador).'
    exit 1
}

Write-Host '== 1/3 Habilitando WSL2 y Plataforma de máquina virtual ==' -ForegroundColor Cyan
wsl.exe --install --no-distribution
if ($LASTEXITCODE -ne 0) {
    Write-Warning "wsl --install devolvió $LASTEXITCODE; se intentan las características por DISM."
    dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
    dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
}

Write-Host '== 2/3 Instalando Docker Desktop ==' -ForegroundColor Cyan
$cached = Get-ChildItem "$env:LOCALAPPDATA\Temp\WinGet" -Recurse -Filter '*Docker*Installer*.exe' -ErrorAction SilentlyContinue |
    Select-Object -First 1

if ($cached) {
    Write-Host "usando instalador ya descargado: $($cached.FullName)"
    & $cached.FullName install --quiet --accept-license --backend=wsl-2
    $code = $LASTEXITCODE
} else {
    winget install --id Docker.DockerDesktop --exact --accept-package-agreements --accept-source-agreements
    $code = $LASTEXITCODE
}
if ($code -ne 0) { Write-Warning "el instalador de Docker devolvió $code" }

Write-Host '== 3/3 Verificación ==' -ForegroundColor Cyan
$dockerExe = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
if (Test-Path $dockerExe) {
    Write-Host 'Docker Desktop instalado.' -ForegroundColor Green
} else {
    Write-Warning 'Docker Desktop NO quedó instalado.'
}

Write-Host ''
Write-Host 'Siguiente paso: REINICIAR el equipo, abrir Docker Desktop una vez y luego comprobar:' -ForegroundColor Yellow
Write-Host '  docker version'
Write-Host '  docker run --rm hello-world'
Write-Host ''
Write-Host 'Con Docker operativo se desbloquean F1/H1 (ci:db:testcontainers) y F3/H3 (compose).'
