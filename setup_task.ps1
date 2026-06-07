$nodePath = "C:\Program Files\nodejs\node.exe"
$scriptPath = "C:\Users\nakay\law-firm-attendance\server.cjs"
$workDir = "C:\Users\nakay\law-firm-attendance"

Unregister-ScheduledTask -TaskName "Themis" -Confirm:$false -ErrorAction SilentlyContinue

$action = New-ScheduledTaskAction -Execute $nodePath -Argument "`"$scriptPath`"" -WorkingDirectory $workDir
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit 0 -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName "Themis" -Action $action -Trigger $trigger -Settings $settings -RunLevel Highest -Force

Write-Host "タスク登録完了"
Start-ScheduledTask -TaskName "Themis"
Write-Host "Themis起動完了"
Start-Sleep -Seconds 3
Write-Host "確認中..."
$status = (Get-ScheduledTask -TaskName "Themis").State
Write-Host "状態: $status"
