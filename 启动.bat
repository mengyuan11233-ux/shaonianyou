@echo off
cd /d "%~dp0"
echo.
echo  ==========================================
echo    [少年游] 现在就出发 - AI 旅行规划
echo  ==========================================
echo.
echo  正在启动服务...
echo  浏览器会自动打开 http://localhost:3000
echo.
echo  !!! 重要：不要关闭这个窗口，关了就停止服务 !!!
echo  !!! 用完按 Ctrl+C 或直接关窗口即可退出      !!!
echo.
start "" /min cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000"
npm start
pause
