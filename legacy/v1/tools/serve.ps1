# 本地静态服务器：让摄像头可以工作（file:// 打开时浏览器会禁用摄像头）
# 无需 Python，Windows 自带 PowerShell 即可
$root = Split-Path -Parent $PSScriptRoot
$port = 8765
$entry = 'index.html'
$url = "http://127.0.0.1:$port/" + [System.Uri]::EscapeDataString($entry)

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$port/")
try { $listener.Start() } catch {
  Write-Host "服务已在运行，直接打开页面。" -ForegroundColor Yellow
  try { Start-Process $url } catch { }
  Start-Sleep -Seconds 2
  exit
}

try { Start-Process $url } catch { }
Write-Host "圣诞树已启动：$url" -ForegroundColor Green
Write-Host "关闭这个窗口即停止服务。" -ForegroundColor DarkGray

$types = @{ '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8';
            '.css'='text/css; charset=utf-8'; '.png'='image/png'; '.jpg'='image/jpeg';
            '.svg'='image/svg+xml'; '.json'='application/json' }

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $path = [System.Uri]::UnescapeDataString($ctx.Request.Url.LocalPath).TrimStart('/')
    if ([string]::IsNullOrWhiteSpace($path)) { $path = $entry }
    $file = Join-Path $root $path
    if (Test-Path -LiteralPath $file -PathType Leaf) {
      $bytes = [System.IO.File]::ReadAllBytes($file)
      $ext = [System.IO.Path]::GetExtension($file).ToLower()
      $ctx.Response.ContentType = if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' }
      $ctx.Response.ContentLength64 = $bytes.Length
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $ctx.Response.StatusCode = 404
    }
    $ctx.Response.Close()
  } catch { }
}
