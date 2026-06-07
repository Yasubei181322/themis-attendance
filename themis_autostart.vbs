Set ws = CreateObject("WScript.Shell")
pm2 = ws.ExpandEnvironmentStrings("%APPDATA%") & "\npm\pm2.cmd"
ws.Run "cmd.exe /c """ & pm2 & """ resurrect", 0, False
