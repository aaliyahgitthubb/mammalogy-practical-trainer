param([int]$Port=8765)
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
$listener.Start()
Write-Host "Mammalogy Trainer running at http://127.0.0.1:$Port/"
$mime = @{
  ".html"="text/html; charset=utf-8"; ".js"="application/javascript; charset=utf-8"; ".css"="text/css; charset=utf-8";
  ".jpg"="image/jpeg"; ".jpeg"="image/jpeg"; ".png"="image/png"; ".gif"="image/gif"; ".webp"="image/webp"; ".svg"="image/svg+xml"
}
while($listener.IsListening){
  try {
    $ctx=$listener.GetContext()
    $path=$ctx.Request.Url.AbsolutePath.TrimStart('/').Replace('/','\')
    if([string]::IsNullOrWhiteSpace($path)){ $path="index.html" }
    $full=Join-Path $root $path
    if((Test-Path $full -PathType Leaf) -and ((Resolve-Path $full).Path.StartsWith((Resolve-Path $root).Path))){
      $bytes=[IO.File]::ReadAllBytes($full)
      $ext=[IO.Path]::GetExtension($full).ToLower()
      $ctx.Response.ContentType= if($mime.ContainsKey($ext)){$mime[$ext]}else{"application/octet-stream"}
      $ctx.Response.ContentLength64=$bytes.Length
      $ctx.Response.OutputStream.Write($bytes,0,$bytes.Length)
    } else {
      $ctx.Response.StatusCode=404
      $bytes=[Text.Encoding]::UTF8.GetBytes("404 Not Found")
      $ctx.Response.OutputStream.Write($bytes,0,$bytes.Length)
    }
    $ctx.Response.Close()
  } catch {}
}
$listener.Stop()
