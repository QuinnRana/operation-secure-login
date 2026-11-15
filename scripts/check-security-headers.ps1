# Start the local app with pnpm dev --host 127.0.0.1.
# Use the URL printed by the development server.
param(
    [Parameter(Mandatory = $true)]
    [uri]$BaseUrl
)

if (-not $BaseUrl.IsAbsoluteUri -or -not $BaseUrl.IsLoopback -or
    $BaseUrl.Scheme -notin @('http', 'https') -or
    $BaseUrl.AbsolutePath -ne '/' -or $BaseUrl.Query -or $BaseUrl.Fragment -or $BaseUrl.UserInfo) {
    throw 'Use a local HTTP or HTTPS origin such as http://127.0.0.1:3000.'
}

$expectedHeaders = [ordered]@{
    'Content-Security-Policy' = "frame-ancestors 'none'"
    'X-Frame-Options' = 'DENY'
}
$failed = $false

foreach ($route in @('/', '/attack-lab', '/defended-lab')) {
    try {
        $response = Invoke-WebRequest -Uri ([uri]::new($BaseUrl, $route)) -UseBasicParsing `
            -MaximumRedirection 0 -TimeoutSec 15 -ErrorAction Stop
        if ($response.StatusCode -ne 200) {
            throw "Expected HTTP 200, got $($response.StatusCode)."
        }
    } catch {
        Write-Host "FAIL $route - $($_.Exception.Message)"
        $failed = $true
        continue
    }

    $routePassed = $true
    foreach ($header in $expectedHeaders.Keys) {
        $actual = $response.Headers[$header] -join ', '
        if ($actual -cne $expectedHeaders[$header]) {
            Write-Host "FAIL $route - $header expected '$($expectedHeaders[$header])', got '$actual'."
            $routePassed = $false
            $failed = $true
        }
    }
    if ($routePassed) {
        Write-Host "PASS $route"
    }
}

if ($failed) {
    exit 1
}
