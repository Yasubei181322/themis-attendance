@echo off
:: PC起動後15秒待ってからサーバーを起動
timeout /t 15 /nobreak >nul
start "" /min cmd /k "cd /d C:\Users\nakay\law-firm-attendance && node server.cjs"
timeout /t 5 /nobreak >nul
start "" http://localhost:3737
