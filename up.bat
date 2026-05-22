@echo off
cd /d "%~dp0infra"
docker compose up --build
