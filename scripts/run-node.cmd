@echo off
setlocal

set "NODE_EXE="
for /f "delims=" %%i in ('where node 2^>nul') do (
  set "NODE_EXE=%%i"
  goto :run
)

if exist "C:\Program Files\nodejs\node.exe" (
  set "NODE_EXE=C:\Program Files\nodejs\node.exe"
  goto :run
)

echo [run-node] Node.js nao encontrado. Verifique a instalacao local.
exit /b 1

:run
"%NODE_EXE%" %*
exit /b %errorlevel%
