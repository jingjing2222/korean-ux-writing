@echo off
setlocal
"%~dp0bin\win32-x64\kuw.exe" %*
exit /b %errorlevel%
