@echo off
chcp 65001 >nul
cd /d "%~dp0server"
echo ============================================
echo   陈屿全栈版 - 本地启动
echo   首次运行会自动安装依赖，请稍候...
echo ============================================
call npm install --no-audit --no-fund
echo.
echo 依赖安装完成，正在启动服务（默认端口 3000）...
echo 启动成功后，电脑浏览器打开 http://localhost:3000
echo 关闭此窗口即停止服务。
echo ============================================
call npm start
pause
