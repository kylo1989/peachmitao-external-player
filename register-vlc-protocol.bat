@echo off
title Register VLC URL Protocol (vlc://)

:: 自动请求管理员权限以清理旧残留并写入系统级协议
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Requesting Administrator privileges...
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

:: 1. 自动检测 VLC 安装路径
set "VLC_PATH="
if exist "C:\Program Files\VideoLAN\VLC\vlc.exe" set "VLC_PATH=C:\Program Files\VideoLAN\VLC\vlc.exe"
if exist "C:\Program Files (x86)\VideoLAN\VLC\vlc.exe" set "VLC_PATH=C:\Program Files (x86)\VideoLAN\VLC\vlc.exe"

if "%VLC_PATH%"=="" (
    echo [Info] Default VLC path not found. Please input full path to vlc.exe:
    set /p "VLC_PATH=Path (e.g. D:\VLC\vlc.exe): "
)

set "VLC_PATH=%VLC_PATH:"=%"
if not exist "%VLC_PATH%" (
    echo [Error] File not found: "%VLC_PATH%"
    pause
    exit /b 1
)

:: 2. 在公共目录生成纯批处理协议剥离与启动器 (不被安全软件拦截，且完整保留 & 参数)
set "HANDLER_DIR=%ProgramData%\VLC-Protocol"
if not exist "%HANDLER_DIR%" mkdir "%HANDLER_DIR%"
set "LAUNCHER_BAT=%HANDLER_DIR%\launch-vlc.bat"

(
    echo @echo off
    echo set "url=%%~1"
    echo set "url=%%url:vlc://=%%"
    echo start "" "%VLC_PATH%" "%%url%%"
) > "%LAUNCHER_BAT%"

:: 3. 清理所有旧注册表项并导入标准 .reg 文件
reg delete "HKLM\Software\Classes\vlc" /f >nul 2>&1
reg delete "HKCU\Software\Classes\vlc" /f >nul 2>&1

set "VLC_REG=%VLC_PATH:\=\\%"
set "BAT_REG=%LAUNCHER_BAT:\=\\%"
set "REG_TMP=%TEMP%\vlc_protocol_v2.reg"

(
    echo Windows Registry Editor Version 5.00
    echo.
    echo [HKEY_LOCAL_MACHINE\SOFTWARE\Classes\vlc]
    echo @="URL:VLC Protocol"
    echo "URL Protocol"=""
    echo.
    echo [HKEY_LOCAL_MACHINE\SOFTWARE\Classes\vlc\DefaultIcon]
    echo @="\"%VLC_REG%\",0"
    echo.
    echo [HKEY_LOCAL_MACHINE\SOFTWARE\Classes\vlc\shell\open\command]
    echo @="\"%BAT_REG%\" \"%%1\""
) > "%REG_TMP%"

reg import "%REG_TMP%" >nul 2>&1
del /f /q "%REG_TMP%" >nul 2>&1

echo.
echo [Success] vlc:// protocol registered successfully!
echo VLC Path : "%VLC_PATH%"
echo Launcher : "%LAUNCHER_BAT%"
echo.
pause
