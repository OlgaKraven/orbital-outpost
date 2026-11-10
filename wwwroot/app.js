const main = document.querySelector('#main');
const nodes = document.querySelector('#map-nodes');
const stationNav = document.querySelector('#station-nav');
const statuses = { prepared: 'Подготовлена', inFlight: 'В полёте', completed: 'Завершена', cancelled: 'Отменена' };
const positions = [[8.4,75], [19.4,60], [31.1,68.25], [42,50.75], [53.1,64], [63.75,47.5], [76.7,55.25], [89.4,31]];
const progress = readLocal('outpost-case-answers', {});
const reviews = readLocal('outpost-worksheet-reviews', {});
const worksheets = readLocal('outpost-worksheets', {});
const drafts = readLocal('outpost-drafts', {});
const comparison = readLocal('outpost-comparison', {});
const browserDemo = Boolean(window.outpostBrowserApi);
const partyStorage = browserDemo ? 'sessionStorage' : 'localStorage';
const gameSession = { id: readLocal('outpost-party', null, partyStorage), game: null, missions: [], selected: null,
  journal: null, logs: [], lastCommand: null, message: '', failed: false, busy: false };
const savedJournal = readLocal('outpost-party-journal', null, partyStorage);
if (gameSession.id && savedJournal?.partyId === gameSession.id) {
  gameSession.logs = savedJournal.entries;
  gameSession.lastCommand = gameSession.logs.find(entry => entry.method === 'POST') ?? null;
}
const simNotebook = readLocal('outpost-e01-notebook', {});
let currentAttempt = readLocal('outpost-e01-attempt', null, partyStorage);
let simTrack = readLocal('outpost-sim-track', null, partyStorage);
let simChecked = readLocal('outpost-sim-checked', null, partyStorage);
let simGoal = readLocal('outpost-sim-goal', null);
let selectedStation = 0;
let view = 'quest';
let leavePrimer;
let lastMainRoute = readLocal('outpost-main-route', '#simulator-learn', 'sessionStorage');

const simulatorRoute = /^#simulator(?:-(?:learn|data|scenarios|journal|compare|catalog|actions|materials|dossier(?:-(?:b[1-5]|c[1-6]))?|reference|project|api|build(?:-[1-4])?))?$/;
const mainRoute = /^#(?:map|(?:station|reference|worksheet)-[1-8]|simulator(?:-(?:learn|data|project|build(?:-[1-4])?))?)$/;
const stationRoute = /^#(station|reference|worksheet)-([1-8])$/;
if (!mainRoute.test(lastMainRoute)) lastMainRoute = '#simulator-learn';

function readLocal(key, fallback, storage = 'localStorage') {
  try { return JSON.parse(window[storage].getItem(key)) ?? fallback; }
  catch { return fallback; }
}

function saveLocal(key, value, storage = 'localStorage') {
  try { window[storage].setItem(key, JSON.stringify(value)); }
  catch { /* The current page still works without browser storage. */ }
}

function sheetsFilled(index) {
  return LearningCase.stages[index].sheets.every(sheet => completeRows(sheet, worksheets[index] ?? {}) >= sheet.min);
}

function completed(index) {
  return Boolean(reviews[index]) && sheetsFilled(index) &&
    LearningCase.stages[index].quiz.every((_, question) => progress[index + '-' + question] === true);
}

function paintNavigation() {
  const count = Course.stages.filter((_, index) => completed(index)).length;
  const next = Course.stages.findIndex((_, index) => !completed(index));
  const e01Done = completedE01('catalog73') || completedE01('catalog84');
  document.querySelector('#map-status').textContent = count + ' из 8 станций завершено';
  const link = document.querySelector('#continue-link');
  link.href = next < 0 ? (browserDemo ? '#station-7' : '#simulator-scenarios') : count ? '#station-' + (next + 1) : '#simulator-project';
  link.textContent = next < 0 ? 'К проверкам проекта' : count ? 'Продолжить проект' :
    e01Done ? 'Связать E01 с проектом' : 'С чего начать';
  const navigation = Course.stages.map((stage, index) => ({
    label: stage.station, number: index + 1, done: completed(index), active: ['quest', 'reference'].includes(view) && selectedStation === index
  }));
  nodes.innerHTML = navigation.map(({ label, number, done, active }, index) =>
    '<a class="map-node ' + (done ? 'done' : '') + '" style="--x:' + positions[index][0] + '%;--y:' + positions[index][1] +
    '%" href="#station-' + number + '" title="' + label + '" aria-label="Станция ' + number + '. ' + label + (done ? '. Пройдена' : '') +
    '"' + (active ? ' aria-current="step"' : '') + '>' + number + '</a>').join('');
  stationNav.innerHTML = navigation.map(({ label, number, done, active }) =>
    '<a class="' + (done ? 'done' : '') + '" href="#station-' + number + '"' + (active ? ' aria-current="step"' : '') +
    '><span class="number">' + number + '</span><span>' + label + (done ? '<span class="done-mark" aria-label=" пройдена"> ✓</span>' : '') + '</span></a>').join('');
  document.querySelectorAll('[data-area]').forEach(link => {
    const currentArea = view === 'sim' && ['materials','reference','dossier','api'].includes(simulatorScreen()) ? 'materials' :
      view === 'reference' ? 'quest' : view;
    const current = link.dataset.area === currentArea;
    if (current) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function route(initial = false) {
  let hash = location.hash;
  if (!simulatorRoute.test(hash) && !stationRoute.test(hash) && hash !== '#map') {
    hash = '#simulator-learn';
    history.replaceState(null, '', hash);
  }
  if (mainRoute.test(hash)) {
    lastMainRoute = hash;
    saveLocal('outpost-main-route', hash, 'sessionStorage');
  }
  leavePrimer?.();
  leavePrimer = undefined;
  unmountSimAnimation();
  const match = hash.match(stationRoute);
  const simulator = simulatorRoute.test(hash);
  view = simulator ? 'sim' : match?.[1] === 'reference' ? 'reference' : 'quest';
  document.body.classList.toggle('simulator-mode', simulator);
  document.body.classList.toggle('project-map-mode', hash === '#map');
  document.body.classList.toggle('station-mode', Boolean(match));
  if (match) selectedStation = Number(match[2]) - 1;
  if (hash === '#map') selectedStation = 0;
  paintNavigation();
  if (view === 'sim') {
    renderSimulator();
    if (simUsesGame() && gameSession.id && !gameSession.game && !gameSession.busy && location.protocol !== 'file:') {
      runGame(async () => refreshGame(false), 'Партия загружена.');
    }
  } else if (view === 'reference') {
    renderReference();
  } else if (hash === '#map') {
    main.innerHTML = '<p class="map-note">Выберите номер станции на карте. В каждой работе путь один: изучить условие, записать решение в рабочий лист и проверить себя.</p>';
  } else {
    renderQuest();
  }
  const source = hash.startsWith('#simulator-dossier-') ? document.getElementById(hash.slice(1)) : null;
  if (source) source.focus();
  else if (match?.[1] === 'worksheet') focusWorksheet();
  else if (!initial) {
    if (hash === '#map') window.scrollTo(0, 0);
    else {
      window.scrollTo(0, 0);
      main.focus({ preventScroll: true });
    }
  }
}

function challengeMarkup(task, index) {
  const correct = progress[selectedStation + '-' + index] === true;
  let controls;
  if (task.choices) {
    controls = task.choices.map((choice, option) =>
      '<button type="button" class="choice" data-choice="' + option + '"' +
      (correct && task.answer === option ? ' data-correct="true"' : '') + '>' + esc(choice) + '</button>').join('');
  } else {
    controls = '<form class="numeric"><label>Число <input type="number" required step="1" ' +
      (correct ? 'value="' + task.answer + '"' : '') + '></label><button class="button" type="submit">Проверить</button></form>';
  }
  return '<fieldset class="challenge" data-question="' + index + '"><legend>' + (index + 1) + '. ' + esc(task.question) +
    '</legend>' + controls + '<p class="feedback" role="status">' + (correct ? 'Верно. ' + esc(task.reason) : '') + '</p></fieldset>';
}

function renderQuest() {
  leavePrimer?.();
  leavePrimer = undefined;
  const stage = Course.stages[selectedStation];
  const caseStage = LearningCase.stages[selectedStation];
  const saved = worksheets[selectedStation] ?? {};
  const number = selectedStation + 1;
  const topic = { 4: 4, 5: 6, 6: 5, 7: 7 }[number];
  const context = number === 1
    ? '<p class="note">В E01 редактор менял каталог, а диспетчер запускал рейс. Теперь определите, кто принимает решения в новом проекте. <a href="#simulator-project">Как это связано с E01</a></p>'
    : '<p class="note">Опора предыдущей станции · <a href="#station-' + (number - 1) +
      '">' + esc(Course.stages[selectedStation - 1].name) + '</a></p>';
  const animation = !topic ? '' :
    '<details class="station-explanation"><summary>Показать схему по шагам</summary><div data-station-animation></div></details>';
  const draft = number > 1 || drafts[selectedStation]?.trim() ?
    '<details class="station-explanation station-draft"><summary>' +
    (number === 1 ? 'Моя заметка' : 'Добавить пояснение к своему решению') + '</summary>' +
    '<label class="draft-label" for="draft">Мой черновик</label><textarea id="draft" maxlength="12000" rows="3">' +
    esc(drafts[selectedStation] ?? '') + '</textarea></details>' : '';
  main.innerHTML = '<article class="panel station-workspace"><p class="kicker">Станция ' + number + ' из 8 · ' + esc(stage.station) +
    '</p><h1>' + esc(stage.name) + '</h1><p>' + esc(stage.goal) + '</p>' +
    '<section class="station-section"><h2>1. Изучите условие</h2>' + context +
    '<p>' + esc(caseStage.brief) + '</p><p class="note">Источники · ' +
    sourceLinks(caseStage.source) + ' · <a href="#simulator-dossier">Открыть досье</a></p>' +
    '<p><strong>Приём.</strong> ' + esc(caseStage.lesson) + '</p>' +
    '<p class="example"><strong>Разобранный пример.</strong> ' + esc(caseStage.example) + '</p>' +
    animation + '</section>' +
    '<section class="station-section" id="worksheets"><h2>2. Запишите решение</h2><p>' + esc(caseStage.task) + '</p>' +
    '<p><strong>Зачем.</strong> ' + esc(caseStage.why) + '</p>' +
    (number === 7 ? lab07HttpGuide() : '') +
    '<p class="note">Рабочие листы сохраняются в этом браузере. Сравните обоснование с эталоном после проверки.</p>' +
    studyWorksheet(selectedStation, saved) + draft + '</section>' +
    '<section class="station-section" aria-labelledby="challenge-title"><h2 id="challenge-title">3. Проверьте себя</h2>' +
    '<div id="station-progress"></div>' + caseStage.quiz.map(challengeMarkup).join('') +
    '<p class="note">' + esc(caseStage.next) + '</p>' +
    '<div class="actions"><a class="button" href="#reference-' + number + '">Свериться с эталоном</a>' +
    '<a class="button primary" id="next-station" href="' + (number === 8 ? (browserDemo ? '#station-7' : '#simulator-scenarios') : '#station-' + (number + 1)) +
    '">' + (number === 8 ? 'К проверкам проекта' : 'Следующая станция') + '</a>' +
    '<button class="text-button" data-export-study>Скачать мои решения</button></div></section></article>';
  const animationHost = main.querySelector('[data-station-animation]');
  const explanation = animationHost?.parentElement;
  explanation?.addEventListener('toggle', () => {
    if (!explanation.isConnected) return;
    leavePrimer?.();
    leavePrimer = explanation.open ? mountPrimer(animationHost, topic - 1, true) : undefined;
  });
  updateStationProgress();
}

function focusWorksheet() {
  const target = main.querySelector('#worksheets');
  target.tabIndex = -1;
  target.focus();
}

function updateStationProgress() {
  const tasks = LearningCase.stages[selectedStation].quiz;
  const count = tasks.filter((_, index) => progress[selectedStation + '-' + index] === true).length;
  const sheets = LearningCase.stages[selectedStation].sheets;
  const saved = worksheets[selectedStation] ?? {};
  const rows = sheets.map(sheet => sheet.name + ' · ' + completeRows(sheet, saved) + '/' + sheet.min).join(' · ');
  document.querySelector('#station-progress').innerHTML = '<p class="note">' + count + ' из ' + tasks.length +
    ' испытаний решено. <button class="text-button" data-scroll-sheets>К рабочим листам</button></p><p class="note">' + esc(rows) +
    '</p><p><strong>' + (sheetsFilled(selectedStation) ? 'Листы заполнены' : 'Листы заполняются') +
    '</strong> · ' + (reviews[selectedStation] ? 'Решение сверено вами' : 'Ожидает вашей сверки') +
    '</p><div class="progress-track" aria-hidden="true"><span style="--progress:' + count / tasks.length * 100 + '%"></span></div>';
  const next = document.querySelector('#next-station');
  next.hidden = !completed(selectedStation);
}

function grade(question, submitted, field, button = null) {
  const task = LearningCase.stages[selectedStation].quiz[question];
  const feedback = field.querySelector('.feedback');
  if (submitted !== task.answer) {
    if (button) button.dataset.selected = 'true';
    feedback.classList.add('error');
    feedback.textContent = 'Пока не совпадает. Сверьте условия ситуации и попробуйте ещё раз.';
    return;
  }
  if (button) button.dataset.correct = 'true';
  feedback.classList.remove('error');
  feedback.textContent = 'Верно. ' + task.reason;
  progress[selectedStation + '-' + question] = true;
  saveLocal('outpost-case-answers', progress);
  updateStationProgress();
  paintNavigation();
}

function renderReference() {
  const stage = Course.stages[selectedStation];
  const number = selectedStation + 1;
  const draft = drafts[selectedStation]?.trim();
  const worksheetsReview = studyReview(selectedStation, worksheets[selectedStation] ?? {});
  main.innerHTML = '<article class="panel reference"><p class="kicker">Эталон станции ' + number + '</p><h2>' + esc(stage.name) +
    '</h2><p>Сравните свои данные, причинное обоснование и способ проверки с эталоном.</p><div class="actions"><a class="button" href="#station-' + number +
    '">Вернуться к испытанию</a></div>' +
    (draft ? '<div class="brief"><strong>Мой черновик решения</strong><p class="draft-preview">' +
      esc(draft) + '</p></div>' : '') +
    (worksheetsReview ? '<section aria-label="Ваши записи"><h3>Ваши записи</h3>' + worksheetsReview + '</section>' : '') +
    caseStageReference(selectedStation, true) +
    '<section class="station-section"><h3>Отметка о сверке</h3><ul><li>Сопоставьте значения с указанным источником и выбранным сценарием.</li>' +
    '<li>Проверьте, что объяснение связывает данные с вашим решением.</li><li>Сверьте проверяемый результат с примером и исправьте расхождения.</li></ul>' +
    '<label><input type="checkbox" data-review-station' + (reviews[selectedStation] ? ' checked' : '') +
    (sheetsFilled(selectedStation) ? '' : ' disabled') + '> Я сверил(а) решение с эталоном</label>' +
    (sheetsFilled(selectedStation) ? '' : '<p class="note">Сначала заполните обязательные строки рабочих листов.</p>') + '</section>' +
    '<h3>Ответы на испытания</h3>' + stepList(LearningCase.stages[selectedStation].quiz.map(task =>
      (task.choices?.[task.answer] ?? task.answer) + '. ' + task.reason)) + '</article>';
}

async function request(method, path, data, record = true) {
  const headers = { Accept: 'application/json' };
  if (gameSession.id) headers['X-Game-Id'] = gameSession.id;
  if (data !== undefined) headers['Content-Type'] = 'application/json';
  const response = await (browserDemo ? window.outpostBrowserApi(method, path, data, gameSession.id) :
    fetch(path, { method, headers, body: data === undefined ? undefined : JSON.stringify(data) }));
  const body = await response.json();
  const entry = { method, path, status: response.status, body, request: data, location: response.headers.get('Location') };
  if (record) {
    const newParty = method === 'POST' && response.ok && path.startsWith('/api/demo/games?');
    gameSession.logs = newParty ? [entry] : [entry, ...gameSession.logs].slice(0, 32);
    if (method === 'POST') gameSession.lastCommand = entry;
    saveLocal('outpost-party-journal', { partyId: newParty ? body.id : gameSession.id, entries: gameSession.logs }, partyStorage);
  }
  if (!response.ok) throw Object.assign(new Error(body.title ?? 'Запрос отклонён.'), { code: body.code, status: response.status });
  return body;
}

async function refreshGame(record = true) {
  gameSession.game = await request('GET', '/api/game', undefined, record);
  gameSession.missions = await request('GET', '/api/missions', undefined, record);
  const id = gameSession.game.activeExpedition?.id ?? gameSession.game.expeditions[0]?.id;
  gameSession.selected = id ? await request('GET', '/api/expeditions/' + id, undefined, record) : null;
  gameSession.journal = null;
}

async function runGame(action, message) {
  if (gameSession.busy) return;
  const focus = document.activeElement?.dataset.focus;
  const originRoute = location.hash;
  gameSession.busy = true;
  gameSession.message = '';
  gameSession.failed = false;
  if (view === 'sim') renderSimulator();
  try {
    gameSession.message = await action() ?? message;
  } catch (error) {
    gameSession.failed = true;
    if (error.code === 'game_not_found') {
      gameSession.id = null;
      gameSession.game = null;
      gameSession.selected = null;
      gameSession.logs = [];
      gameSession.lastCommand = null;
      saveLocal('outpost-party', null, partyStorage);
      saveLocal('outpost-party-journal', null, partyStorage);
    }
    gameSession.message = error.status
      ? error.status + ' · ' + error.message
      : browserDemo ? 'Учебная модель не загрузилась. Обновите страницу и попробуйте снова.'
        : 'Симулятор не получил ответ сервера. Проверьте запуск приложения и повторите действие.';
  } finally {
    gameSession.busy = false;
    if (view === 'sim' && (originRoute === location.hash || simUsesGame())) {
      renderSimulator();
      if (focus) (main.querySelector('[data-focus="' + CSS.escape(focus) + '"]:not(:disabled)') ??
        main.querySelector('#sim-message'))?.focus();
    }
  }
}


function recordComparison() {
  const game = gameSession.game;
  const completedTrips = game.expeditions.filter(expedition => expedition.status === 'completed');
  const missions = completedTrips.map(expedition => expedition.missionId).sort().join(',');
  let scenario = ({ 'M01,M03': 'combined', 'M02': 'single' })[missions];
  if (game.scenarioId === 'briefing') {
    const first = completedTrips.find(expedition => expedition.missionId === 'M01');
    scenario = missions === 'M01,M03' && first?.catalogRevision === 1 ? 'original' :
      missions === 'M01' && first?.replacesExpeditionId ? 'replacement' : undefined;
  }
  if (scenario && !game.activeExpedition) {
    comparison[scenario] = game.credits + ' кр. · остаток ' + game.inventory.onHand.fuel + '/' + game.inventory.onHand.rations;
    saveLocal('outpost-comparison', comparison);
  }
}

async function gameAction(action, value) {
  if (action === 'new') return runGame(async () => {
    const path = '/api/demo/games?scenario=' + encodeURIComponent(value === 'e01' ? 'briefing' : value);
    const newGame = await request('POST', path);
    gameSession.id = newGame.id;
    gameSession.game = newGame;
    gameSession.selected = null;
    gameSession.journal = null;
    simTrack = { id: newGame.id, exercise: value === 'e01' || value === 'launch-transfer' ? 'e01' : 'party' };
    saveLocal('outpost-party', newGame.id, partyStorage);
    saveLocal('outpost-sim-track', simTrack, partyStorage);
    await refreshGame();
    location.hash = '#simulator';
  }, 'Начальные данные загружены.');
  if (action === 'select') return runGame(async () => {
    gameSession.journal = await request('GET', '/api/expeditions/' + value);
  }, 'Показана история выбранного рейса.');
  const path = action === 'prepare' ? '/api/expeditions' : action === 'revise'
    ? '/api/demo/catalog-revision' : '/api/expeditions/' + gameSession.selected.id +
      (action === 'replace' ? '/replacements' : '/transitions');
  const data = action === 'prepare' ? { missionId: value } : ['transition', 'retry'].includes(action) ? { action: value } :
    action === 'replace' ? { expectedCatalogRevision: Number(value) } : undefined;
  return runGame(async () => {
    const before = simObservation();
    const beforeStock = gameSession.game.inventory.onHand;
    try {
      const result = await request('POST', path, data);
      await refreshGame();
      if (action === 'revise') return 'Каталог M01 · редакция ' + result.revision + ' · ' + simPair(result.cost) +
        ' · ' + result.rewardCredits + ' кредитов. Сравните со снимком рейса.';
      if (action === 'retry') return 'Повтор неожиданно выполнен. Сравните ответы и состояние в журнале.';
      if (action === 'transition' && value === 'launch' && simIsE01(gameSession.game)) {
        rememberSimEvidence('firstLaunch', beforeStock);
      }
      recordComparison();
      if (['catalog', 'actions'].includes(simulatorScreen()) && view === 'sim') location.hash = '#simulator';
    } catch (error) {
      if (['replace', 'retry'].includes(action) && error.status === 409) {
        await refreshGame();
        const unchanged = before === simObservation();
        if (unchanged && (action === 'retry' && error.code === 'invalid_transition' ||
          action === 'replace' && error.code === 'insufficient_supplies')) {
          simChecked = { id: gameSession.game.id, tripId: gameSession.selected.id,
            type: action === 'retry' ? 'repeat' : 'replacement' };
          saveLocal('outpost-sim-checked', simChecked, partyStorage);
          if (action === 'retry' && simIsE01(gameSession.game)) rememberSimEvidence('repeatLaunch');
          return 'HTTP 409 · состояние после команды совпало с исходным.';
        }
      }
      throw error;
    }
  }, action === 'prepare' ? 'Экспедиция подготовлена.' :
      action === 'replace' ? 'Старый рейс отменён, новый резерв создан. Сверьте связь в карточке.' : 'Состояние рейса обновлено.');
}

function simObservation() {
  return JSON.stringify([gameSession.game, gameSession.selected]);
}

function e01CatalogKey(game) {
  return game.scenarioId === 'launch-transfer' ? 'catalog84' : 'catalog73';
}

function completedE01(key) {
  const attempt = readLocal('outpost-e01-completed-' + key, simNotebook[key]);
  return attempt?.firstLaunch && attempt.repeatLaunch ? attempt : null;
}

function attemptFor(game) {
  if (currentAttempt?.partyId === game.id) return currentAttempt;
  const key = e01CatalogKey(game);
  return [completedE01(key), simNotebook[key]].find(attempt => attempt?.partyId === game.id) ?? null;
}

function saveAttempt(fields) {
  const game = gameSession.game;
  currentAttempt = { partyId: game.id, ...attemptFor(game), ...fields };
  saveLocal('outpost-e01-attempt', currentAttempt, partyStorage);
  if (currentAttempt.firstLaunch && currentAttempt.repeatLaunch) {
    const key = e01CatalogKey(game);
    simNotebook[key] = currentAttempt;
    saveLocal('outpost-e01-completed-' + key, currentAttempt);
  }
}

function rememberSimEvidence(event, beforeStock) {
  const stock = gameSession.game.inventory.onHand;
  const trip = gameSession.selected;
  saveAttempt({ [event]: { http: gameSession.lastCommand.status, exchange: gameSession.lastCommand, stock,
    status: trip.status, history: trip.history.map(item => item.toStatus),
    ...(beforeStock ? { spent: { fuel: beforeStock.fuel - stock.fuel, rations: beforeStock.rations - stock.rations } } : {}) } });
}

function exportStudy() {
  const output = Course.stages.map((stage, index) => ({
    station: index + 1,
    name: stage.name,
    note: drafts[index] ?? '',
    selfReviewed: Boolean(reviews[index]),
    worksheets: Object.fromEntries(LearningCase.stages[index].sheets.map(sheet => [sheet.name,
      studyRows(sheet, worksheets[index] ?? {}).map(row => Object.fromEntries(sheet.columns.map((column, cell) =>
        [column, row[cell] ?? ''])))]))
  }));
  const observations = { catalog73: completedE01('catalog73'), catalog84: completedE01('catalog84') };
  if (Object.keys(simNotebook).length || observations.catalog73 || observations.catalog84) output.unshift({
    station: 'E01', name: 'Проверка запуска',
    simulatorEvidence: {
      mode: browserDemo ? 'browser-model' : 'reference-server',
      prediction: simNotebook.prediction ?? '',
      transferPrediction: simNotebook.transferPrediction ?? '',
      observations
    },
    studentApiEvidence: { ...simNotebook.studentApi,
      ...(simNotebook.studentApiNote ? { previousNote: simNotebook.studentApiNote } : {}) }
  });
  const url = URL.createObjectURL(new Blob([JSON.stringify(output, null, 2)], { type: 'application/json;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'outpost-project-decisions.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

main.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.choice !== undefined) {
    const field = button.closest('.challenge');
    field.querySelectorAll('[data-selected]').forEach(choice => delete choice.dataset.selected);
    grade(Number(field.dataset.question), Number(button.dataset.choice), field, button);
  }
  if (button.dataset.objective) {
    document.querySelectorAll('[data-objective]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    document.querySelector('#matrix-live').innerHTML = caseDecision(button.dataset.objective);
  }
  if (button.dataset.game) gameAction(button.dataset.game, button.dataset.value);
  if (button.hasAttribute('data-reset-goal')) {
    simGoal = null;
    saveLocal('outpost-sim-goal', null);
    renderSimulator();
    main.focus({ preventScroll: true });
  }
  if (button.hasAttribute('data-scroll-sheets')) focusWorksheet();
  if (button.hasAttribute('data-export-study')) exportStudy();
  if (button.dataset.addRow) {
    const sheet = LearningCase.stages[selectedStation].sheets.find(item => item.id === button.dataset.addRow);
    const saved = worksheets[selectedStation] ??= {};
    const rows = saved[sheet.id] ??= [sheet.columns.map(() => '')];
    rows.push(sheet.columns.map(() => ''));
    saveLocal('outpost-worksheets', worksheets);
    renderQuest();
    main.querySelector('[data-sheet="' + sheet.id + '"][data-row="' + (rows.length - 1) + '"]').focus();
  }
});

main.addEventListener('submit', event => {
  const operation = event.target.dataset.simForm;
  if (operation) {
    event.preventDefault();
    if (operation === 'select') {
      gameAction('select', event.target.elements.expeditionId.value);
    } else {
      const selected = event.target.querySelector('input[name="selection"]:checked');
      if (!selected) return;
      if (operation === 'launch') {
        saveAttempt({ source: selected.value });
        gameAction('transition', 'launch');
      } else if (operation === 'goal') {
        simGoal = { id: gameSession.game.id, choice: selected.value };
        saveLocal('outpost-sim-goal', simGoal);
        renderSimulator();
        main.focus({ preventScroll: true });
      } else {
        gameAction(selected.dataset.command ?? operation, selected.value);
      }
    }
    return;
  }
  if (!event.target.matches('.numeric')) return;
  event.preventDefault();
  const field = event.target.closest('.challenge');
  grade(Number(field.dataset.question), event.target.querySelector('input').valueAsNumber, field);
});

main.addEventListener('input', event => {
  const input = event.target;
  const notebookField = {
    'sim-prediction': 'prediction',
    'sim-transfer-prediction': 'transferPrediction'
  }[input.id];
  if (notebookField) {
    simNotebook[notebookField] = input.value;
    saveLocal('outpost-e01-notebook', simNotebook);
  }
  if (input.dataset.apiEvidence) {
    const evidence = simNotebook.studentApi ??= {};
    evidence[input.dataset.apiEvidence] = input.value;
    saveLocal('outpost-e01-notebook', simNotebook);
  }
  const editsDraft = input.id === 'draft';
  if (!editsDraft && !input.dataset.sheet) return;
  const wasComplete = completed(selectedStation);
  if (editsDraft) {
    drafts[selectedStation] = input.value;
    saveLocal('outpost-drafts', drafts);
  } else {
    const saved = worksheets[selectedStation] ??= {};
    const sheet = LearningCase.stages[selectedStation].sheets.find(item => item.id === input.dataset.sheet);
    const rows = saved[sheet.id] ??= [sheet.columns.map(() => '')];
    rows[Number(input.dataset.row)][Number(input.dataset.cell)] = input.value;
    saveLocal('outpost-worksheets', worksheets);
  }
  if (reviews[selectedStation]) {
    delete reviews[selectedStation];
    saveLocal('outpost-worksheet-reviews', reviews);
  }
  updateStationProgress();
  if (wasComplete !== completed(selectedStation)) paintNavigation();
});

main.addEventListener('change', event => {
  if (!event.target.hasAttribute('data-review-station')) return;
  reviews[selectedStation] = event.target.checked;
  saveLocal('outpost-worksheet-reviews', reviews);
  paintNavigation();
});

window.addEventListener('hashchange', () => route());
document.querySelector('.skip').addEventListener('click', event => {
  event.preventDefault();
  main.focus();
});
route(true);
