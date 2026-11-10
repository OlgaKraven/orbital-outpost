function esc(value) {
  return String(value).replace(/[&<>"']/g, character =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function cellLabel(header) {
  return '<span class="mobile-cell-label" aria-hidden="true">' + esc(header) + '</span>';
}

function table(headers, rows, stacked = false) {
  const role = name => stacked ? ' role="' + name + '"' : '';
  return '<div class="table-wrap' + (stacked ? ' worksheet-table' : '') + '"><table' + role('table') + '><thead' + role('rowgroup') + '><tr' + role('row') + '>' +
    headers.map(value => '<th scope="col">' + esc(value) + '</th>').join('') +
    '</tr></thead><tbody' + role('rowgroup') + '>' + rows.map(row => '<tr' + role('row') + '>' +
    row.map((value, index) => '<td' + role('cell') + '>' + (stacked ? cellLabel(headers[index]) : '') + esc(value) + '</td>').join('') +
    '</tr>').join('') + '</tbody></table></div>';
}

function stepList(items) {
  return '<ol class="steps">' + items.map(value => '<li>' + esc(value) + '</li>').join('') + '</ol>';
}

function e01Reference() {
  return '<p>В вашем проекте <code>first-api</code> маршрут <code>GET /api/game</code> читает состояние для прогноза. <code>POST /api/expeditions/E01/transitions</code> передаёт команду <code>{"action":"launch"}</code> для конкретного рейса.</p>' +
    table(['Проверка', 'Код и наблюдение', 'Почему'], [
      ['Чтение перед запуском', '200 · prepared, склад 10/5, снимок 6/2, каталог 7/3, история [prepared]',
        'Склад показывает физический запас. Снимок хранит условия уже подготовленного рейса. Каталог показывает новые условия M01. При чтении ни одна из записей не меняется.'],
      ['Первый запуск E01', 'POST: 200, статус inFlight, склад 4/3. Следующий GET: история [prepared, inFlight]',
        'Статус prepared допускает запуск. Рейс согласован на 6 топлива и 2 пайка, поэтому остаток равен 10 − 6 = 4 и 5 − 2 = 3. Успешный переход добавляет одно событие.'],
      ['Повтор той же команды', 'POST: 409. Следующий GET: inFlight, склад 4/3, прежняя история',
        'Рейс уже в полёте. Проверка статуса срабатывает до списания и добавления события. Состояние после отказа проверяют через GET.'],
      ['Свежая партия с каталогом 8/4', 'Сначала 200, затем 409. После обоих запросов склад 4/3',
        'Изменился currentCost. Снимок agreedCost по-прежнему равен 6/2. Первый запуск использует снимок, повтор отклоняется по статусу.'],
      ['Неизвестная команда, например action: open', '400 · состояние сохраняется',
        'Обработчик принимает только launch и проверяет имя команды до работы с состоянием.']
    ]);
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
