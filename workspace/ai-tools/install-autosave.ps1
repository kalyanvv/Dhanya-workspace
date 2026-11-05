# Sets up automatic saving of all Dhanya work to GitHub, every 20 minutes, even when Claude is
# out of usage. Run it once, by you, in PowerShell:
#
#   powershell -ExecutionPolicy Bypass -File "C:\Users\rupen\OneDrive\Documents\Staffing\Personal\Projects\workspace\ai-tools\install-autosave.ps1"
#
# What it creates: ONE Windows scheduled task named DhanyaSaveWork that runs
#   node ai-tools\save-work.mjs --quiet
# every 20 minutes while you are signed in. It saves snapshots of every working folder to
# backup branches on GitHub, and a copy of our tooling. It never copies secrets.
#
# To stop it later:   Unregister-ScheduledTask -TaskName DhanyaSaveWork -Confirm:$false
# To see what it did: notepad C:\Users\rupen\.dhanya\save-work.log

$node = (Get-Command node -ErrorAction Stop).Source
$script = Join-Path $PSScriptRoot 'save-work.mjs'
$workspace = Split-Path $PSScriptRoot -Parent

$action = New-ScheduledTaskAction -Execute $node -Argument "`"$script`" --quiet" -WorkingDirectory $workspace
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 20)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 10) `
  -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName 'DhanyaSaveWork' -Action $action -Trigger $trigger -Settings $settings `
  -Description 'Saves all Dhanya work (snapshots and tooling) to GitHub every 20 minutes.' -Force | Out-Null

$info = Get-ScheduledTask -TaskName 'DhanyaSaveWork' | Get-ScheduledTaskInfo
Write-Host 'Done. DhanyaSaveWork will run every 20 minutes. First run:' $info.NextRunTime
