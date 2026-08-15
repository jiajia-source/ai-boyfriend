@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   Push code to GitHub private repo
echo   (first run auto-downloads gh, no install)
echo ============================================
echo.

REM ---- Step 0: get portable gh (no install, no popup) ----
where gh >nul 2>nul
if not errorlevel 1 goto :step1
if exist "%~dp0bin\gh.exe" goto :step1

echo [Step 0] gh not found. Downloading portable gh...
echo   (this may take a moment, no dialog will appear)
echo.

echo   trying mirror 1 (ghproxy.com)...
curl -L --retry 2 --max-time 120 -o "%~dp0bin\gh.zip" "https://ghproxy.com/https://github.com/cli/cli/releases/download/v2.65.0/gh_2.65.0_windows_amd64.zip"
if exist "%~dp0bin\gh.zip" tar -tf "%~dp0bin\gh.zip" >nul 2>&1 && goto :got_zip
del /Q "%~dp0bin\gh.zip" 2>nul

echo   trying mirror 2 (mirror.ghproxy.com)...
curl -L --retry 2 --max-time 120 -o "%~dp0bin\gh.zip" "https://mirror.ghproxy.com/https://github.com/cli/cli/releases/download/v2.65.0/gh_2.65.0_windows_amd64.zip"
if exist "%~dp0bin\gh.zip" tar -tf "%~dp0bin\gh.zip" >nul 2>&1 && goto :got_zip
del /Q "%~dp0bin\gh.zip" 2>nul

echo   trying mirror 3 (github.com direct)...
curl -L --retry 2 --max-time 120 -o "%~dp0bin\gh.zip" "https://github.com/cli/cli/releases/download/v2.65.0/gh_2.65.0_windows_amd64.zip"
if exist "%~dp0bin\gh.zip" tar -tf "%~dp0bin\gh.zip" >nul 2>&1 && goto :got_zip
del /Q "%~dp0bin\gh.zip" 2>nul

echo.
echo   [ERROR] All download sources failed.
echo   Please check your network, then re-run.
pause
exit /b 1

:got_zip
tar -xf "%~dp0bin\gh.zip" -C "%~dp0bin\"
copy /Y "%~dp0bin\gh_2.65.0_windows_amd64\bin\gh.exe" "%~dp0bin\gh.exe" >nul
del /Q "%~dp0bin\gh.zip"
rmdir /S /Q "%~dp0bin\gh_2.65.0_windows_amd64" 2>nul
echo   gh ready.
echo.

set "PATH=%~dp0bin;%PATH%"

:step1
echo [Step 1] Login to GitHub
echo   Browser will open. Please log in and authorize.
gh auth login
if errorlevel 1 (
  echo [ERROR] gh auth login failed.
  pause
  exit /b 1
)
echo.

:step2
echo [Step 2] Rename branch to main
git branch -M main
echo.

:step3
echo [Step 3] Create private repo and push
echo   Repo name: aiboyfriend-chenyu
gh repo create aiboyfriend-chenyu --private --source=. --remote=origin --push
if errorlevel 1 (
  echo [ERROR] gh repo create/push failed.
  pause
  exit /b 1
)
echo.

:done
echo ============================================
echo   Push complete!
echo   Next: go to render.com and deploy this repo.
echo   See README chapter 5 for step-by-step.
echo ============================================
pause