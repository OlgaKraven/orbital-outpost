function esc(value) {
  return String(value).replace(/[&<>"']/g, character =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function table(headers, rows) {
  return '<div class="table-wrap"><table><thead><tr>' +
    headers.map(value => '<th scope="col">' + esc(value) + '</th>').join('') +
    '</tr></thead><tbody>' + rows.map(row => '<tr>' +
    row.map(value => '<td>' + esc(value) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
}

function stepList(items) {
  return '<ol class="steps">' + items.map(value => '<li>' + esc(value) + '</li>').join('') + '</ol>';
}

function stateDiagram() {
  return '<div class="diagram" aria-label="Разрешённые переходы"><span>Подготовлена</span> → <span>В полёте</span> → <span>Завершена</span></div>' +
    '<div class="diagram"><span>Подготовлена</span> → <span>Отменена</span></div>';
}

function weightedMatrix(simplicity = 20) {
  const weights = Course.criteria.map((criterion, index) => index === 2 ? simplicity : criterion[1] * (100 - simplicity) / 80);
  const scores = Course.options.map(([name, values, reason]) => ({
    name, values, reason, score: values.reduce((sum, value, index) => sum + value * weights[index] / 100, 0)
  }));
  const number = new Intl.NumberFormat('ru', { maximumFractionDigits: 2 });
  const winner = [...scores].sort((left, right) => right.score - left.score)[0];
  return table(['Концепция', ...Course.criteria.map(([name], index) => name + ' ' + number.format(weights[index]) + '%'), 'Итог'],
    scores.map(({ name, values, score }) => [name, ...values, number.format(score)])) +
    '<p><strong>Лидер: ' + esc(winner.name) + '.</strong> ' + esc(winner.reason) + '</p>';
}

function referenceContent(key) {
  switch (key) {
    case 'stakeholders':
      return table(['Участник', 'Влияние / интерес', 'Основание', 'Источник'], Course.stakeholders) +
        '<h3>Две карточки взаимодействия</h3>' +
        table(['Кого привлечь', 'Что уточнить', 'Что зафиксировать'], [
          ['Автор правил', 'Можно ли отменять после запуска? Когда фиксируются условия?', 'Таблица переходов и момент фиксации снимка'],
          ['Игрок', 'Достаточно ли цены, награды и доступного запаса для выбора?', 'Состав карточки миссии и проверка понятности']
        ]);
    case 'requirements':
      return table(['ID', 'Класс', 'Источник', 'Требование', 'Трасса и проверка'], Course.requirements) +
        '<p><strong>Открытый вопрос.</strong> При какой нагрузке и по какой метрике оценивать слово «быстро»? Подтверждённое число появится после согласования.</p>';
    case 'stories':
      return '<h3>Журнал переработки</h3>' +
        table(['Черновая фраза', 'Проверяемая формулировка', 'Основание'], Course.revisions) +
        '<h3>Истории и приёмка</h3>' + table(['Роль и ситуация', 'Цель', 'Успех', 'Граница или отказ'], Course.stories);
    case 'glossary':
      return table(['Кандидат', 'Определение', 'Решение'], Course.glossary) +
        '<p><strong>Два спорных решения.</strong> Одна миссия связывается с несколькими попытками через внешние ключи. Баланс вычисляется из завершённых попыток, поэтому его изменение объясняется конкретной экспедицией.</p>';
    case 'rules':
      return stateDiagram() + table(['ID', 'Правило', 'Требование', 'Доказательство'], Course.rules) +
        '<p><strong>Конфликт.</strong> Если фиксировать условия при запуске, изменение каталога может сорвать уже зарезервированный рейс. Выбран снимок при подготовке. Альтернатива потребовала бы повторного согласования и резервирования.</p>';
    case 'schema':
      return table(['Таблица', 'Поля и ограничения', 'Происхождение'], Course.schema) +
        '<h3>Четыре исторических аспекта</h3>' +
        table(['Что меняется', 'Где сохраняется', 'Контроль'], [
          ['Топливо', 'ExpeditionSupply, fuel', '7 в каталоге / 6 в рейсе'],
          ['Пайки', 'ExpeditionSupply, rations', '3 в каталоге / 2 в рейсе'],
          ['Награда', 'Expedition.RewardCreditsSnapshot', '160 в каталоге / 100 в рейсе'],
          ['Состояние', 'ExpeditionStatusEvent', 'prepared, inFlight, completed по sequence']
        ]) +
        '<p>Доступно = физический запас − резерв. Баланс = сумма наград из завершённых экспедиций. Снимок подходит для вопроса о конкретном рейсе. Версии с периодами понадобятся для запроса о состоянии каталога на произвольную дату.</p>';
    case 'audit':
      return table(['ID', 'Действие', 'Ожидаемый результат', 'Требование'], Course.audit) +
        '<h3>Обратная трассировка</h3>' +
        table(['Элемент', 'Обоснование'], [
          ['rewardCreditsSnapshot', 'R10 фиксирует значение. R16 использует его в балансе'],
          ['sequence', 'R06 требует порядок событий, R11 — сохранение каждого перехода'],
          ['OneActiveExpedition', 'R13 ограничивает число активных рейсов. R18 требует атомарного отказа'],
          ['OnHand', 'R07 требует расчёт доступности. R15 меняет физический остаток']
        ]);
    case 'matrix':
      return table(['Критерий', 'Вес', 'Основание'], Course.criteria.map(([name, weight, source]) => [name, weight + '%', source])) +
        '<p>Сначала проверяются обязательные условия: законченный цикл, сохранение состояния и серверная проверка. Затем умножаются оценки на веса и складываются результаты.</p>' +
        '<h3>Исходные веса</h3>' + weightedMatrix(20) +
        '<h3>Вес простоты 35%</h3>' + weightedMatrix(35) +
        '<p><strong>Карточка решения.</strong> Выбран «Орбитальный форпост». Он объединяет резерв, переходы и историю в одной партии. Цена выбора — дополнительная логика запуска и отмены. При большем приоритете простоты пересматривается выбор в пользу «Мастерской».</p>';
    default:
      throw new Error('Неизвестный раздел эталона.');
  }
}
