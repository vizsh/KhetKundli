# Fills the report's table of contents through Word, saves it, and exports a PDF beside it.
# powershell -ExecutionPolicy Bypass -File scripts/report/finalize.ps1   (from web/, after make-report.mjs)
param([string]$Docx = (Resolve-Path "$PSScriptRoot\..\..\..\docs\KhetKundli-Report.docx").Path)

$pdf = [System.IO.Path]::ChangeExtension($Docx, ".pdf")
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
  $doc = $word.Documents.Open($Docx, $false, $false)
  # Save in Word's own current format so the file opens without compatibility mode.
  $doc.SetCompatibilityMode(15)
  $doc.Repaginate()
  foreach ($toc in $doc.TablesOfContents) { $toc.Update() }
  $doc.Fields.Update() | Out-Null
  foreach ($toc in $doc.TablesOfContents) { $toc.UpdatePageNumbers() }
  $doc.Save()
  $doc.ExportAsFixedFormat($pdf, 17, $false, 0, 0, 1, 1, 0, $true, $true, 1, $true, $true, $false)
  Write-Output ("pages: " + $doc.ComputeStatistics(2))
  $doc.Close($false)
} finally {
  $word.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}
Write-Output "saved $Docx"
Write-Output "pdf   $pdf"
