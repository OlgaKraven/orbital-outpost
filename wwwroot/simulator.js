const scenarios = [
  { id: 'e01', title: 'Рейс E01', description: 'Начальные данные и проверка запуска · каталог 7/3' },
  { id: 'launch-transfer', title: 'Перенос E01', description: 'Те же условия рейса · каталог 8/4' },
  { id: 'briefing', title: 'После донесения', description: 'Сохранить условия или заменить рейс · запас 10/5' },
  { id: 'boundary', title: 'Ровно по норме', description: 'Замена на границе · запас 7/3' },
  { id: 'shortage', title: 'Не хватает двух ресурсов', description: 'Проверить отказ при замене · запас 6/2' },
  { id: 'rations', title: 'Не хватает пайков', description: 'Проверить отказ при замене · запас 8/2' },
  { id: 'free', title: 'Свободная партия', description: 'Самостоятельно выбрать миссии и сравнить стратегии' }
];
const simChapters = ['Разобраться в запросе', 'Данные и запуск', 'Проверить повтор', 'Написать свой API', 'Проверить каталог 8/4'];
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
  return '<details class="sim-animation" open><summary>Разобрать, как собрать запрос запуска</summary>' +
    '<p class="sim-hint">Нажимайте «Далее» и проследите, как собрать метод, путь, заголовок и JSON. В журнале путь будет содержать идентификатор созданного рейса. В своём прототипе вы используете короткий код E01.</p>' +
    '<div data-sim-animation></div></details>';
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

function simLaunchStep() {
  const { game, selected: trip } = gameSession;
  if (!trip || !simIsE01(game)) return null;
  if (trip.status === 'prepared') return 0;
  const repeated = simChecked?.id === game.id && simChecked.tripId === trip.id && simChecked.type === 'repeat';
  return trip.status === 'inFlight' && !repeated ? 1 : 2;
}

function simChapterRail(current) {
  return '<nav class="sim-progress" aria-label="Маршрут практики E01"><p>Этап ' + (current + 1) + ' из ' +
    simChapters.length + '</p><ol>' + simChapters.map((name, index) =>
      '<li' + (index === current ? ' aria-current="step"' : '') + '><span aria-hidden="true">' + (index + 1) +
      '</span><strong>' + esc(name) + '</strong></li>').join('') + '</ol></nav>';
}

function simPanel(eyebrow, title, contents, action = '', secondary = '') {
  return '<section class="sim-panel"><p class="sim-eyebrow">' + esc(eyebrow) + '</p><h2 tabindex="-1">' +
    esc(title) + '</h2>' + contents +
    (action || secondary ? '<div class="sim-actions">' + action + secondary + '</div>' : '') + '</section>';
}

function simCue(label, text) {
  return '<p class="sim-cue"><strong>' + esc(label) + '</strong> ' + text + '</p>';
}

function simDirections(items, first = 1) {
  return '<ol class="sim-directions" start="' + first + '">' + items.map(([action, where, why]) =>
    '<li><strong>' + esc(action) + '</strong><ul><li><b>Где и что увидеть</b> ' + where +
    '</li><li><b>Зачем</b> ' + why + '</li></ul></li>').join('') + '</ol>';
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
  const syncAnimation = () => {
    if (!animation.isConnected) return;
    if (animation.open) detachSimAnimation ??= mountPrimer(animation.querySelector('[data-sim-animation]'), 2, true);
    else unmountSimAnimation();
  };
  if (animation) {
    syncAnimation();
    animation.addEventListener('toggle', syncAnimation);
  }
}

function simMaterials() {
  return simPanel('Учебные материалы', 'Материалы для работы по шагам',
    '<p>Проходите брифинг, запускайте рейс, заполняйте листы и сверяйтесь с эталоном прямо на сайте.</p>' +
    '<p>Когда дойдёте до собственного API, скачайте заготовку C# из инструкции к первому запуску. Там показано, какие файлы открыть.</p>',
    simLink('К инструкции по собственному API', 'build', true),
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
    '<p>Штаб обновил каталог M01 после подготовки рейса E01. Диспетчеру нужно проверить, какую норму спишет станция и можно ли отправить команду дважды. Сначала вы проверите это в тренажёре, затем соберёте прототип API для того же рейса.</p>' +
    simCue('Сейчас', 'Разберите одну команду. Когда нажмёте «Открыть исходные данные E01», тренажёр создаст учебную партию и покажет три записи о ресурсах.') +
    '<ol class="sim-signal"><li><strong>Запрос</strong><span>GET читает состояние. POST передаёт команду.</span></li>' +
    '<li><strong>Правило</strong><span>Сервер проверяет статус и списывает ресурсы по снимку рейса.</span></li>' +
    '<li><strong>Ответ</strong><span>Код показывает результат. JSON передаёт данные в виде именованных полей.</span></li></ol>' +
    simDirections([
      ['Определите, к какому рейсу обращаетесь.', 'В схеме ниже адрес <code>/api/expeditions/E01/transitions</code> содержит код рейса для вашего будущего прототипа.', 'Адрес подсказывает API, какой рейс обработать.'],
      ['Соберите команду из метода и тела.', 'В схеме <code>POST</code> означает действие, а в JSON поле <code>action</code> получает строку <code>launch</code>.', 'Рейс определяется адресом. Поле <code>action</code> сообщает, что с ним сделать.']
    ]) +
    simAnimation() +
    (browserDemo ? '<p class="note">Здесь вы проверяете правило в учебной модели в браузере. В разделе «Собственный API» вы запустите C# и проверите реальные HTTP-запросы.</p>' : ''),
    localFile ? simLink('Разобрать данные', 'data', true) : simButton('Открыть исходные данные E01', 'new', 'e01'),
    simLink('Свои данные', 'custom'));
}

function simData(localFile) {
  return simChapterRail(1) + simPanel('02 · Досье E01', 'Сопоставьте склад, рейс и каталог',
    '<p>Штаб обновил M01, когда рейс уже был подготовлен. Нужно определить, из какой записи обработчик возьмёт стоимость запуска.</p>' +
    simCue('Что сравнить', '10 / 5 — сколько на складе, 6 / 2 — какие условия уже закреплены за рейсом, 7 / 3 — какие условия каталог предлагает сейчас.') +
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
  const step = simLaunchStep();
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
      simCue('Сейчас', 'Найдите в таблице две нормы, выберите источник списания и нажмите «Запустить рейс».') +
      '<p>Тренажёр создал отдельную партию. В ней есть склад, карточка каталога M01 и подготовленный рейс со снимком условий. В журнале у запроса создания есть <code>id</code> партии и <code>activeExpedition.id</code> рейса.</p>' +
      simTripFacts(game, trip, mission) + (custom ? '<p class="note">Значения получены из вашего запроса. Награда за рейс по снимку — ' +
      trip.rewardCreditsSnapshot + ', по текущему каталогу — ' + mission.rewardCredits + '.</p>' : '<p class="note">Склад и согласованные условия — ' + sourceLinks('С1') +
      '. Текущая карточка — ' + (transfer ? '<a href="scenarios.json">scenarios.json</a>, набор <code>launch-transfer</code>, поле <code>catalogCost</code>' : sourceLinks('С2')) +
      '. <a href="#simulator-build">Поля собственного API E01</a></p>') +
      simDirections([
        ['Сравните строки «Снимок рейса» и «Каталог M01».', 'Из строки «Склад» вычтите выбранную норму отдельно для топлива и пайков.', 'Так у вас будет прогноз остатка, который можно проверить после запуска.'],
        ['Отметьте прогноз и отправьте запуск.', 'Кнопка отправит <code>POST</code> на адрес этого рейса с телом <code>{ "action": "launch" }</code>. На следующем экране появятся списание и остаток.', 'Сервер применяет правило к данным рейса. Ваш выбор сохраняется для сверки.']
      ]) + prompt);
  } else if (step === 1) {
    const result = recorded?.firstLaunch?.spent;
    const explanation = result ? '<p class="sim-observation"><strong>Списание (топливо / пайки) — ' + simPair(result) +
      '.</strong> Это условия из снимка. ' + (recorded.source === 'catalog'
        ? 'Вы предположили, что сервер возьмёт каталог. Рейс был подготовлен раньше, поэтому сработал снимок.' :
        'Прогноз совпал с ответом сервера.') + '</p>' : '';
    panel = simPanel(label, 'Повторите ту же команду',
      simCue('Сейчас', 'Запомните остаток после первого запуска. Затем нажмите «Повторить запуск».') +
      '<p>Первый запуск принят. Статус рейса — <strong>«В полёте»</strong>. Что произойдёт, если отправить тот же запрос ещё раз?</p>' +
      explanation + simInventory(game) +
      simDirections([
        ['Найдите остаток после первого запуска.', 'В таблице «Запасы» смотрите столбец «Склад». В журнале у первого POST будет код <code>200</code>.', 'Эти значения станут точкой сравнения для повтора.'],
        ['Отправьте ту же команду для того же рейса.', 'Тренажёр повторит адрес и JSON. На следующем экране проверьте, изменились ли остаток и история.', 'Сбой связи может заставить диспетчера отправить запрос дважды. Проверка покажет, может ли повтор списать ресурсы ещё раз.']
      ]), simButton('Повторить запуск', 'retry', 'launch'), journal);
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
    panel = simPanel(label, 'Сверьте прогноз с журналом',
      simCue('Проверьте доказательство', 'Сравните первый запуск, повтор и остаток. Для своего API вам понадобятся эти же три проверки.') + checkText + observed +
      (checked ? simDirections([
        ['Откройте журнал и сравните два POST.', 'Оба запроса запуска раскрыты. Найдите одинаковые адрес и JSON, затем сравните коды <code>200</code> и <code>409</code>.', 'Разные ответы вызваны изменением статуса после первого запуска.'],
        ['Подтвердите отсутствие второго списания.', 'Сравните остаток с предыдущим экраном. В истории найдите единственный переход в «В полёте».', 'При проверке собственного API этот результат поможет обнаружить повторную запись.']
      ]) : '') +
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
  const group = (key, title, hint, values, hasReward = false) => {
    const prefix = hasReward ? key + '.cost' : key;
    const cost = hasReward ? values.cost : values;
    const minimum = hasReward ? 1 : 0;
    return '<fieldset><legend>' + title + '</legend><p class="sim-form-hint">' + hint + '</p>' +
      input(prefix + '.fuel', 'Топливо', cost.fuel, minimum) +
      input(prefix + '.rations', 'Пайки', cost.rations, minimum) +
      (hasReward ? input(key + '.rewardCredits', 'Награда, кредиты', values.rewardCredits, 0) : '') + '</fieldset>';
  };
  return simPanel('Практика E01', 'Соберите сценарий из своих данных',
    simCue('Сейчас', 'Задайте свои числа в трёх блоках. Чтобы проверить правило снимка, укажите в нём и в каталоге разные нормы.') +
    '<form data-sim-form="custom">' +
    group('stock', '1. Склад', 'Введите фактический запас. В JSON это <code>stock</code>. Склад должен покрывать норму подготовленного рейса.', draft.stock) +
    group('snapshot', '2. Снимок подготовленного рейса', 'Укажите согласованные расход и награду. Из <code>snapshot.cost</code> система создаст резерв, а <code>snapshot.rewardCredits</code> сохранит условия награды рейса.', draft.snapshot, true) +
    group('catalog', '3. Текущая карточка каталога', 'Введите новые условия M01. В JSON это <code>catalog</code>. Они будут видны рядом со снимком и могут превышать запас на складе.', draft.catalog, true) +
    '<h3>4. Сверьте резерв, доступный остаток и JSON</h3>' +
    '<p>Доступный остаток равен складу за вычетом резерва. Измените одно число и найдите, какое поле запроса и какой итог изменились.</p>' +
    '<p class="sim-observation" data-custom-preview aria-live="polite"></p>' +
    '<details open><summary>Тело запроса · POST /api/demo/games/custom</summary><pre><code data-custom-json></code></pre></details>' +
    '<h3>5. Создайте учебную партию</h3><p>Откроется экран прогноза с вашими числами. В журнале ответ на создание партии покажет её <code>id</code> и <code>activeExpedition.id</code>. Эти значения указывают, с какой партией и рейсом работать дальше.</p>' +
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
  const tripPath = '/api/expeditions/' + trip?.id + '/transitions';
  const launches = logs.filter(log => log.path === tripPath && log.request?.action === 'launch').slice(0, 2);
  const logList = logs.length ? logs.map(log => '<details class="sim-log"' + (log === selected || launches.includes(log) ? ' open' : '') + '>' +
    '<summary><strong>' + esc(log.method + ' · ' + log.status) + '</strong> <code>' + esc(log.path) + '</code></summary>' +
    (log.location ? simText('Location: ' + log.location) : '') +
    simCode((log.request ? 'Запрос\n' + JSON.stringify(log.request, null, 2) + '\n\nОтвет\n' : '') +
      JSON.stringify(log.body, null, 2)) + '</details>').join('') : '<p>Ответы появятся после запроса в этой вкладке.</p>';
  return simPanel('Проверка по данным', 'Журнал и ответы HTTP',
    simCue('Куда смотреть', 'В истории рейса отмечены изменения статуса. Ниже показаны запросы и ответы, начиная с самого свежего.') +
    selector + events +
    (browserDemo ? '<h3>Ответы учебной модели</h3><p>Коды и JSON здесь воспроизводятся в браузере. Реальный HTTP проверьте на своём запущенном API.</p>' : '<h3>Обмен с сервером</h3>') +
    (launches.length ? '<p>Последние команды запуска этого рейса раскрыты. В каждой записи найдите метод, путь, отправленный JSON и код ответа. Записи GET можно раскрыть, чтобы проверить состояние.</p>' : '') +
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
      simCue('Цель шага', 'Запустить заготовку и получить исходное состояние рейса. На следующем шаге вы добавите к ней свою команду запуска.') +
      '<h3>1. Подготовьте папку для работы</h3><p>До этого шага всё проходится в браузере. Архив нужен для части, где вы пишете C# на своём компьютере.</p>' +
      '<p><a class="button" href="student-kit.zip" download>Скачать заготовку для C#</a></p>' +
      '<ol class="sim-directions"><li>Распакуйте ZIP и откройте папку <code>first-api</code> в редакторе. В ней лежат файлы этой практики.' +
      '<ul><li><code>FirstApi.csproj</code> — файл проекта, по которому .NET запускает сервер.</li>' +
      '<li><code>Program.cs</code> — исходные данные и готовое чтение <code>GET /api/game</code>. Здесь вы добавите POST.</li>' +
      '<li><code>requests.http</code> — примеры запросов для ручной проверки.</li>' +
      '<li><code>Check-E01.ps1</code> — автоматическая проверка первого запуска и повтора.</li></ul></li>' +
      '<li>Если вы переходите к лабораторной с SQLite, папка <code>starter</code> содержит отдельную заготовку для неё. Досье и листы есть на сайте и в архиве для работы офлайн.</li></ol>' +
      '<h3>2. Запустите сервер в первом PowerShell</h3><p>Откройте окно PowerShell в <code>first-api</code>. Команда <code>dotnet --version</code> должна показать версию <code>10.x</code>. ' +
      'После запуска дождитесь строки <code>Now listening on: http://localhost:5201</code> и оставьте это окно открытым.</p>' +
      simCode('dotnet --version\ndotnet run --no-launch-profile --urls http://localhost:5201') +
      '<h3>3. Прочитайте состояние во втором PowerShell</h3><p>Откройте второе окно и выполните команду ниже. Она отправляет GET работающему серверу и показывает ответ в виде JSON.</p>' +
      simCode('Invoke-RestMethod http://localhost:5201/api/game | ConvertTo-Json -Depth 5') +
      simCue('Можно продолжать', 'В ответе видны <code>prepared</code>, склад <code>stock</code> 10/5, согласованная норма <code>agreedCost</code> 6/2 и текущая <code>currentCost</code> 7/3.')],
    ['Добавьте команду запуска',
      simCue('Цель шага', 'Свяжите маршрут POST со своим кодом. Внутри обработчика сначала проверяйте команду и статус, затем меняйте данные.') +
      simDirections([
        ['Остановите сервер через Ctrl+C.', 'Нажмите клавиши в первом PowerShell. Вернётся приглашение ввести команду.', 'Следующий запуск загрузит изменённый код.'],
        ['Откройте first-api/Program.cs и найдите комментарий Add POST.', 'Вставьте заготовку ниже вместо комментария перед <code>app.Run()</code>. Тип <code>LaunchRequest</code> уже объявлен в конце файла.', '<code>MapPost</code> связывает метод и адрес с обработчиком, а ASP.NET Core заполнит <code>request.Action</code> из JSON.']
      ]) +
      simCode('app.MapPost("/api/expeditions/E01/transitions", (LaunchRequest request) =>\n{\n    // Проверки, списание и ответ\n});') +
      simDirections([
        ['Реализуйте проверки в начале обработчика.', 'Для команды, отличной от <code>launch</code>, верните <code>Results.BadRequest()</code>. Для статуса, отличного от <code>prepared</code>, верните <code>Results.Conflict()</code>.', 'Ошибочная или повторная команда должна завершиться до изменения склада и истории.'],
        ['Спишите ресурсы по выбранной норме.', 'Выберите <code>agreedCost</code> или <code>currentCost</code> на основе прогона в тренажёре. Вычтите <code>Fuel</code> и <code>Rations</code> по отдельности и присвойте <code>stock</code> новый <code>Resources</code>.', 'GET после запуска должен показать фактический остаток. В протоколе объясните выбор записи.'],
        ['Обновите статус, историю и ответ.', 'Установите <code>inFlight</code>, вызовите <code>history.Add(status)</code> и верните <code>Results.Ok(new { status, stock })</code>. Сохраните файл.', 'История подтвердит, сколько успешных запусков записал сервер.']
      ], 3) +
      simCue('Если сервер не собирается', 'Начните с первой ошибки в терминале и проверьте указанную строку в <code>Program.cs</code>. Объявления <code>record</code> остаются после <code>app.Run()</code>.')],
    ['Проверьте свой обработчик',
      simCue('Цель шага', 'Подтвердите на своём сервере, что первая команда списывает ресурсы один раз, а повтор оставляет состояние прежним.') +
      '<h3>1. Запустите чистый прогон</h3><p>В первом PowerShell из <code>first-api</code> снова выполните <code>dotnet run --no-launch-profile --urls http://localhost:5201</code>. ' +
      'Данные загружаются заново. Если вы уже запускали рейс вручную, перезапустите сервер перед проверкой.</p>' +
      '<h3>2. Выполните проверку из второго PowerShell</h3><p>Откройте <code>first-api</code> во втором окне и выполните команду. Она читает исходное состояние, отправляет два одинаковых POST и повторно читает состояние после каждого.</p>' +
      simCode('./Check-E01.ps1 -AsJson') +
      '<p>Для ручной проверки вместо скрипта откройте <code>requests.http</code> в редакторе с поддержкой HTTP-запросов. Выполните запросы сверху вниз. Между запросами оставьте сервер включённым.</p>' +
      simCue('Что искать в результате', 'Первый POST вернул <code>200</code>, второй <code>409</code>. Склад после каждого POST — 4/3, в истории один переход в <code>inFlight</code>.') +
      '<p>При <code>404</code> проверьте адрес <code>/api/expeditions/E01/transitions</code>. Если второй POST меняет запас, перенесите проверку статуса перед списанием.</p>' +
      '<h3>3. Запишите доказательство · каталог 7/3</h3>' + apiField('catalog73', 'Фактические запросы и ответы · 7/3', apiHint) +
      apiField('reason', 'Почему обработчик использует этот источник', 'Свяжите выбор источника с условиями рейса и результатом обоих прогонов.', 2000) +
      (simNotebook.studentApiNote ? '<details><summary>Моя предыдущая заметка</summary><p class="sim-saved">' +
        esc(simNotebook.studentApiNote) + '</p></details>' : '')],
    ['Перенесите проверку на каталог 8/4',
      simCue('Цель шага', 'Измените только текущую карточку и проверьте, отразится ли это на уже подготовленном рейсе.') +
      '<h3>1. Перезапустите сервер с новой карточкой</h3><p>В первом PowerShell нажмите Ctrl+C и запустите сервер с параметром <code>LaunchTransfer</code>. При старте <code>Program.cs</code> читает этот параметр и выставляет <code>currentCost</code> 8/4.</p>' +
      simCode('dotnet run --no-launch-profile --urls http://localhost:5201 --LaunchTransfer true') +
      '<h3>2. Проверьте входные данные и запишите прогноз</h3><p>Во втором PowerShell отправьте GET. Проверьте, что <code>currentCost</code> стал 8/4, а <code>agreedCost</code> остался 6/2.</p>' +
      simCode('Invoke-RestMethod http://localhost:5201/api/game | ConvertTo-Json -Depth 5') +
      simPrediction('sim-transfer-prediction', 'Что изменится в ответе после смены каталога? Запишите ожидаемый остаток и статус.', simNotebook.transferPrediction) +
      '<h3>3. Выполните тот же прогон и запишите результат</h3><p>Во втором PowerShell из <code>first-api</code> запустите проверку с ожидаемой редакцией каталога.</p>' +
      simCode('./Check-E01.ps1 -Catalog "8/4" -AsJson') +
      apiField('catalog84', 'Фактические запросы и ответы · 8/4', apiHint) +
      simCue('Финальная сверка', 'Сопоставьте коды обоих POST, физический остаток и число переходов в протоколах 7/3 и 8/4. Кнопка ниже откроет вариант 8/4 в тренажёре.')]
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
