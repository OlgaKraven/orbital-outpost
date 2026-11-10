function worksheetHeaders(sheet) {
  return sheet.columns.map(column => '<th scope="col">' + esc(column) + '</th>').join('');
}

function sourceAnchor(id) {
  return (id[0] === 'Б' ? 'b' : 'c') + id[1];
}

function sourceLinks(text, prefix = '#simulator-dossier-') {
  const documents = esc(text).replace(/([БС])([1-6])(?:–\1([1-6]))?/g, (_, letter, start, end = start) =>
    Array.from({ length: Number(end) - Number(start) + 1 }, (_, index) => {
      const id = letter + (Number(start) + index);
      return '<a href="' + prefix + sourceAnchor(id) + '">' + id + '</a>';
    }).join(', '));
  return documents.replace(/ЛР0([1-8])/g, (label, number) =>
    '<a href="' + (prefix.startsWith('#') ? '#reference-' : 'student-guide.html#station-') + number + '">' + label + '</a>');
}

function fixtureLinks(text) {
  return esc(text).replace(/\b(?:seed|scenarios)\.json\b/g, name => '<a href="' + name + '">' + name + '</a>');
}

function workedExample(stage, sheet, { row = false, interactive = true, objective = 'total' } = {}) {
  const [sources, origin, api] = LearningCase.worked[sheet.id];
  const values = row ? worksheetExampleRows(stage, sheet, objective)[0] : [];
  return '<details class="worked-example" open><summary>Откуда данные в первой строке</summary>' +
    '<p><strong>Документы.</strong> ' + sourceLinks(sources.join(', '), interactive ? '#simulator-dossier-' : 'brief.html#source-') + '</p>' +
    '<p><strong>Как получить значения.</strong> ' + fixtureLinks(origin) + '</p>' +
    (row ? '<dl>' + sheet.columns.map((column, index) => '<dt>' + esc(column) + '</dt><dd>' + esc(values[index]) + '</dd>').join('') + '</dl>' : '') +
    '<p><strong>Проверка через API.</strong> ' + esc(api) + '</p><p><a href="' +
    (interactive ? '#simulator-api' : 'student-guide.html#api-practice') + '">Открыть пример запроса к серверу</a></p></details>';
}

function apiSourceGuide() {
  const commands = `$base = 'http://127.0.0.1:5191'
$inputs = Invoke-RestMethod "$base/study/fixtures"
$inputs.seed.missions | Where-Object id -eq 'M01' | ConvertTo-Json -Depth 5
$inputs.scenarios.revision | ConvertTo-Json -Depth 5

$party = Invoke-RestMethod -Method Post "$base/api/demo/games?scenario=briefing"
$headers = @{ 'X-Game-Id' = $party.id }
$tripId = $party.activeExpedition.id
$catalog = Invoke-RestMethod "$base/api/missions" -Headers $headers
$catalog | Where-Object id -eq 'M01' | ConvertTo-Json -Depth 5
Invoke-RestMethod "$base/api/expeditions/$tripId" -Headers $headers | ConvertTo-Json -Depth 8
Invoke-RestMethod "$base/api/game" -Headers $headers | ConvertTo-Json -Depth 8`;
  const [fixtures, party, reads] = commands.split(/\n\n|\n(?=\$catalog =)/);
  return '<p>Этот разбор показывает, как полный API создаёт партию и откуда берёт данные. Для первого обработчика E01 используйте инструкцию «Собственный API» в тренажёре.</p>' +
    '<h3>1. Запустите полный сервер</h3><p>Скачайте исходники <a href="https://github.com/OlgaKraven/orbital-outpost">из репозитория</a>. ' +
    'В PowerShell откройте каталог с <code>OrbitalOutpost.csproj</code>. Выполните команду и оставьте окно открытым.</p>' +
    '<pre><code>dotnet run --no-launch-profile --urls http://127.0.0.1:5191</code></pre>' +
    '<h3>2. Прочитайте исходные документы</h3><p>Откройте второе окно PowerShell. Выполняйте следующие команды в нём по порядку, чтобы значения переменных сохранились между шагами.</p>' +
    '<pre><code>' + esc(fixtures) + '</code></pre>' +
    '<p><code>GET /study/fixtures</code> читает файлы из <code>data/</code>. У M01 в <code>seed.json</code> поле <code>revision</code> отсутствует. ' +
    'При загрузке сервер использует значение 1 из <code>MissionDto</code>. Файл <code>scenarios.json</code> задаёт редакцию 2, которую сценарий <code>briefing</code> применяет после подготовки рейса.</p>' +
    '<h3>3. Создайте партию и сохраните идентификаторы</h3><pre><code>' + esc(party) + '</code></pre>' +
    '<p>POST создаёт партию со складом, каталогом и подготовленным рейсом. <code>$headers</code> передаёт серверу <code>X-Game-Id</code>, чтобы запросы читали эту партию. <code>$tripId</code> указывает, какой рейс открыть.</p>' +
    '<h3>4. Прочитайте три записи в созданной партии</h3><pre><code>' + esc(reads) + '</code></pre>' +
    '<p>Сопоставьте три записи. В каталоге M01 есть <code>revision: 2</code>, <code>cost: 7/3</code> и <code>rewardCredits: 160</code>. ' +
    'Рейс хранит <code>catalogRevision: 1</code>, <code>cost: 6/2</code> и <code>rewardCreditsSnapshot: 100</code>. ' +
    'В <code>inventory</code> физический склад 10/5, резерв 6/2, доступно 4/3. В JSON пары представлены полями <code>fuel</code> и <code>rations</code>.</p>' +
    '<p>Для своих проверок меняйте сценарий при создании партии. Передавайте полученный <code>id</code> как <code>X-Game-Id</code>, а в пути рейса используйте <code>activeExpedition.id</code>. ' +
    '<a href="openapi.json">Контракт OpenAPI</a></p>';
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
  return '<details class="station-explanation lab-http-guide" open><summary>Выполнить HTTP-проверку дефицита</summary>' +
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
      workedExample(stage, sheet, { row: true }) +
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
  const solution = comparison ? '<div id="matrix-live" aria-live="polite">' + caseDecision(interactive ? 'total' : 'both', interactive) + '</div>' :
    stage.sheets.map(sheet => worksheetReference(sheet, worksheetExampleRows(stage, sheet)) + workedExample(stage, sheet, { interactive })).join('');
  return '<h3>Эталон по донесению</h3><p><strong>Задание для сверки.</strong> ' + esc(stage.task) + '</p>' +
    objectives + solution + '<p>' + esc(stage.evidence) + '</p>';
}

function caseDecision(objective, interactive = true) {
  const stage = LearningCase.stages[7];
  const [matrix, decision] = stage.sheets;
  const number = new Intl.NumberFormat('ru', { maximumFractionDigits: 2 });
  const total = column => number.format(stage.examples.matrix.reduce((sum, row) => sum + row[1] * row[column][0] / 100, 0));
  return '<p>Шкала сравнения: 5 получает лучший вариант по критерию, 3 — второй, 4 — оба при равенстве. ' +
    'Для цели С4 самый большой вес у награды за партию. Награда по M01 помогает сравнить варианты при смене цели. ' +
    'Остаток и сложность получают меньшие веса как дополнительные критерии.</p>' +
    worksheetReference(matrix, worksheetExampleRows(stage, matrix)) + workedExample(stage, matrix, { interactive }) +
    '<p>Взвешенный итог для С4: А — ' + total(2) + ', Б — ' + total(3) + '. ' +
    (objective !== 'total' ? 'Для С5 порог 150 кредитов по M01 проверяется до сравнения баллов. Ветвь А даёт 100 и исключается.' :
      'При запасе 10/5 обе ветви допустимы, более высокий балл у А.') + '</p>' +
    worksheetReference(decision, worksheetExampleRows(stage, decision, objective)) + workedExample(stage, decision, { interactive });
}
