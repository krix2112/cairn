@echo off
echo ========================================================
echo   CAIRN / RADIX - Server Launch Script
echo ========================================================
echo Checking for active process on port 8000...

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    echo Terminating existing process with PID %%a on port 8000...
    taskkill /F /PID %%a >nul 2>&1
)

echo Port 8000 is clear. Starting Uvicorn server...
if exist ".venv\Scripts\python.exe" (
    .venv\Scripts\python.exe -m uvicorn app.api:app --host 0.0.0.0 --port 8000 --reload
) else (
    python -m uvicorn app.api:app --host 0.0.0.0 --port 8000 --reload
)
