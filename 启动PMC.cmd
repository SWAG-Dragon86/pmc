@echo off
setlocal
cd /d "%~dp0"
set "PMC_NODE=node"
where node >nul 2>nul
if errorlevel 1 set "PMC_NODE=C:\Users\30912\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist "dist\index.html" (
  echo Build output missing. Run npm install and npm run build first.
  pause
  exit /b 1
)
start "" "http://127.0.0.1:4173/"
"%PMC_NODE%" scripts\serve.mjs
if errorlevel 1 pause
