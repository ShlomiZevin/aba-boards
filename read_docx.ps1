Add-Type -Assembly System.IO.Compression.FileSystem

function Read-DocxText($path) {
    $zip = [IO.Compression.ZipFile]::OpenRead($path)
    $entry = $zip.GetEntry('word/document.xml')
    $stream = $entry.Open()
    $reader = New-Object IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
    $content = $reader.ReadToEnd()
    $reader.Close()
    $zip.Dispose()

    $ms = [regex]::Matches($content, '<w:t[^>]*>([^<]*)</w:t>')
    $out = @()
    foreach ($m in $ms) {
        $v = $m.Groups[1].Value
        if ($v.Trim()) { $out += $v }
    }
    return $out
}

Write-Host "=== Learning Plan 1 ==="
$r1 = Read-DocxText("c:\workspace\aba\aba-boards\תוכניתלמידה1.docx")
$r1 -join "`n"

Write-Host ""
Write-Host "=== Data Collection ==="
$r2 = Read-DocxText("c:\workspace\aba\aba-boards\דף איסוף.docx")
$r2 -join "`n"
