@echo off
cd /d "%~dp0"
echo ==========================================
echo   Pushing to GitHub ...
echo ==========================================
echo.
echo If a browser opens to sign in to GitHub, please sign in.
echo If it asks for a password, paste your Personal Access Token.
echo.
git push -u origin main
echo.
echo -------------------------------------------------
echo Success = you see "done" or "branch 'main' set up".
echo Failed  = copy the red error text and send it to me.
echo -------------------------------------------------
pause
