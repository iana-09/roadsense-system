@echo off
setlocal

set "ROOT_DIR=%~dp0"
set "WEB_DIR=%ROOT_DIR%Web_Server"
set "GPU_DIR=%ROOT_DIR%GPU_Worker"
set "DASHBOARD_DIR=%ROOT_DIR%Web_Dashboard"

set "WEB_PY="
set "GPU_PY="
set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
  
if exist "%WEB_DIR%\venv\Scripts\python.exe" (
  set "WEB_PY=%WEB_DIR%\venv\Scripts\python.exe"
)

if not defined WEB_PY (
  where python >nul 2>nul
  if not errorlevel 1 set "WEB_PY=python"
)

if not defined WEB_PY (
  where py >nul 2>nul
  if not errorlevel 1 set "WEB_PY=py"
)

if exist "%GPU_DIR%\venv\Scripts\python.exe" (
  set "GPU_PY=%GPU_DIR%\venv\Scripts\python.exe"
)

if not defined WEB_PY (
  echo Could not find Python.
  echo Install Python or create Web_Server\venv first.
  echo.
  echo Expected one of:
  echo   %WEB_DIR%\venv\Scripts\python.exe
  echo   python on PATH
  echo   py on PATH
  exit /b 1
)

if not defined GPU_PY (
  echo Missing GPU_Worker\venv\Scripts\python.exe.
  echo Create the GPU worker venv and install the CUDA PyTorch build before starting.
  exit /b 1
)

if not exist "%WEB_DIR%\.env" (
  echo Missing Web_Server\.env.
  echo The backend needs Azure SQL, Azure Blob Storage, GPU worker, and Gmail settings.
  exit /b 1
)

findstr /B /C:"AZURE_STORAGE_CONNECTION_STRING=" "%WEB_DIR%\.env" >nul
if errorlevel 1 (
  findstr /B /C:"AZURE_STORAGE_ACCOUNT_NAME=" "%WEB_DIR%\.env" >nul
  if errorlevel 1 (
    echo Azure Blob Storage is not configured in Web_Server\.env.
    echo Add AZURE_STORAGE_CONNECTION_STRING or AZURE_STORAGE_ACCOUNT_NAME plus AZURE_STORAGE_ACCOUNT_KEY.
    exit /b 1
  )
)

if not exist "%ROOT_DIR%runs\train_final2\weights\best.pt" (
  echo Missing model file:
  echo   %ROOT_DIR%runs\train_final2\weights\best.pt
  echo Update GPU_Worker\gpu_server.py if you want to use a different best.pt.
  exit /b 1
)

findstr /B /C:"GPU_WORKER_PUBLIC_URL=" "%WEB_DIR%\.env" >nul
if errorlevel 1 (
  echo GPU_WORKER_PUBLIC_URL is not configured in Web_Server\.env.
  echo Add your Cloudflare tunnel URL so Azure/local backend can reach this GPU worker.
  exit /b 1
)

"%GPU_PY%" -c "import torch, sys; print('GPU worker Python:', sys.executable); print('Torch:', torch.__version__, 'CUDA build:', torch.version.cuda); raise SystemExit(0 if torch.cuda.is_available() else 1)"
if errorlevel 1 (
  echo GPU worker venv cannot see CUDA.
  echo Install a CUDA-enabled PyTorch build in GPU_Worker\venv and restart.
  exit /b 1
)

if not exist "%DASHBOARD_DIR%\node_modules" (
  echo Installing dashboard dependencies...
  pushd "%DASHBOARD_DIR%"
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    exit /b 1
  )
  popd
)

echo -----------------------------------------
echo   Starting RoadSense Full Stack System
echo -----------------------------------------

if exist "%ADB%" (
  echo Setting ADB reverse for USB phone testing...
  "%ADB%" reverse tcp:8000 tcp:8000 >nul 2>nul
  "%ADB%" reverse tcp:8001 tcp:8001 >nul 2>nul
  "%ADB%" reverse tcp:8081 tcp:8081 >nul 2>nul
  "%ADB%" reverse --list
) else (
  echo ADB not found at %ADB%
  echo If using a USB phone, run adb reverse manually before uploading.
)
echo -----------------------------------------

:: 1. Start Backend API (Web_Server)
echo Starting Backend API...
start "Backend_API" powershell -NoExit -ExecutionPolicy Bypass -Command "$Host.UI.RawUI.WindowTitle='Backend_API'; Set-Location '%WEB_DIR%'; & '%WEB_PY%' -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
timeout /t 5 /nobreak >nul

:: 2. Start GPU Worker (GPU_Worker folder)
echo Starting GPU Worker...
start "GPU_Worker" powershell -NoExit -ExecutionPolicy Bypass -Command "$Host.UI.RawUI.WindowTitle='GPU_Worker'; Set-Location '%GPU_DIR%'; & '%GPU_PY%' -m uvicorn gpu_server:app --host 0.0.0.0 --port 8001"
timeout /t 3 /nobreak >nul

:: 3. Start React Dashboard
echo Starting Admin Dashboard...
start "Admin_Dashboard" powershell -NoExit -ExecutionPolicy Bypass -Command "$Host.UI.RawUI.WindowTitle='Admin_Dashboard'; Set-Location '%DASHBOARD_DIR%'; npm run dev -- --host 0.0.0.0"
timeout /t 3 /nobreak >nul

echo -----------------------------------------
echo All systems are booting up!
echo -----------------------------------------
echo Backend API   : http://localhost:8000
echo API Docs      : http://localhost:8000/docs
echo GPU Worker    : http://localhost:8001
echo Dashboard     : http://localhost:5173
echo Mobile BASE_URL for USB phone: http://127.0.0.1:8000
echo -----------------------------------------

endlocal
