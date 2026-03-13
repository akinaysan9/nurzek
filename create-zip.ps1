$ErrorActionPreference = 'Stop'
$src = 'C:\Users\aysan\Desktop\risale-nur-ai'
$tmp = Join-Path $src 'deploy-temp'
$zip = Join-Path $src 'nurzek-deploy.zip'

# Temizlik
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
if (Test-Path $zip) { Remove-Item $zip -Force }

# Temp klasor olustur
New-Item $tmp -ItemType Directory | Out-Null

# Kopyala (node_modules haric)
robocopy (Join-Path $src 'backend') (Join-Path $tmp 'backend') /E /XD node_modules /NFL /NDL /NJH /NJS /NP
robocopy (Join-Path $src 'frontend') (Join-Path $tmp 'frontend') /E /NFL /NDL /NJH /NJS /NP
robocopy (Join-Path $src 'knowledge-base') (Join-Path $tmp 'knowledge-base') /E /NFL /NDL /NJH /NJS /NP
Copy-Item (Join-Path $src 'setup.sh') (Join-Path $tmp 'setup.sh')
if (Test-Path (Join-Path $src 'DEPLOY.md')) { Copy-Item (Join-Path $src 'DEPLOY.md') (Join-Path $tmp 'DEPLOY.md') }

# ZIP olustur
Compress-Archive -Path (Join-Path $tmp '*') -DestinationPath $zip -CompressionLevel Optimal

# Temizlik
Remove-Item $tmp -Recurse -Force

# Boyut goster
$item = Get-Item $zip
$mb = [math]::Round($item.Length / 1MB, 1)
Write-Host "ZIP hazir: $mb MB  ->  $zip"
