@echo off
set "PROJECT_PATH=%~dp0"
set "PROJECT_PATH=%PROJECT_PATH:~0,-1%"
for %%i in ("%PROJECT_PATH%") do set "PROJECT_NAME=%%~nxi"
start "AI Bootstrap" powershell -NoProfile -NoExit -ExecutionPolicy Bypass -File "D:\Code\CopilotInstructionTemplate\init-ai.ps1" -ProjectPath "%PROJECT_PATH%" -ProjectName "%PROJECT_NAME%"
