# Opens the report in Microsoft Word, refreshes the table of contents and page
# numbers, saves it, and also saves a PDF copy next to it.
# Usage: powershell -ExecutionPolicy Bypass -File update-toc.ps1 [path to .docx]
param([string]$Doc = (Join-Path $PSScriptRoot '..\GVMA_SMS_Project_Report.docx'))

$Doc = (Resolve-Path $Doc).Path
$Pdf = [System.IO.Path]::ChangeExtension($Doc, '.pdf')
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
  $d = $word.Documents.Open($Doc)
  foreach ($toc in $d.TablesOfContents) { $toc.Update() }
  $d.Fields.Update() | Out-Null
  $d.Save()
  $pages = $d.ComputeStatistics(2)
  $d.ExportAsFixedFormat($Pdf, 17)
  $d.Close(0)
  "Updated $Doc ($pages pages)"
  "Saved $Pdf"
} finally { $word.Quit() }
