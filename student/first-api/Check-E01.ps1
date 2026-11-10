param(
    [ValidateSet('7/3','8/4')][string]$Catalog = '7/3',
    [string]$BaseUrl = 'http://localhost:5201'
)
$ErrorActionPreference = 'Stop'

function Read-E01 {
    Invoke-RestMethod -Uri "$BaseUrl/api/game"
}

function Invoke-E01Launch {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Method Post -Uri "$BaseUrl/api/expeditions/E01/transitions" `
            -ContentType 'application/json' -Body '{"action":"launch"}'
        [int]$response.StatusCode
    } catch {
        if (-not $_.Exception.Response) { throw }
        [int]$_.Exception.Response.StatusCode
    }
}

$before = Read-E01
$catalogPair = "$($before.currentCost.fuel)/$($before.currentCost.rations)"
if ($before.status -ne 'prepared' -or $catalogPair -ne $Catalog -or
    "$($before.agreedCost.fuel)/$($before.agreedCost.rations)" -ne '6/2' -or
    "$($before.stock.fuel)/$($before.stock.rations)" -ne '10/5') {
    throw "Ожидается свежая партия: prepared, склад 10/5, снимок 6/2, каталог $Catalog. Проверьте параметры и перезапустите сервер."
}

$first = Invoke-E01Launch
$afterLaunch = Read-E01
if ($first -ne 200 -or $afterLaunch.status -ne 'inFlight' -or
    "$($afterLaunch.stock.fuel)/$($afterLaunch.stock.rations)" -ne '4/3' -or
    ($afterLaunch.history -join ',') -ne 'prepared,inFlight') {
    throw "Первый запуск: получен HTTP $first, статус $($afterLaunch.status), склад $($afterLaunch.stock.fuel)/$($afterLaunch.stock.rations), журнал $($afterLaunch.history -join ', ')."
}

$second = Invoke-E01Launch
$afterRepeat = Read-E01
if ($second -ne 409 -or $afterRepeat.status -ne $afterLaunch.status -or
    $afterRepeat.stock.fuel -ne $afterLaunch.stock.fuel -or $afterRepeat.stock.rations -ne $afterLaunch.stock.rations -or
    ($afterRepeat.history -join ',') -ne ($afterLaunch.history -join ',')) {
    throw "Повтор: получен HTTP $second, статус $($afterRepeat.status), склад $($afterRepeat.stock.fuel)/$($afterRepeat.stock.rations), журнал $($afterRepeat.history -join ', ')."
}

@(
    [pscustomobject]@{ Команда = 'Первый запуск'; HTTP = $first; Статус = $afterLaunch.status; Склад = '4/3'; Журнал = $afterLaunch.history -join ', ' }
    [pscustomobject]@{ Команда = 'Повтор запуска'; HTTP = $second; Статус = $afterRepeat.status; Склад = '4/3'; Журнал = $afterRepeat.history -join ', ' }
) | Format-Table -AutoSize
