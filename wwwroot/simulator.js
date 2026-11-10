const scenarios = [
  { id: 'e01', title: 'Рейс E01', description: 'Начальные данные и проверка запуска · каталог 7/3' },
  { id: 'launch-transfer', title: 'Перенос E01', description: 'Те же условия рейса · каталог 8/4' },
  { id: 'briefing', title: 'После донесения', description: 'Сохранить условия или заменить рейс · запас 10/5' },
  { id: 'boundary', title: 'Ровно по норме', description: 'Замена на границе · запас 7/3' },
  { id: 'shortage', title: 'Не хватает двух ресурсов', description: 'Проверить отказ при замене · запас 6/2' },
  { id: 'rations', title: 'Не хватает пайков', description: 'Проверить отказ при замене · запас 8/2' },
  { id: 'free', title: 'Свободная партия', description: 'Самостоятельно выбрать миссии и сравнить стратегии' }
];
const simChapters = ['Разобраться в запросе', 'Прочитать данные и запустить рейс', 'Проверить повторный запрос', 'Написать свой API', 'Проверить каталог 8/4'];
const simPair = value => value.fuel + ' / ' + value.rations;
const simLink = (label, hash, mainAction = false) =>
  '<a class="' + (mainAction ? 'button primary' : 'sim-text-link') + '" href="#simulator' +
  (hash ? '-' + hash : '') + '">' + esc(label) + '</a>';
const simButton = (label, action, value = '') =>
  '<button type="button" class="button primary" data-game="' + action + '" data-value="' + esc(value) +
  '" data-focus="' + action + esc(value) + '"' + (gameSession.busy ? ' disabled' : '') + '>' + esc(label) + '</button>';
const simCode = value => '<pre><code>' + esc(value) + '</code></pre>';
const simText = value => '<p>' + esc(value) + '</p>';
let detachSimAnimation;

function simReturn(label = 'Вернуться к шагу') {
  return '<a class="button primary" href="' + esc(lastMainRoute) + '">' + esc(label) + '</a>';
}

function unmountSimAnimation() {
  detachSimAnimation?.();
  detachSimAnimation = undefined;
}

function simAnimation() {
  return '<details class="sim-animation"><summary>Разобрать, как собрать запрос запуска</summary><div data-sim-animation></div></details>';
}

function simPrediction(id, hint, value) {
  return '<label class="sim-prediction" for="' + id + '"><strong>Мой прогноз</strong><span>' + esc(hint) +
    '</span><textarea id="' + id + '" rows="2" maxlength="2000">' + esc(value ?? '') +
    '</textarea><small>Запись сохранится в браузере и попадёт в протокол.</small></label>';
}

function simulatorScreen() {
  const screen = location.hash.slice('#simulator'.length).replace(/^-/, '');
  return screen.startsWith('dossier-') ? 'dossier' : screen || 'run';
}

function simUsesGame() {
  return ['run', 'scenarios', 'journal', 'compare', 'catalog', 'actions'].includes(simulatorScreen());
}

function simIsE01(game) {
  return ['launch-transfer', 'custom'].includes(game?.scenarioId) || (game && simTrack?.id === game.id && simTrack.exercise === 'e01');
}

function simChapterRail(current) {
  return '<div class="sim-progress"><div><p>Этап ' + (current + 1) + ' из ' + simChapters.length +
    ' <strong>' + esc(simChapters[current]) + '</strong></p>' +
    (simChapters[current + 1] ? '<span>Далее: ' + esc(simChapters[current + 1]) + '</span>' : '') + '</div>' +
    '<progress value="' + (current + 1) + '" max="' + simChapters.length + '" aria-label="Этап практики E01"></progress></div>';
}

function simPanel(eyebrow, title, contents, action = '', secondary = '') {
  return '<section class="sim-panel"><p class="sim-eyebrow">' + esc(eyebrow) + '</p><h2>' +
    esc(title) + '</h2>' + contents +
    (action || secondary ? '<div class="sim-actions">' + action + secondary + '</div>' : '') + '</section>';
}

function renderSimulator() {
  unmountSimAnimation();
  const screen = simulatorScreen();
  const game = gameSession.game;
  const localFile = location.protocol === 'file:';
  let body;
  if (screen.startsWith('build')) body = simBuild(Number(screen.split('-')[1] ?? 1));
  else if (screen === 'learn') body = simOrientation();
  else if (screen === 'data') body = simData(localFile);
  else if (screen === 'materials') body = simMaterials();
  else if (screen === 'dossier') body = simDossier();
  else if (screen === 'api') body = simPanel('Работа с API', 'Проверьте источники данных на сервере', apiSourceGuide(), simReturn(), simLink('Свои данные', 'custom'));
  else if (screen === 'custom') body = simCustom();
  else if (screen === 'reference') body = simReference();
  else if (screen === 'project') body = simProjectBridge();
  else if (localFile) body = simPanel('Тренажёр E01', 'Подготовьтесь к рейсу',
    '<p>Объяснения, данные и инструкция работают в этом файле. Для запросов запустите <code>Start-Outpost.cmd</code> из полного архива и откройте адрес, показанный в окне сервера.</p>',
    simLink('Разобрать запрос', 'learn', true));
  else if (screen === 'scenarios') body = simScenarios();
  else if (screen === 'journal') body = simJournal(game);
  else if (browserDemo && ['compare', 'catalog', 'actions'].includes(screen)) body = simPanel('Проект с SQLite',
    'Продолжите на сервере', '<p>Для партий с несколькими миссиями запустите полную сборку. Здесь доступны оба варианта E01.</p>',
    '<a class="button primary" href="https://github.com/OlgaKraven/orbital-outpost#запуск-исходного-проекта">Как запустить проект</a>',
    simLink('Выбрать вариант E01', 'scenarios'));
  else if (screen === 'compare') body = simComparison(game);
  else if (screen === 'catalog') body = simCatalog(game);
  else if (screen === 'actions') body = simActions(game);
  else if (!game && gameSession.busy) body = simPanel('Связь с форпостом', 'Читаем состояние партии', '');
  else body = game ? simRun(game) : simOrientation();

  const scenarioControl = !localFile && ['run', 'learn', 'data'].includes(screen)
    ? simLink(screen === 'run' && game ? 'Сменить сценарий' : 'Выбрать другой сценарий', 'scenarios') : '';
  const workspaceLabel = game && !simIsE01(game) && simUsesGame() ? 'Партия' : 'Практика E01';
  main.innerHTML = '<div class="sim-shell"><header class="sim-heading"><p>' + workspaceLabel + '</p>' + scenarioControl + '</header>' +
    '<div id="sim-message" class="sim-status' + (gameSession.failed ? ' sim-status-error' : '') + '" role="status" tabindex="-1">' +
    (simUsesGame() || gameSession.busy || gameSession.failed ? gameSession.busy
      ? browserDemo ? 'Выполняем учебную команду…' : 'Ожидаем ответ сервера…' : esc(gameSession.message) : '') + '</div>' + body + '</div>';
  if (screen === 'custom') updateCustomPreview(main.querySelector('[data-sim-form="custom"]'));
  const animation = main.querySelector('.sim-animation');
  animation?.addEventListener('toggle', () => {
    if (!animation.isConnected) return;
    if (animation.open) detachSimAnimation = mountPrimer(animation.querySelector('[data-sim-animation]'), 2, true);
    else unmountSimAnimation();
  });
}

function simMaterials() {
  return simPanel('Учебные материалы', 'Один комплект для практики',
    '<p>В архиве — данные, рабочие листы, заготовки C# и проверка E01. Объяснения и эталон доступны в этом тренажёре.</p>',
    '<a class="button primary" href="student-kit.zip" download>Скачать комплект студента</a>',
    simLink('Досье и данные', 'dossier') + simLink('Эталон проверки', 'reference') + simLink('Запросы к серверу', 'api') + simLink('Свои данные', 'custom') +
      '<a class="sim-text-link" href="' + esc(lastMainRoute) + '">Вернуться к шагу</a>');
}

function simDossier() {
  const documents = rows => rows.map(([id, title, description]) =>
    '<article class="dossier-source" id="simulator-dossier-' + sourceAnchor(id) + '" tabindex="-1"><h4>' +
    esc(id + ' · ' + title) + '</h4><p>' + esc(description) + '</p></article>').join('');
  return simPanel('Исходные данные', 'Донесение с орбиты',
    '<p><a class="button primary" href="' + esc(lastMainRoute) + '">Вернуться к шагу</a></p>' +
    '<p><a href="#simulator-dossier-b1">Исходный бриф · Б1–Б5</a> · <a href="#simulator-dossier-c1">Донесение · С1–С6</a></p>' +
    '<section><h3>Исходный бриф · Б1–Б5</h3>' + documents(Course.sources) + '</section>' +
    '<section><h3>Донесение · С1–С6</h3>' + documents(LearningCase.documents) + '</section>' +
    '<h3>Исходный каталог</h3>' + table(['Код', 'Миссия', 'Топливо', 'Пайки', 'Награда'], Course.missions) +
    '<p>В задании E01 условия текущего каталога меняются с 7/3 на 8/4. Подготовленный рейс хранит снимок 6/2.</p>' +
    '<p><a href="seed.json">Исходный каталог JSON</a> · <a href="scenarios.json">Наборы сценариев JSON</a> · ' + simLink('Проверить данные через API', 'api') + '</p>',
    '', simLink('Материалы', 'materials'));
}

function simReference() {
  return simPanel('Сверка результата', 'Эталон E01 и учебных сценариев',
    e01Reference() +
    '<h3>Проект с SQLite</h3>' + table(['Проверка', 'Условие', 'Ожидаемый результат'], LearningCase.outcomes) +
    '<p>Чтобы сверить рабочий лист, откройте свою станцию и выберите «Свериться с эталоном».</p>',
    simReturn(), '<a class="sim-text-link" href="#map">Карта ЛР01–ЛР08</a>');
}

function simOrientation() {
  const localFile = location.protocol === 'file:';
  return simChapterRail(0) + simPanel('01 · Брифинг', 'Что именно делает API',
    '<p>Диспетчер отправляет команду запуска. API принимает запрос, проверяет состояние рейса и возвращает ответ. Прототип — небольшой работающий фрагмент этой системы. Вы построите чтение состояния и запуск одного рейса.</p>' +
    '<ol class="sim-signal"><li><strong>Запрос</strong><span>GET читает состояние. POST передаёт команду.</span></li>' +
    '<li><strong>Правило</strong><span>Сервер проверяет статус и списывает ресурсы по снимку рейса.</span></li>' +
    '<li><strong>Ответ</strong><span>Код показывает результат. JSON передаёт данные в виде именованных полей.</span></li></ol>' +
    '<div class="sim-code-note"><p><strong>Тело команды запуска</strong> содержит поле <code>action</code> со строковым значением <code>launch</code>.</p>' +
    simCode('{ "action": "launch" }') + '</div>' + simAnimation() +
    (browserDemo ? '<p class="note">Здесь вы проверяете правило в учебной модели в браузере. В разделе «Собственный API» вы запустите C# и проверите реальные HTTP-запросы.</p>' : ''),
    localFile ? simLink('Разобрать данные', 'data', true) : simButton('Открыть исходные данные E01', 'new', 'e01'),
    simLink('Свои данные', 'custom'));
}

function simData(localFile) {
  return simChapterRail(1) + simPanel('02 · Досье E01', 'Сопоставьте склад, рейс и каталог',
    '<p>Штаб обновил M01, когда рейс уже был подготовлен. Нужно определить, из какой записи обработчик возьмёт стоимость запуска.</p>' +
    table(['Запись', 'Топливо', 'Пайки'], [
      ['Физический запас', 10, 5], ['Согласованные условия E01', 6, 2], ['Текущая карточка M01', 7, 3]
    ]) +
    '<p>' + sourceLinks('С1') + ' даёт склад 10/5 и снимок 6/2, ' + sourceLinks('С2') + ' — новую карточку 7/3. ' +
    'В <code>first-api/Program.cs</code> им соответствуют <code>stock</code>, <code>agreedCost</code> и <code>currentCost</code>. ' +
    'Полная версия создаёт эти записи из <a href="seed.json">исходного каталога</a> и <a href="scenarios.json">сценариев</a>.</p>' +
    simPrediction('sim-prediction', 'Запишите источник списания, ожидаемый остаток и что произойдёт при повторе.', simNotebook.prediction),
    localFile ? simLink('Перейти к инструкции по C#', 'build', true) : simButton('Открыть рейс E01', 'new', 'e01'),
    simLink('К объяснению запроса', 'learn'));
}

function simInventory(game) {
  const inv = game.inventory;
  return '<div class="sim-inventory"><h3>Запасы</h3>' +
    table(['Ресурс', 'Склад', 'Резерв', 'Доступно'], [
      ['Топливо', inv.onHand.fuel, inv.reserved.fuel, inv.available.fuel],
      ['Пайки', inv.onHand.rations, inv.reserved.rations, inv.available.rations]
    ]) + '<p class="sim-balance"><strong>' + game.credits + '</strong> кредитов</p></div>';
}

function simTripFacts(game, trip, mission) {
  const stock = game.inventory.onHand;
  const rows = [
    ['Склад', 'Запас до команды', stock],
    ['Снимок рейса', 'Записано при подготовке', trip.cost],
    ...(mission ? [['Каталог ' + mission.id, 'Условия для новых рейсов', mission.cost]] : [])
  ];
  return '<div class="table-wrap"><table class="sim-sources"><thead><tr>' +
    '<th scope="col">Источник данных</th><th scope="col">Топливо</th><th scope="col">Пайки</th></tr></thead><tbody>' +
    rows.map(([name, meaning, value]) => '<tr><th scope="row">' + esc(name) + '<small>' + esc(meaning) + '</small></th><td>' +
      value.fuel + '</td><td>' + value.rations + '</td></tr>').join('') + '</tbody></table></div>';
}

function simEvents(trip) {
  return table(['№', 'Событие'], trip.history.map(item => [item.sequence, statuses[item.toStatus] ?? item.toStatus]));
}

const missionGoals = {
  total: 'Набрать максимум кредитов за партию',
  single: 'Получить не менее 150 кредитов именно за M01'
};

function simBriefingChoice(game, trip, mission) {
  const goal = simGoal?.id === game.id ? simGoal.choice : null;
  if (!goal) {
    return simPanel('Сценарий · после донесения', 'Сначала выберите цель партии',
      '<p>Редактор обновил M01 после подготовки рейса. Диспетчер может отправить рейс по старым условиям или заменить его. Чтобы сравнить решения, зафиксируйте цель.</p>' +
      simPicker('Что требуется получить?', [
        { value: 'total', title: missionGoals.total, description: 'Разрешено выполнить несколько миссий, пока хватает запасов.' },
        { value: 'single', title: missionGoals.single, description: 'Считается только награда за один рейс M01.' }
      ], 'goal', 'Зафиксировать цель', false));
  }
  return simPanel('Сценарий · после донесения', 'Выберите, как выполнить M01',
    '<p><strong>Цель.</strong> ' + esc(missionGoals[goal]) + '.</p>' +
    table(['Вариант', 'Топливо', 'Пайки', 'Награда за M01'], [
      ['Сохранить снимок', trip.cost.fuel, trip.cost.rations, trip.rewardCreditsSnapshot],
      ['Принять редакцию ' + mission.revision, mission.cost.fuel, mission.cost.rations, mission.rewardCredits]
    ]) + '<p>На складе ' + simPair(game.inventory.onHand) + ' (топливо / пайки). Оцените, что останется для следующей миссии.</p>' +
    simPicker('Как поступит диспетчер?', [
      { value: 'launch', title: 'Запустить по снимку', description: 'Отправить подготовленный рейс на согласованных условиях.', action: 'transition' },
      { value: String(mission.revision), title: 'Заменить рейс', description: 'Проверить запас и подготовить новый рейс по текущей редакции.', action: 'replace' }
    ], 'command', 'Выполнить решение', false), '',
    '<button type="button" class="text-button" data-reset-goal>Изменить цель</button>' +
      simLink('Проверить другие команды', 'actions'));
}

function simRun(game) {
  if (simIsE01(game)) return simE01(game);
  const trip = gameSession.selected;
  const choice = scenarios.find(item => item.id === game.scenarioId);
  const mission = gameSession.missions.find(item => item.id === trip?.missionId);
  const goal = simGoal?.id === game.id ? simGoal.choice : null;
  const links = simLink('Журнал и ответы HTTP', 'journal') + simLink('Другие операции', 'actions');
  let panel;
  if (game.activeExpedition && trip?.status === 'prepared') {
    if (game.scenarioId === 'briefing' && mission?.revision > trip.catalogRevision) return simBriefingChoice(game, trip, mission);
    const replacing = mission?.revision > trip.catalogRevision && ['boundary', 'shortage', 'rations'].includes(game.scenarioId);
    const checked = simChecked?.id === game.id && simChecked.tripId === trip.id && simChecked.type === 'replacement';
    panel = simPanel(choice?.title ?? 'Рейс подготовлен', checked ? 'Отказ замены зафиксирован' : replacing ? 'Проверьте замену рейса' : 'Рейс готов к запуску',
      simText(checked ? 'Сверьте старый резерв и историю в журнале.' : replacing
        ? 'Сервер проверит, можно ли пересоздать резерв по текущей редакции.'
        : 'Запуск спишет стоимость, зафиксированную при подготовке.') +
      simTripFacts(game, trip, mission), checked ? simLink('К другим сценариям', 'scenarios', true) : replacing
        ? simButton('Проверить замену', 'replace', String(mission.revision)) : simButton('Запустить рейс', 'transition', 'launch'), links);
  } else if (game.activeExpedition && trip?.status === 'inFlight') {
    panel = simPanel(choice?.title ?? 'Рейс', 'Рейс в полёте', simText('Списание уже выполнено. Завершите рейс, чтобы учесть награду.') + simInventory(game),
      simButton('Завершить рейс', 'transition', 'complete'), links);
  } else if (!game.expeditions.length) {
    panel = simPanel(choice?.title ?? 'Рейс', 'Выберите миссию', simText('На складе есть стартовый запас. Выберите одну миссию для подготовки.') + simInventory(game),
      simLink('Открыть каталог', 'catalog', true));
  } else {
    const available = gameSession.missions.some(item => simMissionAvailable(game, item));
    const completedM01 = game.expeditions.find(item => item.missionId === 'M01' && item.status === 'completed');
    const m03 = gameSession.missions.find(item => item.id === 'M03');
    const followM03 = goal === 'total' && completedM01?.catalogRevision === 1 && m03 && simMissionAvailable(game, m03);
    const anotherFlight = available && !(goal === 'single' && completedM01);
    const result = goal === 'single' && completedM01
      ? 'Награда за M01 — ' + completedM01.rewardCreditsSnapshot + ' кредитов. ' +
        (completedM01.rewardCreditsSnapshot >= 150 ? 'Цель выполнена.' : 'Для цели требуется минимум 150.')
      : followM03 ? 'После M01 остался запас для M03. Ещё один рейс увеличит итоговую награду.'
        : 'Сверьте остаток и награду. Итог контрольной стратегии сохраняется в сравнении.';
    panel = simPanel(choice?.title ?? 'Рейс', 'Итог партии',
      (goal ? '<p><strong>Цель.</strong> ' + esc(missionGoals[goal]) + '.</p>' : '') + simText(result) + simInventory(game),
      followM03 ? simButton('Подготовить M03', 'prepare', 'M03') :
        anotherFlight ? simLink('Выбрать следующий рейс', 'catalog', true) : simLink('Сравнить стратегии', 'compare', true),
      links + (anotherFlight ? simLink('Сравнить стратегии', 'compare') : ''));
  }
  return panel;
}

function simE01(game) {
  const trip = gameSession.selected;
  if (!trip) return simPanel('Рейс E01', 'Подготовьте рейс',
    simText('Для продолжения создайте исходную учебную партию.'), simButton('Открыть рейс E01', 'new', 'e01'));
  const mission = gameSession.missions.find(item => item.id === trip.missionId);
  const transfer = game.scenarioId === 'launch-transfer';
  const custom = game.scenarioId === 'custom';
  const checked = simChecked?.id === game.id && simChecked.tripId === trip.id && simChecked.type === 'repeat';
  const step = trip.status === 'prepared' ? 0 : trip.status === 'inFlight' && !checked ? 1 : 2;
  const label = custom ? 'Рейс E01 · свои данные' : transfer ? 'Рейс E01 · изменённый каталог 8/4' : 'Рейс E01 · исходный каталог 7/3';
  const journal = simLink('Журнал и ответы HTTP', 'journal');
  const recorded = attemptFor(game);
  let panel;
  if (step === 0) {
    const prompt = '<form data-sim-form="launch"><fieldset class="sim-pick"><legend>По какой записи, по вашему прогнозу, сервер спишет ресурсы?</legend>' +
      '<p class="sim-hint">Отметьте один вариант. Затем отправьте запрос запуска.</p>' +
      ['snapshot', 'catalog'].map(source => '<label class="sim-option"><input type="radio" name="selection" value="' + source +
        '" required' + (recorded?.source === source ? ' checked' : '') + '><span>' +
        (source === 'snapshot' ? 'По снимку рейса' : 'По текущему каталогу') + '</span></label>').join('') +
      '</fieldset><div class="sim-actions"><button class="button primary" type="submit" data-focus="launch-e01"' +
      (gameSession.busy ? ' disabled' : '') + '>Запустить рейс</button>' + simLink('К объяснению запроса', 'learn') + '</div></form>';
    panel = simPanel(label, 'Предскажите, что спишет сервер',
      simText('Штаб обновил M01, когда рейс уже был подготовлен. В таблице показаны три записи, которые видит диспетчер.') +
      simTripFacts(game, trip, mission) + (custom ? '<p class="note">Значения получены из вашего запроса. Награда за рейс по снимку — ' +
      trip.rewardCreditsSnapshot + ', по текущему каталогу — ' + mission.rewardCredits + '.</p>' : '<p class="note">Склад и согласованные условия — ' + sourceLinks('С1') +
      '. Текущая карточка — ' + (transfer ? '<a href="scenarios.json">scenarios.json</a>, набор <code>launch-transfer</code>, поле <code>catalogCost</code>' : sourceLinks('С2')) +
      '. <a href="#simulator-build">Поля собственного API E01</a></p>') + prompt);
  } else if (step === 1) {
    const result = recorded?.firstLaunch?.spent;
    const explanation = result ? '<p class="sim-observation"><strong>Списание (топливо / пайки) — ' + simPair(result) +
      '.</strong> Это условия из снимка. ' + (recorded.source === 'catalog'
        ? 'Вы предположили, что сервер возьмёт каталог. Рейс был подготовлен раньше, поэтому сработал снимок.' :
        'Прогноз совпал с ответом сервера.') + '</p>' : '';
    panel = simPanel(label, 'Повторите ту же команду',
      '<p>Первый запуск принят. Статус рейса — <strong>«В полёте»</strong>. Что произойдёт, если отправить тот же запрос ещё раз?</p>' +
      explanation + simInventory(game), simButton('Повторить запуск', 'retry', 'launch'), journal);
  } else {
    const checkText = checked
      ? '<p>Повторный запрос вернул <strong>409 Conflict</strong>. ' + (browserDemo ? 'Учебная модель сохранила' : 'Сервер сохранил') + ' статус, запас и историю рейса.</p>'
      : '<p>Рейс имеет статус <strong>' + esc(statuses[trip.status] ?? trip.status) + '</strong>. Для проверки двух запусков можно начать свежую партию.</p>';
    const observed = '<div class="sim-result"><p><strong>Физический остаток · ' +
      simPair(game.inventory.onHand) + '</strong></p>' + simEvents(trip) + '</div>';
    const prediction = custom ? null : (transfer ? simNotebook.transferPrediction : simNotebook.prediction)?.trim();
    const evidence = transfer ? table(['Каталог', 'Первый запуск', 'Повтор', 'Остаток после повтора'],
      [['7/3', completedE01('catalog73')], ['8/4', completedE01('catalog84')]].map(([name, attempt]) => [
        name, attempt?.firstLaunch?.http ?? '—', attempt?.repeatLaunch?.http ?? '—',
        attempt?.repeatLaunch ? simPair(attempt.repeatLaunch.stock) : '—'
      ])) : '';
    panel = simPanel(label, 'Сверьте прогноз с журналом', checkText + observed +
      (prediction ? '<p class="sim-saved"><strong>Мой прогноз.</strong> ' + esc(prediction) + '</p>' : '') + evidence,
      custom ? simLink('Изменить свои данные', 'custom', true) :
        transfer ? simLink('К итогам проекта', 'project', true) : simLink('Написать свой обработчик', 'build', true),
      journal + (transfer || custom ? '<button type="button" class="text-button sim-text-link" data-export-study>Скачать протокол</button>' : ''));
  }
  return simChapterRail(transfer ? 4 : step === 0 ? 1 : 2) + panel;
}

function simProjectBridge() {
  const rows = [['7/3', completedE01('catalog73')], ['8/4', completedE01('catalog84')],
    ['Свои данные', completedE01('catalogCustom')]].flatMap(([catalog, observed]) =>
    observed ? [[catalog, observed.firstLaunch.http, observed.repeatLaunch.http,
      simPair(observed.repeatLaunch.stock)]] : []);
  const studentApi = simNotebook.studentApi ?? {};
  return simPanel('Объём проекта', 'Какое решение подходит вашей задаче',
    table(['Что требуется', 'Достаточное решение'], [
      ['Один учебный рейс, состояние сбрасывается при перезапуске', 'E01 в памяти. Один GET для состояния и один POST для запуска.'],
      ['Несколько рейсов и история после перезапуска', 'Проект с SQLite. Понадобятся модель данных, каталог и сохранённые события.']
    ]) +
    '<h3>1. Прогоны тренажёра</h3>' + (rows.length ? table(['Каталог', 'Запуск', 'Повтор', 'Остаток'], rows) :
      '<p>Результаты появятся после запуска и повтора в E01.</p>') +
    '<h3>2. Проверка собственного API</h3><p>Для сдачи приложите папку <code>first-api</code>, фактические HTTP-запросы и ответы по обоим каталогам, ' +
    'состояние после каждой команды и объяснение выбора источника стоимости.</p>' +
    '<ul><li><a href="#simulator-build-3">Каталог 7/3</a> · ' + (studentApi.catalog73?.trim() ? 'Протокол записан' : 'Ожидает протокола') +
    '</li><li><a href="#simulator-build-4">Каталог 8/4</a> · ' + (studentApi.catalog84?.trim() ? 'Протокол записан' : 'Ожидает протокола') + '</li></ul>' +
    '<p>Если нужен проект с хранением истории, перенесите правило снимка в ЛР04–ЛР06, а проверки запуска и повтора — в ЛР07.</p>',
    rows.length || Object.keys(simNotebook).length ? '<button class="button primary" type="button" data-export-study>Скачать протокол E01</button>' :
      simLink('Пройти практику E01', 'learn', true),
    '<a class="sim-text-link" href="#map">Продолжить по карте ЛР01–ЛР08</a>');
}

function simPicker(name, options, action, submitText, returnLink = true) {
  return '<form data-sim-form="' + action + '"><fieldset class="sim-pick"><legend>' + esc(name) + '</legend>' +
    options.map(({ value, title, description, checked, action: command }) => '<label class="sim-option"><input type="radio" name="selection" value="' +
      esc(value) + '"' + (checked ? ' checked' : '') + (command ? ' data-command="' + command + '"' : '') +
      ' required><span><strong>' + esc(title) + '</strong><small>' + esc(description) + '</small></span></label>').join('') +
    '</fieldset><div class="sim-actions"><button class="button primary" type="submit"' +
    (gameSession.busy ? ' disabled' : '') + '>' + esc(submitText) + '</button>' +
    (returnLink ? simLink('К текущему рейсу', '') : '') + '</div></form>';
}

function simScenarios() {
  const current = simIsE01(gameSession.game) && gameSession.game?.scenarioId === 'briefing' ? 'e01' :
    gameSession.game?.scenarioId ?? 'e01';
  const available = browserDemo ? scenarios.slice(0, 2) : scenarios;
  return simPanel('Выбор условий', 'Откройте один сценарий',
    '<p>Отметьте нужный набор и нажмите «Открыть сценарий». Откроется отдельная партия с указанными условиями.</p>' +
    simPicker('Данные для следующего рейса', available.map(item => ({ value: item.id, title: item.title,
      description: item.description, checked: item.id === current })), 'new', 'Открыть сценарий') +
    (browserDemo ? '<p class="note">Сценарии замены и нескольких рейсов доступны в полной версии. ' +
      '<a href="https://github.com/OlgaKraven/orbital-outpost#запуск-исходного-проекта">Как запустить проект</a></p>' : '') +
    '<p>Чтобы проверить свои числовые значения, ' + simLink('откройте «Свои данные»', 'custom') + '.</p>');
}

const customValueLimit = 1_000_000;

function customGameError(data) {
  const valid = (value, minimum) => Number.isInteger(value) && value >= minimum && value <= customValueLimit;
  for (const [label, pair, minimum] of [['Склад', data?.stock, 0], ['Снимок рейса', data?.snapshot?.cost, 1],
    ['Новая карточка каталога', data?.catalog?.cost, 1]]) {
    if (!valid(pair?.fuel, minimum) || !valid(pair?.rations, minimum)) {
      return { code: 'invalid_custom_values', title: label + ' — укажите целые количества от ' + minimum + ' до 1 000 000.' };
    }
  }
  if (!valid(data.snapshot.rewardCredits, 0) || !valid(data.catalog.rewardCredits, 0)) {
    return { code: 'invalid_custom_values', title: 'Укажите целые награды от 0 до 1 000 000.' };
  }
  if (data.snapshot.cost.fuel > data.stock.fuel || data.snapshot.cost.rations > data.stock.rations) {
    return { code: 'snapshot_exceeds_stock', title: 'Склад должен покрывать снимок подготовленного рейса.' };
  }
  return null;
}

function customFormData(form) {
  const number = name => {
    const value = form.elements.namedItem(name).valueAsNumber;
    return Number.isFinite(value) ? value : null;
  };
  const pair = prefix => ({ fuel: number(prefix + '.fuel'), rations: number(prefix + '.rations') });
  const terms = name => ({ cost: pair(name + '.cost'), rewardCredits: number(name + '.rewardCredits') });
  return { stock: pair('stock'), snapshot: terms('snapshot'), catalog: terms('catalog') };
}

function updateCustomPreview(form) {
  const data = customFormData(form);
  const error = customGameError(data);
  const available = error ? null : { fuel: data.stock.fuel - data.snapshot.cost.fuel,
    rations: data.stock.rations - data.snapshot.cost.rations };
  form.querySelector('[data-custom-preview]').textContent = error?.title ??
    'После подготовки доступно ' + simPair(available) + ' (топливо / пайки). Резерв по снимку — ' + simPair(data.snapshot.cost) + '.';
  form.querySelector('[data-custom-json]').textContent = JSON.stringify(data, null, 2);
  form.querySelectorAll('button').forEach(button => { button.disabled = Boolean(error) || gameSession.busy; });
}

function simCustom() {
  const draft = customDraft;
  const input = (name, label, value, minimum) => '<label>' + label + '<input type="number" name="' + name +
    '" value="' + esc(value ?? '') + '" min="' + minimum + '" max="' + customValueLimit + '" step="1" required></label>';
  const group = (key, title, values, hasReward = false) => {
    const prefix = hasReward ? key + '.cost' : key;
    const cost = hasReward ? values.cost : values;
    const minimum = hasReward ? 1 : 0;
    return '<fieldset><legend>' + title + '</legend>' + input(prefix + '.fuel', 'Топливо', cost.fuel, minimum) +
      input(prefix + '.rations', 'Пайки', cost.rations, minimum) +
      (hasReward ? input(key + '.rewardCredits', 'Награда, кредиты', values.rewardCredits, 0) : '') + '</fieldset>';
  };
  return simPanel('Практика E01', 'Соберите сценарий из своих данных',
    '<p>Задайте числа для M01. Склад должен покрывать уже подготовленный рейс. Условия новой карточки могут превышать склад.</p>' +
    '<form data-sim-form="custom">' + group('stock', '1. Склад', draft.stock) +
    group('snapshot', '2. Снимок подготовленного рейса', draft.snapshot, true) +
    group('catalog', '3. Текущая карточка каталога', draft.catalog, true) +
    '<p class="sim-observation" data-custom-preview aria-live="polite"></p>' +
    '<details open><summary>Тело запроса · POST /api/demo/games/custom</summary><pre><code data-custom-json></code></pre></details>' +
    '<div class="sim-actions">' + (location.protocol === 'file:' ? '' : '<button type="submit" class="button primary">Создать партию из моих данных</button>') +
    '<button type="button" class="button" data-export-custom>Скачать JSON запроса</button>' + simLink('Готовые сценарии', 'scenarios') +
    '</div></form><p class="note">Для прогона скачанного JSON на локальном сервере используйте команду ниже.</p>' +
    simCode('Invoke-RestMethod -Method Post -Uri http://127.0.0.1:5191/api/demo/games/custom -ContentType application/json -InFile ./outpost-scenario.json'));
}

function simMissionAvailable(game, mission) {
  return !game.expeditions.some(item => item.missionId === mission.id && item.status === 'completed') &&
    mission.cost.fuel <= game.inventory.available.fuel && mission.cost.rations <= game.inventory.available.rations;
}

function simCatalog(game) {
  if (!game) return simScenarios();
  const missions = gameSession.missions;
  const preferred = missions.find(item => simMissionAvailable(game, item)) ?? missions[0];
  return simPanel('Каталог миссий', 'Подготовьте один рейс',
    '<p>Сервер проверит запас и состояние партии. Недоступную миссию можно выбрать для проверки отказа.</p>' +
    simPicker('Миссия для подготовки', missions.map(item => ({
      value: item.id, title: item.id + ' · ' + item.title, checked: item === preferred,
      description: simPair(item.cost) + ' топливо / пайки · ' + item.rewardCredits + ' кредитов' +
        (simMissionAvailable(game, item) ? '' : ' · недоступна')
    })), 'prepare', 'Подготовить выбранную миссию'));
}

function simActions(game) {
  const trip = gameSession.selected;
  if (!game || !trip) return simPanel('Операции', 'Выберите рейс', '<p>Чтобы выполнить команду, подготовьте миссию.</p>',
    simLink('В каталог', 'catalog', true));
  const mission = gameSession.missions.find(item => item.id === trip.missionId);
  const options = [];
  const add = (title, description, command, value) => options.push({ title, description, action: command, value, checked: options.length === 0 });
  if (trip.status === 'prepared') {
    if (mission?.revision > trip.catalogRevision) {
      add('Заменить на редакцию ' + mission.revision, 'Подтвердить новые условия и создать связанный рейс.', 'replace', String(mission.revision));
      add('Проверить устаревшую редакцию', 'Передать предыдущий номер редакции и проверить отказ.', 'replace', String(trip.catalogRevision));
    } else if (trip.missionId === 'M01' && mission?.revision === 1) {
      add('Изменить условия M01', 'Обновить каталог и сравнить с сохранённым снимком.', 'revise', 'catalog');
    }
    add('Запустить рейс', 'Списать стоимость из снимка.', 'transition', 'launch');
    add('Отменить подготовку', 'Освободить резерв.', 'transition', 'cancel');
  } else if (trip.status === 'inFlight') {
    add('Завершить рейс', 'Учесть награду по снимку.', 'transition', 'complete');
    add('Проверить отказ отмены', 'Запросить отмену после запуска.', 'transition', 'cancel');
    add('Повторить запуск', 'Проверить запрет повторного списания.', 'retry', 'launch');
  } else if (trip.status === 'completed') {
    add('Проверить повтор завершения', 'Убедиться, что награда учтена один раз.', 'transition', 'complete');
  }
  return simPanel('Дополнительные операции', 'Выберите одну команду',
    options.length ? simPicker('Команда для текущего рейса', options, 'command', 'Отправить команду') :
      '<p>Для этой записи доступен просмотр истории.</p>', '', simLink('Журнал и ответы HTTP', 'journal') +
      (!game.activeExpedition ? simLink('Открыть каталог', 'catalog') : ''));
}

function simJournal(game) {
  const trip = gameSession.journal ?? gameSession.selected;
  const selector = game?.expeditions.length > 1 ? '<form data-sim-form="select" class="sim-journal-select">' +
    '<label>Рейс <select name="expeditionId">' + game.expeditions.map(item =>
      '<option value="' + esc(item.id) + '"' + (item.id === trip?.id ? ' selected' : '') + '>' +
      esc(item.missionId + ' · редакция ' + item.catalogRevision + ' · ' + statuses[item.status]) + '</option>').join('') +
    '</select></label><button type="submit" class="button">Открыть запись</button></form>' : '';
  const events = trip ? simEvents(trip) + (trip.replacesExpeditionId ? '<p>Заменяет рейс <code>' +
    esc(trip.replacesExpeditionId) + '</code>.</p>' : '') : '<p>События появятся после подготовки рейса.</p>';
  const logs = gameSession.logs;
  const selected = gameSession.lastCommand ?? logs[0];
  const logList = logs.length ? logs.map(log => '<details class="sim-log"' + (log === selected ? ' open' : '') + '>' +
    '<summary><strong>' + esc(log.method + ' · ' + log.status) + '</strong> <code>' + esc(log.path) + '</code></summary>' +
    (log.location ? simText('Location: ' + log.location) : '') +
    simCode((log.request ? 'Запрос\n' + JSON.stringify(log.request, null, 2) + '\n\nОтвет\n' : '') +
      JSON.stringify(log.body, null, 2)) + '</details>').join('') : '<p>Ответы появятся после запроса в этой вкладке.</p>';
  return simPanel('Проверка по данным', 'Журнал и ответы HTTP', selector + events +
    (browserDemo ? '<h3>Ответы учебной модели</h3><p>Коды и JSON здесь воспроизводятся в браузере. Реальный HTTP проверьте на своём запущенном API.</p>' : '<h3>Обмен с сервером</h3>') +
    logList, simLink('К текущему шагу', '', true));
}

function simComparison(game) {
  const free = game?.scenarioId === 'free';
  const rows = free ? [
    ['M01 + M03', '190 кредитов · 0/0', comparison.combined ?? '—'], ['M02', '150 кредитов · 2/4', comparison.single ?? '—']
  ] : [
    ['Старая M01 + M03', '190 кредитов · 0/0', comparison.original ?? '—'],
    ['Замена M01', '160 кредитов · 3/2', comparison.replacement ?? '—']
  ];
  return simPanel('Сверка стратегий', 'Результаты партий',
    '<p>Итог записывается после завершения соответствующих рейсов.</p>' + table(['Ветвь', 'Эталон', 'Фактически'], rows),
    simLink('К текущей партии', '', true), simLink('Выбрать сценарий', 'scenarios'));
}

function simBuild(step) {
  const local = location.protocol === 'file:';
  const studentApi = simNotebook.studentApi ?? {};
  const apiField = (key, title, hint, limit = 12000) => '<label class="sim-prediction"><strong>' + esc(title) +
    '</strong><span>' + esc(hint) + '</span><textarea data-api-evidence="' + key + '" rows="4" maxlength="' + limit + '">' +
    esc(studentApi[key] ?? '') + '</textarea></label>';
  const apiHint = 'Вставьте вывод проверки или запишите реальные запросы, ответы и состояние после каждой команды.';
  const steps = [
    ['Поднимите первый сервер',
      '<p>Распакуйте <a href="student-kit.zip" download>студенческий комплект</a>. Откройте терминал в папке <code>first-api</code> и проверьте, что установлен .NET SDK 10.</p>' +
      simCode('dotnet --version\ndotnet run --no-launch-profile --urls http://localhost:5201') +
      '<p>Во втором терминале выполните команду ниже. Ищите статус <code>prepared</code> и три разные записи о ресурсах. В заготовке чтение уже работает.</p>' +
      simCode('Invoke-RestMethod http://localhost:5201/api/game | ConvertTo-Json -Depth 5')],
    ['Добавьте команду запуска',
      '<p>Остановите сервер через Ctrl+C. Добавьте этот обработчик перед <code>app.Run()</code> в <code>Program.cs</code>. Параметр <code>LaunchRequest</code> принимает JSON из тела запроса.</p>' +
      simCode('app.MapPost("/api/expeditions/E01/transitions", (LaunchRequest request) =>\n{\n    // Проверки, списание и ответ\n});') +
      '<ol class="steps"><li>Если <code>request.Action</code> отличается от <code>launch</code>, верните <code>Results.BadRequest()</code>.</li>' +
      '<li>Если статус отличается от <code>prepared</code>, верните <code>Results.Conflict()</code> до записи.</li>' +
      '<li>Выберите источник стоимости между <code>agreedCost</code> и <code>currentCost</code>. В протоколе одной фразой объясните выбор. Вычтите эти значения из запаса и запишите результат в <code>stock</code>.</li>' +
      '<li>Установите <code>inFlight</code>, добавьте статус в <code>history</code> и верните <code>Results.Ok(new { status, stock })</code>.</li></ol>' +
      '<p>Если сборка не проходит, начните с первой строки ошибки в <code>Program.cs</code>. Объявления <code>record</code> должны быть после <code>app.Run()</code>.</p>'],
    ['Проверьте свой обработчик',
      '<p>Запустите сервер той же командой. В другом PowerShell из папки <code>first-api</code> выполните проверку. Она читает входные данные, отправляет первый и повторный запуск и сверяет состояние.</p>' +
      simCode('./Check-E01.ps1 -AsJson') +
      '<p>Для ручной проверки откройте <code>requests.http</code>. Выполните GET перед запуском и после каждого из двух одинаковых POST. Между командами оставьте сервер запущенным.</p>' +
      '<p>Если первый ответ 404, проверьте адрес <code>/api/expeditions/E01/transitions</code>. Если второй POST меняет запас, перенесите проверку статуса перед списанием.</p>' +
      '<h3>Мой API · протокол 7/3</h3>' + apiField('catalog73', 'Фактические запросы и ответы · 7/3', apiHint) +
      apiField('reason', 'Почему обработчик использует этот источник', 'Свяжите выбор источника с условиями рейса и результатом обоих прогонов.', 2000) +
      (simNotebook.studentApiNote ? '<details><summary>Моя предыдущая заметка</summary><p class="sim-saved">' +
        esc(simNotebook.studentApiNote) + '</p></details>' : '')],
    ['Перенесите проверку на каталог 8/4',
      '<p>Остановите сервер и запустите его с изменённым каталогом. Через GET проверьте, что <code>currentCost</code> стал 8/4, а <code>agreedCost</code> остался прежним. Запишите прогноз до запуска.</p>' +
      simCode('dotnet run --no-launch-profile --urls http://localhost:5201 --LaunchTransfer true\n# Во втором терминале\n./Check-E01.ps1 -Catalog "8/4" -AsJson') +
      simPrediction('sim-transfer-prediction', 'Что изменится в ответе после смены каталога? Запишите ожидаемый остаток и статус.', simNotebook.transferPrediction) +
      '<h3>Мой API · протокол 8/4</h3>' + apiField('catalog84', 'Фактические запросы и ответы · 8/4', apiHint) +
      '<p>Сравните свой протокол с тренажёром. Затем перенесите правило снимка в проект с SQLite.</p>']
  ];
  const current = Math.min(Math.max(step || 1, 1), steps.length);
  const [title, contents] = steps[current - 1];
  const next = current < steps.length ? simLink('Следующий шаг', 'build-' + (current + 1), true)
    : local ? simLink('К проекту с SQLite', 'project', true)
      : simButton('Проверить перенос в тренажёре', 'new', 'launch-transfer');
  const protocol = current === 4 ? simLink('К итогам проекта', 'project') +
    '<button type="button" class="text-button sim-text-link" data-export-study>Скачать протокол и листы</button>' : '';
  return simChapterRail(3) + simPanel('04 · Собственный API · шаг ' + current + ' из ' + steps.length,
    title, contents, next, current > 1 ? simLink('Предыдущий шаг', 'build-' + (current - 1)) + protocol : simLink('К проверке рейса', ''));
}
