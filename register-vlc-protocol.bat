@echo off
title Register VLC URL Protocol (vlc://)
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [Error] Please right-click this file and select "Run as administrator"!
    pause
    exit /b
)

set "VLC_PATH="
if exist "C:\Program Files\VideoLAN\VLC\vlc.exe" set "VLC_PATH=C:\Program Files\VideoLAN\VLC\vlc.exe"
if exist "C:\Program Files (x86)\VideoLAN\VLC\vlc.exe" set "VLC_PATH=C:\Program Files (x86)\VideoLAN\VLC\vlc.exe"

if "%VLC_PATH%"=="" (
    echo Default VLC path not found. Please input full path to vlc.exe:
    set /p "VLC_PATH=Path (e.g. D:\VLC\vlc.exe): "
)

set "VLC_PATH=%VLC_PATH:"=%"
if not exist "%VLC_PATH%" (
    echo [Error] File not found: "%VLC_PATH%"
    pause
    exit /b
)

echo Found VLC: "%VLC_PATH%"
reg add "HKCR\vlc" /ve /t REG_SZ /d "URL:VLC Protocol" /f >nul
reg add "HKCR\vlc" /v "URL Protocol" /t REG_SZ /d "" /f >nul
reg add "HKCR\vlc\DefaultIcon" /ve /t REG_SZ /d "\"%VLC_PATH%\",0" /f >nul
reg add "HKCR\vlc\shell\open\command" /ve /t REG_SZ /d "cmd /v:on /c \"set \"u=%%1\" & set \"u=!u:vlc://=!\" & start \"\" \"%VLC_PATH%\" \"!u!\"\"" /f >nul

echo.
echo [Success] vlc:// protocol has been registered!
echo You can now click the VLC button in your browser to launch VLC directly.
pause
