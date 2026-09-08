$ErrorActionPreference = 'Stop'
$pmcSource = Split-Path $PSScriptRoot -Parent
# Use a project-only ASCII alias for Android tools; no files are moved.
$pmcRoot = Join-Path $env:TEMP 'pmc-android-work-20260904'
if (!(Test-Path -LiteralPath $pmcRoot)) {
    New-Item -ItemType Junction -Path $pmcRoot -Target $pmcSource | Out-Null
} elseif ((Get-Item -LiteralPath $pmcRoot).Target -ne $pmcSource) {
    throw 'The temporary emulator alias belongs to another directory'
}
$pmcTools = Join-Path $pmcRoot 'output/android-tools'
$pmcAvd = Join-Path $pmcTools 'avd'
$pmcImage = Join-Path $pmcTools 'system-image35/x86_64'
foreach ($link in @(@('platform-tools', 'adb/platform-tools'), @('emulator', 'emulator-package/emulator'))) {
    if (!(Test-Path (Join-Path $pmcTools $link[0]))) {
        New-Item -ItemType Junction -Path (Join-Path $pmcTools $link[0]) -Target (Join-Path $pmcTools $link[1]) | Out-Null
    }
}
$pmcEmulator = Join-Path $pmcTools 'emulator/emulator.exe'
$pmcEmulatorDir = Split-Path $pmcEmulator -Parent
# The portable emulator's child process needs its bundled DLLs on its own PATH.
$env:PATH = "$pmcEmulatorDir;$pmcEmulatorDir/lib64;$pmcEmulatorDir/lib64/qt/lib;" + $env:PATH
if (!(Test-Path -LiteralPath $pmcImage)) { throw 'Run setup-android.ps1 -IncludeEmulator first' }
$env:ANDROID_AVD_HOME = $pmcAvd
$env:ANDROID_SDK_ROOT = $pmcTools
$env:ANDROID_USER_HOME = Join-Path $pmcTools 'user'
$env:ANDROID_EMULATOR_HOME = $env:ANDROID_USER_HOME
New-Item -ItemType Directory -Force -Path $env:ANDROID_USER_HOME | Out-Null
& $pmcEmulator -avd PMC_API35 -sysdir $pmcImage -no-window -no-audio -no-boot-anim -no-snapshot -no-metrics -gpu swiftshader -memory 2048 -cores 2 -port 5556
