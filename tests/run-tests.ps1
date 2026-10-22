# Runs tests/market.test.html in headless Edge and prints the result.
# Start a local server first from the repo root:  py -m http.server 3000
param([string]$Url = "http://localhost:3000/tests/market.test.html")
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) { $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe" }
$out = Join-Path $env:TEMP "mk_test_out.html"
Remove-Item $out -ErrorAction SilentlyContinue
Start-Process -FilePath $edge -ArgumentList @("--headless","--disable-gpu","--no-first-run","--user-data-dir=$env:TEMP\edge-mk-tests-$([guid]::NewGuid().ToString('N').Substring(0,8))","--virtual-time-budget=40000","--dump-dom",$Url) -RedirectStandardOutput $out -NoNewWindow -Wait | Out-Null
$t = Get-Content $out -Raw
($t -replace '<[^>]+>','') -split "`n" | Where-Object { $_ -match '^(PASS|FAIL|\d+ passed)' } | ForEach-Object { $_.TrimEnd() }
