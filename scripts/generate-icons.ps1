# Regenerate authored icon artwork without external image or font downloads.
Add-Type -AssemblyName System.Drawing
$outputDirectory = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\public'))
foreach ($size in @(192, 512, 180)) {
    $bitmap = New-Object System.Drawing.Bitmap $size, $size
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#14584c'))
    $scale = $size / 512.0
    $graphics.ScaleTransform($scale, $scale)
    $paper = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#fffdf5'))
    $ink = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#14584c'))
    $points = [System.Drawing.PointF[]]@(
        [System.Drawing.PointF]::new(132, 128), [System.Drawing.PointF]::new(380, 128),
        [System.Drawing.PointF]::new(380, 326), [System.Drawing.PointF]::new(240, 326),
        [System.Drawing.PointF]::new(154, 394), [System.Drawing.PointF]::new(154, 326),
        [System.Drawing.PointF]::new(132, 326)
    )
    $graphics.FillPolygon($paper, $points)
    $font = New-Object System.Drawing.Font 'Arial', 148, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center
    $graphics.DrawString('A', $font, $ink, [System.Drawing.RectangleF]::new(132, 128, 248, 198), $format)
    $filename = if ($size -eq 180) { 'apple-touch-icon.png' } else { "icon-$size.png" }
    $bitmap.Save((Join-Path $outputDirectory $filename), [System.Drawing.Imaging.ImageFormat]::Png)
    $format.Dispose(); $font.Dispose(); $ink.Dispose(); $paper.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}
