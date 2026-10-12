Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\xarin\.gemini\antigravity-ide\brain\3e425bd8-8020-477b-b3c8-b1843370567b\.user_uploaded\media_1791826241016.jpg"
$destDir = "H:\Dino Draw Your Game\client\public\sprites"

if (-not (Test-Path $destDir)) {
    New-Item -ItemType Directory -Path $destDir -Force | Out-Null
}

$src = [System.Drawing.Bitmap]::FromFile($srcPath)
$bmp = New-Object System.Drawing.Bitmap($src.Width, $src.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$gfx = [System.Drawing.Graphics]::FromImage($bmp)
$gfx.DrawImage($src, 0, 0, $src.Width, $src.Height)
$gfx.Dispose()
$src.Dispose()

# Key out black background
$rect = New-Object System.Drawing.Rectangle(0, 0, $bmp.Width, $bmp.Height)
$bmpData = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$ptr = $bmpData.Scan0
$bytes = [Math]::Abs($bmpData.Stride) * $bmp.Height
$rgbValues = New-Object byte[] $bytes
[System.Runtime.InteropServices.Marshal]::Copy($ptr, $rgbValues, 0, $bytes)

for ($i = 0; $i -lt $bytes; $i += 4) {
    $b = $rgbValues[$i]
    $g = $rgbValues[$i + 1]
    $r = $rgbValues[$i + 2]
    # Check if nearly black
    if ($r -lt 28 -and $g -lt 28 -and $b -lt 28) {
        $rgbValues[$i + 3] = 0 # Alpha = 0
    }
}

[System.Runtime.InteropServices.Marshal]::Copy($rgbValues, 0, $ptr, $bytes)
$bmp.UnlockBits($bmpData)

# Function to crop sprite
function Save-Sprite($name, $x, $y, $w, $h) {
    $cropRect = New-Object System.Drawing.Rectangle($x, $y, $w, $h)
    $cropped = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($cropped)
    $g.DrawImage($bmp, (New-Object System.Drawing.Rectangle(0, 0, $w, $h)), $cropRect, [System.Drawing.GraphicsUnit]::Pixel)
    $g.Dispose()
    $outputPath = Join-Path $destDir "$name.png"
    $cropped.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $cropped.Dispose()
    Write-Output "Saved $name.png"
}

# Row 1: Dino poses (Ankylosaurus)
Save-Sprite "dino_idle" 15 50 240 200
Save-Sprite "dino_walk" 280 50 235 200
Save-Sprite "dino_jump" 535 50 240 200
Save-Sprite "dino_run" 775 50 235 200

# Row 2: Collectibles / Coins
Save-Sprite "coin_footprint" 55 260 135 135
Save-Sprite "coin_dino" 210 260 135 135
Save-Sprite "coin_leaf" 365 260 135 135
Save-Sprite "coin_egg" 510 260 135 135
Save-Sprite "coin_fern" 665 260 135 135

# Row 3: Enemies & Platforms
Save-Sprite "enemy_snail" 20 410 215 175
Save-Sprite "enemy_plant" 245 405 205 185
Save-Sprite "enemy_bug" 465 425 210 160
Save-Sprite "platform_moss" 675 460 330 115

# Row 4: Blocks & Objects
Save-Sprite "block_grass" 10 595 165 165
Save-Sprite "block_stone" 185 615 110 145
Save-Sprite "block_crate" 305 615 135 145
Save-Sprite "trampoline_mushroom" 445 585 135 175
Save-Sprite "hazard_spikes" 585 640 145 120
Save-Sprite "goal_flag" 735 570 120 190
Save-Sprite "sign_arrow" 855 585 135 175

# Also save master transparent spritesheet
$bmp.Save((Join-Path $destDir "spritesheet_transparent.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output "All sprites successfully extracted!"
