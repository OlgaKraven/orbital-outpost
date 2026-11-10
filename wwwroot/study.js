function worksheetHeaders(sheet) {
  return sheet.columns.map(column => '<th scope="col">' + esc(column) + '</th>').join('');
}

function studyWorksheet(stageIndex, saved) {
  const stage = LearningCase.stages[stageIndex];
  return stage.sheets.map(sheet => {
    const rows = saved[sheet.id] ?? [sheet.columns.map(() => '')];
    const cells = rows.map((row, rowIndex) => '<tr>' + sheet.columns.map((column, field) =>
      '<td><textarea rows="2" maxlength="600" data-sheet="' + sheet.id + '" data-row="' + rowIndex +
      '" data-cell="' + field + '" aria-label="' + esc(sheet.name + ', строка ' + (rowIndex + 1) + ', ' + column) + '">' +
      esc(row[field] ?? '') + '</textarea></td>').join('') + '</tr>').join('');
    return '<section class="worksheet" aria-labelledby="sheet-' + sheet.id + '"><h3 id="sheet-' + sheet.id + '">' +
      esc(sheet.name) + '</h3><p class="note">Заполнить от ' + sheet.min + ' строк.</p>' +
      '<div class="table-wrap"><table><thead><tr>' + worksheetHeaders(sheet) + '</tr></thead><tbody>' +
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
  return '<h4>' + esc(sheet.name) + '</h4>' + table(sheet.columns, rows);
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
