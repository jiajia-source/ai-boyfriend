@echo off
chcp 65001 >nul
echo ============================================
echo   内网穿透 (Cloudflare Tunnel)
echo   作用：把本机 localhost:3000 暴露成公网 HTTPS
echo         = 手机任何网络都能访问 + 支持锁屏推送
echo.
echo   cloudflared 已内置在 bin\ 目录，无需另行安装。
echo ============================================
echo.
echo 【重要】请先双击 start.bat 在另一个窗口把服务跑起来！
echo 本窗口启动后，会显示一个 https://xxx.trycloudflare.com 地址，
echo 用手机浏览器打开那个地址即可（建议"添加到主屏幕"变 App）。
echo ============================================
echo.
call "%~dp0bin\cloudflared.exe" tunnel --url http://localhost:3000
pause
