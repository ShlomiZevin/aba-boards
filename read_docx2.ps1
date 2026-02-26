[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -Assembly System.IO.Compression.FileSystem

$files = Get-ChildItem -Path "c:\workspace\aba\aba-boards" -Filter "*.docx"
foreach ($f in $files) {
    Write-Host ("--- " + $f.Name + " ---")
    $zip = [IO.Compression.ZipFile]::OpenRead($f.FullName)
    $entry = $zip.GetEntry("word/document.xml")
    $stream = $entry.Open()
    $reader = New-Object IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
    $content = $reader.ReadToEnd()
    $reader.Close()
    $zip.Dispose()
    $ms = [regex]::Matches($content, "<w:t[^>]*>([^<]*)</w:t>")
    $out = @()
    foreach ($m in $ms) {
        $v = $m.Groups[1].Value
        if ($v.Trim()) { $out += $v }
    }
    $out -join "`n"
    Write-Host ""
}
