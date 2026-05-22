$ErrorActionPreference = "Stop"

Set-Location "$PSScriptRoot\infra"
docker compose -p ninjasec down -v
