function worksheetHeaders(sheet) {
  return sheet.columns.map(column => '<th scope="col">' + esc(column) + '</th>').join('');
}

function sourceAnchor(id) {
  return (id[0] === 'Б' ? 'b' : 'c') + id[1];
}

function sourceLinks(text) {
  return esc(text).replace(/[БС][1-6](?:–[БС][1-6])?/g, id =>
    '<a href="#simulator-dossier-' + sourceAnchor(id) + '">' + id + '</a>');
}

function lab07HttpGuide() {
  const commands = `$base = 'http://127.0.0.1:5191/api'
$party = Invoke-RestMethod -Method Post -Uri "$base/demo/games?scenario=rations"
$headers = @{ 'X-Game-Id' = $party.id }
$tripUrl = "$base/expeditions/$($party.activeExpedition.id)"
$beforeGame = Invoke-RestMethod "$base/game" -Headers $headers
$beforeTrip = Invoke-RestMethod $tripUrl -Headers $headers

$body = '{"expectedCatalogRevision":2}'
$response = Invoke-WebRequest -Method Post -Uri "$tripUrl/replacements" -Headers $headers -ContentType 'application/json' -Body $body -SkipHttpErrorCheck
$responseText = $response.Content
if ($responseText -is [byte[]]) { $responseText = [Text.Encoding]::UTF8.GetString($responseText) }
$afterGame = Invoke-RestMethod "$base/game" -Headers $headers
$afterTrip = Invoke-RestMethod $tripUrl -Headers $headers

[ordered]@{
    partyId = $party.id
    expeditionId = $party.activeExpedition.id
    request = "POST $tripUrl/replacements"
    requestBody = $body | ConvertFrom-Json
    httpStatus = [int]$response.StatusCode
    responseBody = $responseText | ConvertFrom-Json
    gameBefore = $beforeGame
    gameAfter = $afterGame
    expeditionBefore = $beforeTrip
    expeditionAfter = $afterTrip
    sameGame = (ConvertTo-Json -InputObject $beforeGame -Depth 10 -Compress) -ceq (ConvertTo-Json -InputObject $afterGame -Depth 10 -Compress)
    sameExpedition = (ConvertTo-Json -InputObject $beforeTrip -Depth 10 -Compress) -ceq (ConvertTo-Json -InputObject $afterTrip -Depth 10 -Compress)
} | ConvertTo-Json -Depth 10`;
  return '<details class="station-explanation lab-http-guide"><summary>Выполнить HTTP-проверку дефицита</summary>' +
    '<p><strong>1. Запустите эталонный сервер.</strong> Откройте <a href="https://github.com/OlgaKraven/orbital-outpost">репозиторий</a> и скачайте исходники через <strong>Code → Download ZIP</strong>. ' +
    'В каталоге с <code>OrbitalOutpost.csproj</code> выполните команду с .NET SDK 10 и оставьте сервер работать.</p>' +
    '<pre><code>dotnet run --no-launch-profile --urls http://127.0.0.1:5191</code></pre>' +
    '<p><strong>2. Выполните проверку во втором окне PowerShell 7.</strong> Первая команда создаёт партию с запасом 8/2. ' +
    'Из ответа берутся <code>id</code> для заголовка <code>X-Game-Id</code> и <code>activeExpedition.id</code> для адреса рейса.</p>' +
    '<pre><code>' + esc(commands) + '</code></pre>' +
    '<p><strong>3. Сохраните вывод в протокол.</strong> Ожидаются <code>409</code>, <code>insufficient_supplies</code> и оба значения <code>true</code>. ' +
    'В JSON должны совпасть склад 8/2, резерв 6/2, статус <code>prepared</code> и история. Если реализовали замену в ветви Б, повторите эту проверку на своём API и укажите его адрес в <code>$base</code>. ' +
    'Для ветви А проверьте запуск по снимку и отказ при повторном запуске.</p></details>';
}

function studyWorksheet(stageIndex, saved) {
  const stage = LearningCase.stages[stageIndex];
  return stage.sheets.map(sheet => {
    const rows = saved[sheet.id] ?? [sheet.columns.map(() => '')];
    const cells = rows.map((row, rowIndex) => '<tr role="row">' + sheet.columns.map((column, field) =>
      '<td role="cell">' + cellLabel(column) + '<textarea rows="2" maxlength="600" data-sheet="' + sheet.id + '" data-row="' + rowIndex +
      '" data-cell="' + field + '" aria-label="' + esc(sheet.name + ', строка ' + (rowIndex + 1) + ', ' + column) + '">' +
      esc(row[field] ?? '') + '</textarea></td>').join('') + '</tr>').join('');
    return '<section class="worksheet" aria-labelledby="sheet-' + sheet.id + '"><h3 id="sheet-' + sheet.id + '">' +
      esc(sheet.name) + '</h3><p class="note">Заполнить от ' + sheet.min + ' строк.</p>' +
      '<div class="table-wrap worksheet-table"><table role="table"><thead role="rowgroup"><tr role="row">' + worksheetHeaders(sheet) + '</tr></thead><tbody role="rowgroup">' +
      cells + '</tbody></table></div><button class="button" data-add-row="' + sheet.id + '">Добавить строку</button></section>';
  }).join('');
}

function studyRows(sheet, saved) {
  return (saved[sheet.id] ?? []).filter(row => row.some(value => value.trim()));
}

function completeRows(sheet, saved) {
  return studyRows(sheet, saved).filter(row => sheet.columns.every((_, index) => row[index]?.trim())).length;
}

function studyReview(stageIndex, saved) {
  return LearningCase.stages[stageIndex].sheets.map(sheet => {
    const rows = studyRows(sheet, saved);
    return rows.length ? worksheetReference(sheet, rows) : '';
  }).join('');
}

function worksheetReference(sheet, rows) {
  return '<h4>' + esc(sheet.name) + '</h4>' + table(sheet.columns, rows, true);
}

function worksheetExampleRows(stage, sheet, objective = 'total') {
  const rows = stage.examples[sheet.id] ?? [];
  if (sheet.id === 'requirements') {
    const covered = Course.requirements.filter(([id]) => !['R06', 'R08', 'R18', 'R19'].includes(id));
    return [...covered, ...rows].map(([id, type, ...rest]) => [id, type + ' · подтверждено', ...rest]);
  }
  if (sheet.id === 'revisions') return [...Course.revisions.slice(0, 6), ...rows];
  if (sheet.id === 'matrix') return rows.map(([criterion, weight, a, b]) =>
    [criterion, weight + '%', a.join(' · '), b.join(' · ')]);
  if (sheet.id === 'decision' && objective === 'single') return [stage.singleGoal];
  if (sheet.id === 'decision' && objective === 'both') return [...rows, stage.singleGoal];
  return rows;
}

function caseStageReference(stageIndex, interactive = false) {
  const stage = LearningCase.stages[stageIndex];
  const comparison = Boolean(stage.singleGoal);
  const objectives = comparison && interactive ? '<div class="actions" aria-label="Цель партии">' +
    '<button class="button" data-objective="total" aria-pressed="true">С4 · максимум за партию</button>' +
    '<button class="button" data-objective="single" aria-pressed="false">С5 · минимум 150 по M01</button></div>' : '';
  const solution = comparison ? '<div id="matrix-live" aria-live="polite">' + caseDecision(interactive ? 'total' : 'both') + '</div>' :
    stage.sheets.map(sheet => worksheetReference(sheet, worksheetExampleRows(stage, sheet))).join('');
  return '<h3>Эталон по донесению</h3><p><strong>Задание для сверки.</strong> ' + esc(stage.task) + '</p>' +
    objectives + solution + '<p>' + esc(stage.evidence) + '</p>';
}

function caseDecision(objective) {
  const stage = LearningCase.stages[7];
  const [matrix, decision] = stage.sheets;
  const number = new Intl.NumberFormat('ru', { maximumFractionDigits: 2 });
  const total = column => number.format(stage.examples.matrix.reduce((sum, row) => sum + row[1] * row[column][0] / 100, 0));
  return '<p>Шкала сравнения: 5 получает лучший вариант по критерию, 3 — второй, 4 — оба при равенстве. ' +
    'Для цели С4 самый большой вес у награды за партию. Награда по M01 помогает сравнить варианты при смене цели. ' +
    'Остаток и сложность получают меньшие веса как дополнительные критерии.</p>' +
    worksheetReference(matrix, worksheetExampleRows(stage, matrix)) +
    '<p>Взвешенный итог для С4: А — ' + total(2) + ', Б — ' + total(3) + '. ' +
    (objective !== 'total' ? 'Для С5 порог 150 кредитов по M01 проверяется до сравнения баллов. Ветвь А даёт 100 и исключается.' :
      'При запасе 10/5 обе ветви допустимы, более высокий балл у А.') + '</p>' +
    worksheetReference(decision, worksheetExampleRows(stage, decision, objective));
}
