param(
    [ValidateSet('7/3','8/4')][string]$Catalog = '7/3',
    [string]$BaseUrl = 'http://localhost:5201',
    [switch]$AsJson
)
$ErrorActionPreference = 'Stop'

function Invoke-E01Request([string]$Method, [string]$Path, [string]$Json) {
    $uri = "$BaseUrl$Path"
    $options = @{ Uri = $uri; Method = $Method; UseBasicParsing = $true }
    if ($Json) {
        $options.ContentType = 'application/json'
        $options.Body = $Json
    }
    try {
        $response = Invoke-WebRequest @options
        $status = [int]$response.StatusCode
        $content = $response.Content
    } catch {
        if (-not $_.Exception.Response) { throw }
        $status = [int]$_.Exception.Response.StatusCode
        $content = $_.ErrorDetails.Message
    }
    $responseBody = $content
    if ($content) {
        try { $responseBody = ConvertFrom-Json -InputObject $content } catch { }
    }
    $exchange = [ordered]@{ method = $Method.ToUpperInvariant(); url = $uri; httpStatus = $status; responseBody = $responseBody }
    if ($Json) { $exchange.requestBody = ConvertFrom-Json -InputObject $Json }
    [pscustomobject]$exchange
}

$gamePath = '/api/game'
$launchPath = '/api/expeditions/E01/transitions'
$launchBody = '{"action":"launch"}'
$initialRead = Invoke-E01Request Get $gamePath
$before = $initialRead.responseBody
$catalogPair = "$($before.currentCost.fuel)/$($before.currentCost.rations)"
if ($initialRead.httpStatus -ne 200 -or $before.status -ne 'prepared' -or $catalogPair -ne $Catalog -or
    "$($before.agreedCost.fuel)/$($before.agreedCost.rations)" -ne '6/2' -or
    "$($before.stock.fuel)/$($before.stock.rations)" -ne '10/5') {
    throw "Ожидается свежая партия: prepared, склад 10/5, снимок 6/2, каталог $Catalog. Проверьте параметры и перезапустите сервер."
}

$launch = Invoke-E01Request Post $launchPath $launchBody
$launchRead = Invoke-E01Request Get $gamePath
$first = $launch.httpStatus
$afterLaunch = $launchRead.responseBody
if ($first -ne 200 -or $launchRead.httpStatus -ne 200 -or $afterLaunch.status -ne 'inFlight' -or
    "$($afterLaunch.stock.fuel)/$($afterLaunch.stock.rations)" -ne '4/3' -or
    ($afterLaunch.history -join ',') -ne 'prepared,inFlight') {
    throw "Первый запуск: получен HTTP $first, статус $($afterLaunch.status), склад $($afterLaunch.stock.fuel)/$($afterLaunch.stock.rations), журнал $($afterLaunch.history -join ', ')."
}

$repeat = Invoke-E01Request Post $launchPath $launchBody
$repeatRead = Invoke-E01Request Get $gamePath
$second = $repeat.httpStatus
$afterRepeat = $repeatRead.responseBody
if ($second -ne 409 -or $repeatRead.httpStatus -ne 200 -or $afterRepeat.status -ne $afterLaunch.status -or
    $afterRepeat.stock.fuel -ne $afterLaunch.stock.fuel -or $afterRepeat.stock.rations -ne $afterLaunch.stock.rations -or
    ($afterRepeat.history -join ',') -ne ($afterLaunch.history -join ',')) {
    throw "Повтор: получен HTTP $second, статус $($afterRepeat.status), склад $($afterRepeat.stock.fuel)/$($afterRepeat.stock.rations), журнал $($afterRepeat.history -join ', ')."
}

if ($AsJson) {
    [ordered]@{ catalog = $Catalog; exchanges = @($initialRead, $launch, $launchRead, $repeat, $repeatRead) } |
        ConvertTo-Json -Depth 10
    return
}

@(
    [pscustomobject]@{ Команда = 'Первый запуск'; HTTP = $first; Статус = $afterLaunch.status; Склад = '4/3'; Журнал = $afterLaunch.history -join ', ' }
    [pscustomobject]@{ Команда = 'Повтор запуска'; HTTP = $second; Статус = $afterRepeat.status; Склад = '4/3'; Журнал = $afterRepeat.history -join ', ' }
) | Format-Table -AutoSize
