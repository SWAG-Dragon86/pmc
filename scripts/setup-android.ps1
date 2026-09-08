param([switch]$IncludeEmulator)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$pmcRoot = Split-Path $PSScriptRoot -Parent
$pmcTools = Join-Path $pmcRoot 'output/android-tools'
New-Item -ItemType Directory -Force -Path $pmcTools | Out-Null

function Get-VerifiedArchive($Url, $Name, $Hash, $Algorithm, $Directory) {
    $archive = Join-Path $pmcTools $Name
    if (!(Test-Path -LiteralPath $archive) -or (Get-FileHash -LiteralPath $archive -Algorithm $Algorithm).Hash -ne $Hash) {
        Write-Output "Downloading $Name from official publisher"
        Invoke-WebRequest -Uri $Url -OutFile $archive
    }
    if ((Get-FileHash -LiteralPath $archive -Algorithm $Algorithm).Hash -ne $Hash) { throw "Checksum mismatch: $Name" }
    if (!(Test-Path -LiteralPath $Directory)) {
        New-Item -ItemType Directory -Path $Directory | Out-Null
        Expand-Archive -LiteralPath $archive -DestinationPath $Directory
    }
    Write-Output "Verified: $Name"
}

$jdk = (Invoke-RestMethod 'https://api.adoptium.net/v3/assets/latest/17/hotspot?architecture=x64&image_type=jdk&os=windows&vendor=eclipse')[0].binary.package
Get-VerifiedArchive $jdk.link 'jdk17.zip' $jdk.checksum 'SHA256' (Join-Path $pmcTools 'jdk')
Get-VerifiedArchive 'https://dl.google.com/android/repository/platform-35_r02.zip' 'platform35.zip' '0bb560a90a7a2cbd0dd8348224d518b638fe7949' 'SHA1' (Join-Path $pmcTools 'platform')
Get-VerifiedArchive 'https://dl.google.com/android/repository/build-tools_r35_windows.zip' 'build-tools35.zip' 'af059bb67cf7786f45ee0db85e2d24985df1b4b6' 'SHA1' (Join-Path $pmcTools 'build-tools')
Get-VerifiedArchive 'https://dl.google.com/android/repository/platform-tools_r37.0.1-win.zip' 'platform-tools.zip' 'e03e78b1d80b396f1c3358e31251cb31740e1110' 'SHA1' (Join-Path $pmcTools 'adb')
$java = Get-ChildItem (Join-Path $pmcTools 'jdk') -Filter java.exe -Recurse | Select-Object -First 1
& $java.FullName -version
if ($LASTEXITCODE -ne 0) { throw 'JDK did not start' }
Write-Output 'Android build environment ready (project-local; system PATH unchanged).'
if ($IncludeEmulator) {
    Get-VerifiedArchive 'https://dl.google.com/android/repository/emulator-windows_x64-15917651.zip' 'emulator.zip' '54fa750822ff462d57e04fc8e98e60f08df2bb61' 'SHA1' (Join-Path $pmcTools 'emulator-package')
    Get-VerifiedArchive 'https://dl.google.com/android/repository/sys-img/android/x86_64-35_r02.zip' 'system-image35.zip' '2d857d170c0d1b827149565da34b3383e5306f7f' 'SHA1' (Join-Path $pmcTools 'system-image35')
}
