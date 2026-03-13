# NurZeka - Deploy ZIP oluşturucu
# Sadece sunucuda gerekli dosyaları içerir (node_modules, .env, venv vb. hariç)
# Kullanım: PowerShell'de .\build-deploy-zip.ps1

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot
$ZipName = "nurzeka_deploy.zip"
$OutFolder = "risale-nur-ai"
$TempDir = Join-Path $env:TEMP "nurzeka_build"
$OutPath = Join-Path $TempDir $OutFolder

Write-Host "=============================================="
Write-Host "  NurZeka - Deploy ZIP olusturuluyor"
Write-Host "=============================================="

# Eski temp ve zip'i temizle
if (Test-Path $TempDir) { Remove-Item $TempDir -Recurse -Force }
if (Test-Path (Join-Path $ProjectRoot $ZipName)) { Remove-Item (Join-Path $ProjectRoot $ZipName) -Force }

New-Item -ItemType Directory -Path $OutPath -Force | Out-Null

# Backend (node_modules, .env, *.log hariç)
Write-Host ">>> backend kopyalaniyor..."
robocopy (Join-Path $ProjectRoot "backend") (Join-Path $OutPath "backend") /E /XD node_modules /XF .env *.log startup_error.log | Out-Null
if (-not (Test-Path (Join-Path $OutPath "backend\package.json"))) {
    Write-Host "[HATA] backend kopyalanamadi." -ForegroundColor Red
    exit 1
}

# Frontend (tümü)
Write-Host ">>> frontend kopyalaniyor..."
Copy-Item -Path (Join-Path $ProjectRoot "frontend") -Destination (Join-Path $OutPath "frontend") -Recurse -Force

# rag_service (venv, __pycache__ hariç)
Write-Host ">>> rag_service kopyalaniyor..."
robocopy (Join-Path $ProjectRoot "rag_service") (Join-Path $OutPath "rag_service") /E /XD venv __pycache__ .venv /XF *.pyc *.log | Out-Null

# knowledge-base (varsa)
if (Test-Path (Join-Path $ProjectRoot "knowledge-base")) {
    Write-Host ">>> knowledge-base kopyalaniyor..."
    Copy-Item -Path (Join-Path $ProjectRoot "knowledge-base") -Destination (Join-Path $OutPath "knowledge-base") -Recurse -Force
}

# Kök dosyalar
Write-Host ">>> diger dosyalar..."
Copy-Item -Path (Join-Path $ProjectRoot "deploy.sh") -Destination (Join-Path $OutPath "deploy.sh") -Force
Copy-Item -Path (Join-Path $ProjectRoot "DEPLOY.md") -Destination (Join-Path $OutPath "DEPLOY.md") -Force

# Sunucuda tek komutla kurulum talimati
$kurulum = @"
NURZEKA - SUNUCUDA TEK KOMUTLA KURULUM
======================================

Zip'i sunucuya yukledikten sonra (ornegin /var/www veya /home/kullanici):

  unzip -o nurzeka_deploy.zip && cd risale-nur-ai && chmod +x deploy.sh && ./deploy.sh

Bu komut zip'i acar, kurulumu calistirir. JWT_SECRET otomatik atanir, ekstra islem gerekmez.

Istege bagli: Google giris veya DeepSeek API kullanacaksaniz backend/.env duzenleyip:
  pm2 restart nurzeka-backend

"@
Set-Content -Path (Join-Path $OutPath "KURULUM.txt") -Value $kurulum -Encoding UTF8

# ZIP oluştur
Write-Host ">>> ZIP olusturuluyor..."
$ZipPath = Join-Path $ProjectRoot $ZipName
Compress-Archive -Path (Join-Path $TempDir $OutFolder) -DestinationPath $ZipPath -Force

# Temp temizle
Remove-Item $TempDir -Recurse -Force

Write-Host ""
Write-Host "=============================================="
Write-Host "  Tamamlandi: $ZipPath"
Write-Host "=============================================="
Write-Host ""
Write-Host "Sunucuda tek komut:"
Write-Host "  unzip -o nurzeka_deploy.zip && cd risale-nur-ai && chmod +x deploy.sh && ./deploy.sh" -ForegroundColor Cyan
Write-Host ""
