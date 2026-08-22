param(
    [string]$KeystorePath = "smart-tka-release.keystore",
    [string]$Alias = "smart-tka",
    [string]$Dname = "CN=Smart TKA, OU=Dev, O=SmartTKA, L=City, S=State, C=ID"
)

$keytool = Join-Path $env:JAVA_HOME "bin\keytool.exe"
if (-not (Test-Path $keytool)) {
    Write-Error "keytool not found at $keytool. Ensure JAVA_HOME is set."
    exit 1
}

if (Test-Path $KeystorePath) {
    Write-Warning "Keystore already exists at $KeystorePath. Remove it first to regenerate."
    exit 1
}

$storePass = Read-Host "Enter keystore password" -AsSecureString
$keyPass = Read-Host "Enter key password (leave blank to use same as keystore)" -AsSecureString

$storePassPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($storePass))
if ($keyPass -eq [System.Security.SecureString]::Empty) {
    $keyPassPlain = $storePassPlain
} else {
    $keyPassPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($keyPass))
}

$args = "-genkeypair -v", "-keystore", $KeystorePath, "-storetype", "PKCS12", "-keyalg", "RSA", "-keysize", "2048", "-validity", "10000", "-alias", $Alias, "-storepass", $storePassPlain, "-keypass", $keyPassPlain, "-dname", $Dname

Write-Host "Generating keystore..."
& $keytool @args

if ($LASTEXITCODE -eq 0) {
    Write-Host "Keystore generated: $(Resolve-Path $KeystorePath)"
    Write-Host "Update android/gradle.properties with the passwords you chose."
} else {
    Write-Error "Failed to generate keystore."
}
