@echo off
title Register VLC URL Protocol (vlc://)

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

:: 2. 生成静默中转调度脚本 (避免 cmd /c 截断 URL 中的 & 符号及黑框闪烁)
set "HANDLER_DIR=%LOCALAPPDATA%\VLC-Protocol"
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

:: 3. 清理旧的错误注册表项并生成标准 .reg 文件导入
reg delete "HKCR\vlc" /f >nul 2>&1
reg delete "HKCU\Software\Classes\vlc" /f >nul 2>&1

set "VLC_REG=%VLC_PATH:\=\\%"
set "VBS_REG=%VBS_FILE:\=\\%"
set "REG_TMP=%TEMP%\vlc_protocol_fix.reg"

(
    echo Windows Registry Editor Version 5.00
    echo.
    echo [HKEY_CURRENT_USER\Software\Classes\vlc]
    echo @="URL:VLC Protocol"
    echo "URL Protocol"=""
    echo.
    echo [HKEY_CURRENT_USER\Software\Classes\vlc\DefaultIcon]
    echo @="\"%VLC_REG%\",0"
    echo.
    echo [HKEY_CURRENT_USER\Software\Classes\vlc\shell\open\command]
    echo @="wscript.exe \"%VBS_REG%\" \"%%1\""
) > "%REG_TMP%"

reg import "%REG_TMP%" >nul 2>&1
del /f /q "%REG_TMP%" >nul 2>&1

echo.
echo [Success] vlc:// protocol has been registered!
echo VLC Path: "%VLC_PATH%"
echo You can now click the VLC button in your browser to launch VLC directly.
pause
