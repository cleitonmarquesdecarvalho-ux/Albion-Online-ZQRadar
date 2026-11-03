$ErrorActionPreference = 'Stop'
$failed = $false

function Check($label, [scriptblock]$action) {
  try { $value = & $action; Write-Host "[OK] $label`: $value" -ForegroundColor Green }
  catch { Write-Host "[FALHA] $label`: $($_.Exception.Message)" -ForegroundColor Red; $script:failed = $true }
}

Check 'Node.js 26.x' { $v = node -v; if ($LASTEXITCODE -ne 0 -or $v -notmatch '^v26\.') { throw "Encontrado $v; esperado Node 26.x" }; $v }
Check 'npm disponível' { $v = npm -v; if ($LASTEXITCODE -ne 0) { throw 'npm não executou' }; $v }
Check 'Python 3.15' { $v = & python --version 2>&1; if ($LASTEXITCODE -ne 0 -or $v -notmatch 'Python 3\.15\.') { throw "Encontrado $v; esperado Python 3.15.x" }; $v }
Check 'PYTHON configurado para node-gyp' { $p = [Environment]::GetEnvironmentVariable('PYTHON','User'); if (-not $p) { $p = $env:PYTHON }; if (-not $p -or -not (Test-Path $p)) { throw 'Defina PYTHON apontando para python.exe' }; $p }
Check 'Npcap em execução' { $s = Get-Service npcap -ErrorAction Stop; if ($s.Status -ne 'Running') { throw "Serviço Npcap está $($s.Status)" }; $s.Status }
Check 'VS Build Tools com v143 e ClangCL' {
  $vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
  if (-not (Test-Path $vswhere)) { throw 'vswhere.exe não encontrado' }
  $install = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 Microsoft.VisualStudio.Component.VC.Llvm.Clang Microsoft.VisualStudio.Component.VC.Llvm.ClangToolset -property installationPath
  if (-not $install) { throw 'Instalação com MSVC/ClangCL não encontrada' }
  $install
}
Check 'Windows SDK instalado' { $sdk = Get-ChildItem 'C:\Program Files (x86)\Windows Kits\10\Include' -Directory -ErrorAction Stop | Select-Object -ExpandProperty Name; if (-not $sdk) { throw 'Windows SDK não encontrado' }; $sdk -join ', ' }
Write-Host "npm config msvs_version: $(npm config get msvs_version) (undefined usa autodetecção do node-gyp)"
if ($failed) { exit 1 }
Write-Host 'Ambiente pronto.' -ForegroundColor Green
