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
    return rows.length ? '<h3>' + esc(sheet.name) + '</h3>' + table(sheet.columns, rows) : '';
  }).join('');
}

function caseStageReference(stageIndex, interactive = false) {
  const stage = LearningCase.stages[stageIndex];
  const tableIndex = [0, 0, 1, 0, 0, 0, 0, 0][stageIndex];
  const headers = stage.sheets[tableIndex].columns;
  let solution;
  switch (stageIndex) {
    case 0:
      solution = table(headers, stage.answer);
      break;
    case 1:
      solution = table(headers, [...Course.requirements, ...stage.answer]);
      break;
    case 2:
      solution = '<h3>Уточнение формулировок</h3>' + table(stage.sheets[0].columns, Course.revisions) +
        '<h3>Истории и критерии</h3>' + table(headers, stage.answer);
      break;
    case 3:
      solution = table(['Термин', 'Определение или пример', 'Решение'], [
        ...Course.glossary.filter(([term]) => !['Миссия', 'Экспедиция', 'Резерв'].includes(term)),
        ...stage.answer.map(([term, example, decision]) => [term, example, decision])
      ]);
      break;
    case 4:
      solution = stateDiagram() + table(['ID', 'Правило и предусловие', 'Основание', 'Результат или проверка'], [
        ...Course.rules,
        ...stage.answer.map(([id, command, condition, result, source]) => [id, command + ' · ' + condition, source, result])
      ]);
      break;
    case 5:
      solution = table(['Таблица', 'Поля и ограничения', 'Происхождение'], Course.schema.map(([entity, fields, origin]) => [
        entity, entity === 'Mission' ? fields + ', Revision · целое > 0' :
          entity === 'Expedition' ? fields + ', CatalogRevision · целое > 0, ReplacesExpeditionId · UUID или NULL' : fields,
        entity === 'Mission' ? 'Текущая редакция в каталоге' : origin
      ])) + '<p>Доступно = физический запас − резерв. Баланс = сумма снимков наград завершённых рейсов.</p>';
      break;
    case 6:
      solution = table(['Требование', 'Наблюдаемая проверка'], [
        ...Course.requirements.map(([id, , , , check]) => [id, check]),
        ...stage.answer.map(([id, rule, fields, endpoint, check]) => [id, [rule, fields, endpoint, check].join(' · ')])
      ]) + '<h3>Контрольные прогоны</h3>' +
        table(['Сценарий', 'Условие', 'Ожидаемый результат'], LearningCase.outcomes);
      break;
    case 7:
      solution = (interactive ? '<div class="actions">' +
        '<button class="button" data-objective="total" aria-pressed="true">С4 · максимум за партию</button>' +
        '<button class="button" data-objective="single" aria-pressed="false">С5 · минимум 150 по M01</button></div>' : '') +
        '<div id="matrix-live" aria-live="polite">' + caseDecision('total') + '</div>';
      break;
  }
  return '<h3>Эталон по донесению</h3>' + solution + '<p>' + esc(stage.evidence) + '</p>';
}

function caseDecision(objective) {
  const single = objective === 'single';
  return table(['Критерий при запасе 10/5', 'А · сохранить условия', 'Б · заменить рейс'], [
    ['Награда по M01', 100, 160],
    ['Награда за партию', 190, 160],
    ['Число рейсов', 2, 1],
    ['Сложность реализации', 'Запуск по снимку', 'Замена в одной транзакции'],
    ['Результат по цели', single ? 'Условие 150 по M01 не выполнено' : 'Лучший результат',
      single ? 'Условие 150 по M01 выполнено' : 'Меньше 190']
  ]) + '<p>' + (single
    ? 'Условие меняет допустимость. Ветвь Б подходит при физическом запасе от 7 топлива и 3 пайков.'
    : 'После старой M01 остаётся 4/3 для M03. При цели максимизировать награду за партию выгодна ветвь А.') + '</p>';
}
