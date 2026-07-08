@echo off
cd /d "%~dp0.."
"D:\nvm\nodejs\node.exe" "D:\nvm\nodejs\node_global\node_modules\pnpm\bin\pnpm.cjs" --dir frontend dev -p 3000 > frontend\dev-out.log 2> frontend\dev-err.log
