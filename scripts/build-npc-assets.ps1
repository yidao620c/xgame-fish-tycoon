# 绿幕人物立绘 → 透明底、统一高度的游戏素材
# 用法: & .\scripts\build-npc-assets.ps1
Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Continue'
$here = $PSScriptRoot
$root = Split-Path -Parent $here
$outDir = Join-Path $root 'src\assets\npc'
$tmpDir = Join-Path $root '.tmp_npc'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null

$ffmpeg = (Get-Command ffmpeg -ErrorAction SilentlyContinue).Source
if (-not $ffmpeg) { throw 'ffmpeg not found on PATH' }

$map = @(
  'shopkeeper=image-50fbcb63-085b-4524-a25d-d7791608e03c',
  'student=image-cb8aa552-e251-4076-9eec-0c9779b338b3',
  'office=image-0fae7387-a471-469f-9afe-123c8b03964d',
  'kid=image-a7c5de68-e3b0-488d-9366-c3e323fb8715',
  'elder-man=image-f2ed4632-f2dd-407c-a119-1121dc1dea23',
  'business=image-c19ceb87-611d-4f2a-8f51-3e51223001a1',
  'woman=image-9e3242fb-8387-48cf-a308-8df4a90a2f7f',
  'elder-woman=image-91b326d3-e833-4a36-b44d-1871b2a18fd6',
  'worker=image-2ba0bd36-f221-4ed5-b93e-df050b0d8a7f',
  'student-side=image-b1e91761-63b2-425a-808c-639d068073f5',
  'office-side=image-eb144ab9-136f-44aa-8c96-a8f26629cf66',
  'kid-side=image-2bc4ee76-ba6b-4475-8f1c-dee8bc58c3b0',
  'woman-side=image-5fb491b8-850d-4262-94e9-f9d3038574c6',
  'business-side=image-35d79895-c6a8-4b7b-bc63-8e48842198b6',
  'elder-man-side=image-ccb676ca-e46e-43e7-9979-fcbda404f543',
  'elder-woman-side=image-42946b4e-0a95-4a1b-8721-4e68e35a9a8b',
  'worker-side=image-d00f3cb5-5235-49aa-9af3-8ab2935a37db',
  'student-left=image-3aef0928-338a-4252-bc4c-029a299a647b',
  'office-left=image-f0b80c4d-7cb1-4557-8c9d-8a705ad5a752',
  'kid-left=image-013cf266-2bd2-4616-9e33-eaca2c0da9bd',
  'woman-left=image-e22caa84-272b-43ea-8840-ae5c7762338b',
  'business-left=image-d1d0e84c-30d6-4c41-8603-47c17f337e40',
  'elder-man-left=image-e9a64a8d-0dc9-4959-abd6-b7620a5bf719',
  'elder-woman-left=image-8c2e9f6e-366e-4cab-b5e7-02e89e898f15',
  'worker-left=image-6792ebc6-e57b-4154-9e45-e74f16f8e43a'
)

$targetH = 520

foreach ($entry in $map) {
  $name = $entry.Split('=')[0]
  $id = $entry.Split('=')[1]
  $src = Join-Path $root ('assets\generated\' + $id + '.webp')
  if (-not (Test-Path $src)) { Write-Warning "missing $src"; continue }

  $keyed = Join-Path $tmpDir ($name + '-keyed.png')
  if (Test-Path $keyed) { Remove-Item $keyed -Force }
  $vf = 'colorkey=0x00FF00:0.34:0.12,despill=type=green:mix=0.9:expand=0.1,format=rgba'
  $log = & $ffmpeg -y -loglevel error -i $src -vf $vf $keyed 2>&1
  if (-not (Test-Path $keyed)) { Write-Warning ("colorkey failed {0}: {1}" -f $name, ($log | Out-String)); continue }

  $bmp = [System.Drawing.Bitmap]::FromFile($keyed)
  $w = $bmp.Width; $h = $bmp.Height
  $rect = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
  $data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $stride = $data.Stride
  $bytes = New-Object byte[] ($stride * $h)
  [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
  $bmp.UnlockBits($data)

  $minX = $w; $minY = $h; $maxX = -1; $maxY = -1
  for ($y = 0; $y -lt $h; $y++) {
    $row = $y * $stride
    for ($x = 0; $x -lt $w; $x++) {
      if ($bytes[$row + $x * 4 + 3] -gt 26) {
        if ($x -lt $minX) { $minX = $x }
        if ($x -gt $maxX) { $maxX = $x }
        if ($y -lt $minY) { $minY = $y }
        if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }
  if ($maxX -lt 0) { $bmp.Dispose(); Write-Warning "empty alpha $name"; continue }

  $pad = 6
  $cropX = [Math]::Max(0, $minX - $pad)
  $cropY = [Math]::Max(0, $minY - $pad)
  $cropW = [Math]::Min($w - $cropX, ($maxX - $minX + 1) + $pad * 2)
  $cropH = [Math]::Min($h - $cropY, ($maxY - $minY + 1) + $pad * 2)
  $cropRect = New-Object System.Drawing.Rectangle($cropX, $cropY, $cropW, $cropH)
  $cropped = $bmp.Clone($cropRect, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $cropPath = Join-Path $tmpDir ($name + '-crop.png')
  $cropped.Save($cropPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $cropped.Dispose(); $bmp.Dispose()

  $outPath = Join-Path $outDir ($name + '.webp')
  $scale = 'scale=-1:' + $targetH
  $log2 = & $ffmpeg -y -loglevel error -i $cropPath -vf $scale -c:v libwebp -quality 90 $outPath 2>&1
  if (-not (Test-Path $outPath)) { Write-Warning ("encode failed {0}: {1}" -f $name, ($log2 | Out-String)); continue }

  $kb = [int]((Get-Item $outPath).Length / 1KB)
  $outW = [int](($cropW * $targetH) / $cropH)
  Write-Output ("{0,-12} {1,4}x{2}  {3,4}KB   content {4}x{5}" -f $name, $outW, $targetH, $kb, $cropW, $cropH)
}

Remove-Item -Recurse -Force $tmpDir -ErrorAction SilentlyContinue
