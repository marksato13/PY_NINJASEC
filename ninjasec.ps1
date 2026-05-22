$ErrorActionPreference = "Stop"

Set-Location "$PSScriptRoot\infra"

function Show-Menu {
    Write-Host ""
    Write-Host "NinjaSec Control"
    Write-Host "1. Levantar stack y ver logs en esta consola"
    Write-Host "2. Levantar stack en segundo plano (recomendado)"
    Write-Host "3. Detener stack"
    Write-Host "4. Reiniciar stack en segundo plano"
    Write-Host "5. Ver logs"
    Write-Host "6. Estado de contenedores"
    Write-Host "7. Detener y limpiar volumenes"
    Write-Host "8. Abrir frontend en navegador"
    Write-Host "9. Abrir swagger del backend"
    Write-Host "0. Salir"
    Write-Host ""
}

function Start-Stack {
    docker compose -p ninjasec up --build
}

function Start-StackDetached {
    docker compose -p ninjasec up --build -d
}

function Stop-Stack {
    docker compose -p ninjasec down
}

function Restart-Stack {
    docker compose -p ninjasec down
    docker compose -p ninjasec up --build -d
}

function Show-Logs {
    docker compose -p ninjasec logs -f
}

function Show-Status {
    docker compose -p ninjasec ps
}

function Clean-Stack {
    docker compose -p ninjasec down -v
}

function Open-Frontend {
    Start-Process "http://localhost:3018"
}

function Open-BackendDocs {
    Start-Process "http://localhost:8024/docs"
}

while ($true) {
    Show-Menu
    $option = Read-Host "Selecciona una opcion"

    switch ($option) {
        "1" { Start-Stack }
        "2" { Start-StackDetached }
        "3" { Stop-Stack }
        "4" { Restart-Stack }
        "5" { Show-Logs }
        "6" { Show-Status }
        "7" { Clean-Stack }
        "8" { Open-Frontend }
        "9" { Open-BackendDocs }
        "0" { break }
        default { Write-Host "Opcion no valida" }
    }
}
