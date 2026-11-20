@echo off
title Register VLC URL Protocol (vlc://)

:: 自动请求管理员权限（确保能彻底清理之前写入 HKLM 的旧错误项）
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Requesting Administrator privileges...
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

:: 1. 自动查找 VLC 安装路径
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

:: 2. 在公共目录生成静默中转调度脚本 (避免权限隔离及截断 & 参数)
set "HANDLER_DIR=%ProgramData%\VLC-Protocol"
if not exist "%HANDLER_DIR%" mkdir "%HANDLER_DIR%"
set "VBS_FILE=%HANDLER_DIR%\vlc-handler.vbs"

(
    echo Set args = WScript.Arguments
    echo If args.Count ^> 0 Then
    echo     url = args^(0^)
    echo     If LCase^(Left^(url, 6^)^) = "vlc://" Then
    echo         url = Mid^(url, 7^)
    echo     End If
    echo     Set shell = CreateObject^("WScript.Shell"^)
    echo     shell.Run Chr^(34^) ^& "%VLC_PATH%" ^& Chr^(34^) ^& " " ^& Chr^(34^) ^& url ^& Chr^(34^), 1, False
    echo End If
) > "%VBS_FILE%"

:: 3. 彻底删除 HKLM 和 HKCU 中的所有旧残留，并写入系统级标准协议
reg delete "HKLM\Software\Classes\vlc" /f >nul 2>&1
reg delete "HKCU\Software\Classes\vlc" /f >nul 2>&1

set "VLC_REG=%VLC_PATH:\=\\%"
set "VBS_REG=%VBS_FILE:\=\\%"
set "REG_TMP=%TEMP%\vlc_protocol_clean.reg"

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
    echo @="wscript.exe \"%VBS_REG%\" \"%%1\""
) > "%REG_TMP%"

reg import "%REG_TMP%" >nul 2>&1
del /f /q "%REG_TMP%" >nul 2>&1

echo.
echo [Success] vlc:// protocol has been cleanly registered!
echo VLC Path: "%VLC_PATH%"
echo Handler : "%VBS_FILE%"
echo.
pause
