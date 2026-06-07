@echo off
cd /d "C:\Users\nakay\law-firm-attendance"
start "" "C:\Program Files\nodejs\node.exe" server.cjs
timeout /t 3 > nul
start "" http://localhost:3737
