@echo off
cd /d "%~dp0"
echo Starting Haspataal Terminal...
start "" "node_modules\electron\dist\electron.exe" .
