# daily-task.ps1 - installs, shows or removes the daily run of the intelligence system as a Windows scheduled task.
# Works on any PC: all paths are taken from where this file is, nothing is hard-coded.
#
#   powershell -ExecutionPolicy Bypass -File scripts\daily-task.ps1 -Install            install (default time 09:00 PC time)
#   powershell -ExecutionPolicy Bypass -File scripts\daily-task.ps1 -Install -At 08:30  choose the time (24h, PC time zone)
#   powershell -ExecutionPolicy Bypass -File scripts\daily-task.ps1 -Status             show the task and its next run
#   powershell -ExecutionPolicy Bypass -File scripts\daily-task.ps1 -Remove             remove it
#   add -DryRun to see what would happen without changing anything; -TaskName to use another name
#
# The task runs scripts\daily.cmd (candle refresh, node run.js all, snapshot). It is read-only: no git pull, no bots, no VPS, no database.
# It runs only while the user is logged in; if the PC was off at the time, it runs when the PC is next on (StartWhenAvailable).
param([switch]$Install, [switch]$Remove, [switch]$Status, [switch]$DryRun, [string]$At = '09:00', [string]$TaskName = 'Lucidio Intel Daily')
$ErrorActionPreference = 'Stop'
$intel = Split-Path -Parent $PSScriptRoot
$cmd = Join-Path $intel 'scripts\daily.cmd'
if (-not (Test-Path $cmd)) { throw "daily.cmd not found at $cmd" }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js is not installed or not on PATH (needs Node 20 or newer: https://nodejs.org)' }
$ver = (& node -v).TrimStart('v'); if ([int]($ver.Split('.')[0]) -lt 20) { throw "Node $ver is too old, need 20 or newer" }
if ($Install) {
  if ($At -notmatch '^\d{1,2}:\d{2}$') { throw "-At must look like 09:00, got '$At'" }
  $when = [datetime]::ParseExact($At, 'H:mm', $null)
  Write-Host "Node $ver found. Task '$TaskName' will run daily at $At ($((Get-TimeZone).Id)) : $cmd"
  if ($DryRun) { Write-Host 'Dry run: nothing changed.'; return }
  $action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c `"$cmd`"" -WorkingDirectory $intel
  $trigger = New-ScheduledTaskTrigger -Daily -At $when
  $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description 'Read-only daily refresh of the intelligence system (StrategyBacktester/intel).' -Force | Out-Null
  $i = Get-ScheduledTaskInfo -TaskName $TaskName; Write-Host "Installed. Next run: $($i.NextRunTime)"
} elseif ($Remove) {
  if ($DryRun) { Write-Host "Dry run: would remove '$TaskName'."; return }
  if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) { Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false; Write-Host "Removed '$TaskName'." } else { Write-Host "No task named '$TaskName'." }
} else {
  $t = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  if (-not $t) { Write-Host "No task named '$TaskName' on this PC." } else { $i = Get-ScheduledTaskInfo -TaskName $TaskName; Write-Host "State $($t.State). Last run $($i.LastRunTime) (result $($i.LastTaskResult)). Next run $($i.NextRunTime)." }
}
