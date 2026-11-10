import { readFile, writeFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';

const www = new URL('../wwwroot/', import.meta.url);
const read = name => readFile(new URL(name, www), 'utf8');
const [css, courseSource, caseSource, references, studySource, primerSource, simulatorSource, appSource, index] = await Promise.all(
  ['site.css', 'course.js', 'case.js', 'reference.js', 'study.js', 'primer.js', 'simulator.js', 'app.js', 'index.html'].map(read)
);
const fixtureText = await readFile(new URL('../data/scenarios.json', import.meta.url), 'utf8');
const fixtures = JSON.parse(fixtureText);
const context = createContext({});
context.window = context;
runInContext([courseSource, caseSource, references, studySource].join('\n'), context);
const { Course, LearningCase, esc, table, stepList, stateDiagram, referenceContent, caseStageReference, worksheetExampleRows,
  e01Reference, lab07HttpGuide, apiSourceGuide, sourceAnchor, sourceLinks, workedExample } = context;

const sourceIds = new Set([...Course.sources, ...LearningCase.documents].map(([id]) => id));
for (const [index, stage] of LearningCase.stages.entries()) {
  for (const sheet of stage.sheets) {
    const worked = LearningCase.worked[sheet.id];
    if (!worked?.[0].length || worked[0].some(id => !sourceIds.has(id))) {
      throw new Error('Проверьте разбор первой строки и его ссылки для листа «' + sheet.name + '».');
    }
    const rows = worksheetExampleRows(stage, sheet, stage.singleGoal ? 'both' : 'total');
    if (!rows || rows.length < sheet.min || rows.some(row =>
      row.length !== sheet.columns.length || row.some(value => typeof value !== 'string' || !value.trim()))) {
      throw new Error('ЛР0' + (index + 1) + ' · «' + sheet.name + '». Эталон должен заполнить все поля и минимальное число строк рабочего листа.');
    }
  }
}

const studentLinks = [['student-guide.html', 'Задание'], ['launch.html', 'Первый API · E01'], ['brief.html', 'Досье'],
  ['primer.html', 'Вводный тренажёр'], ['workbook.html', 'Рабочие листы']];
const teacherLinks = [['index.html#simulator-learn', 'Тренажёр API'], ['index.html#map', 'Карта ЛР01–ЛР08'],
  ['index.html#simulator-materials', 'Учебные материалы']];

function document(title, description, body, student = false) {
  const nav = '<nav aria-label="Материалы">' + (student ? studentLinks : teacherLinks).map(([href, label]) =>
    '<a class="button" href="' + href + '">' + label + '</a>').join('') + '</nav>';
  return '<!doctype html><html lang="ru"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1"><title>' + esc(title) +
    '</title><style>' + css + '</style></head><body class="document"><header><p class="kicker">Орбитальный форпост</p><h1>' +
    esc(title) + '</h1><p>' + esc(description) + '</p>' + nav + '</header><article class="panel">' + body + '</article></body></html>';
}

function section(id, title, body) {
  return '<section id="' + id + '"><h2>' + esc(title) + '</h2>' + body + '</section>';
}

function code(text) {
  return '<pre><code>' + esc(text) + '</code></pre>';
}

const missionTable = table(['ID', 'Миссия', 'Топливо, ед.', 'Пайки, шт.', 'Награда, кр.'], Course.missions);
const dossier = table(['ID', 'Источник', 'Данные'], LearningCase.documents);
const documentSources = rows => rows.map(([id, title, text]) =>
  '<article class="dossier-source" id="source-' + sourceAnchor(id) + '"><h3>' + esc(id + ' · ' + title) + '</h3><p>' + esc(text) + '</p></article>').join('');
const revision = fixtures.revision;
const revisionTable = table(['Редакция M01', 'Топливо, ед.', 'Пайки, шт.', 'Награда, кр.'], [
  [1, ...Course.missions[0].slice(2)], [revision.revision, revision.cost.fuel, revision.cost.rations, revision.rewardCredits]
]);
const scenarioTable = table(['Сценарий', 'Название', 'Топливо, ед.', 'Пайки, шт.'],
  fixtures.scenarios.map(item => [item.id, item.title, item.stock.fuel, item.stock.rations]));
const outcomeTable = table(['Проверка', 'Условие', 'Ожидаемый результат'], LearningCase.outcomes);
const transfer = fixtures.scenarios.find(item => item.id === 'launch-transfer');
const firstValues = table(['Источник', 'Топливо', 'Пайки'], [
  ['Физический запас', transfer.stock.fuel, transfer.stock.rations],
  ['Согласованные условия E01', ...Course.missions[0].slice(2,4)],
  ['Текущий каталог', revision.cost.fuel, revision.cost.rations],
  ['Каталог в самостоятельной проверке', transfer.catalogCost.fuel, transfer.catalogCost.rations]
]);
const links = '<p><a href="https://github.com/OlgaKraven/2026-PIDIS-lab/tree/main/content/course-3/semester-5">Лабораторные первого семестра ПиДИС</a> · ' +
  '<a href="https://github.com/OlgaKraven/2026-PIDIS-lab/blob/main/inputs/course-3/wms-case.md">Учебный кейс WMS «Маршрут»</a></p>';

const brief = document('Досье «Донесение с орбиты»', 'Исходные сведения для принятия проектного решения.', [
  section('brief', '1. Входящие документы', '<p>Экспедиция M01 уже подготовлена, когда поступает новая редакция задания. Определить, при каких условиях выполнить существующий рейс и при каких подтвердить его замену.</p>' + documentSources(LearningCase.documents)),
  section('reference-data', '2. Справочные данные', '<p>Топливо измеряется в условных единицах, пайки — в штуках, награда — в кредитах. Исходный каталог:</p>' + missionTable +
    '<h3>Карточка обновления M01</h3>' + revisionTable +
    '<h3>Наборы для повторной проверки</h3><p>Каждая строка задаёт физический запас. M01 подготовлена по редакции 1, а каталог показывает новую редакцию. В наборе переноса текущая стоимость равна 8/4.</p>' + scenarioTable +
    '<p><a href="scenarios.json" download>Скачать исходные наборы JSON</a> · <a href="seed.json" download>Скачать исходный каталог JSON</a></p>'),
  section('base', '3. Исходный бриф', documentSources(Course.sources)),
  section('glossary', '4. Понятия для работы', table(['Термин', 'Что означает в задаче'], LearningCase.glossary))
].join(''), true);

const domain = document('Решение предметной области', 'Правила, сущности и последствия двух ветвей.', [
  section('brief', '1. Ситуация и цель', '<p>На орбитальной станции заканчиваются поставки. Диспетчер получает три заявки на рейс и ограниченный груз. Требуется выбрать последовательность миссий и получить наибольшую суммарную награду.</p>' +
    '<p>Партия одиночная, с детерминированным результатом рейса. Один игрок владеет одним набором запасов и собственным каталогом миссий.</p>' + dossier + revisionTable),
  section('data', '2. Начальный набор', '<p>Доступны 10 условных единиц топлива, 5 пайков и 0 кредитов. Все значения учебные.</p>' + missionTable +
    '<div class="diagram" aria-label="Сравнение стратегий"><span>Старая M01 + M03</span> → <span>190 кр. · остаток 0/0</span></div>' +
    '<div class="diagram"><span>Замена M01</span> → <span>160 кр. · остаток 3/2</span></div>' + scenarioTable),
  section('flow', '3. Цикл экспедиции', stateDiagram() + table(['Действие', 'Предусловие', 'Эффект'], [
    ['Подготовить', 'Достаточно каждого вида ресурса. Активный слот свободен. Миссия ещё не завершалась', 'Снимок стоимости и награды. Резерв уменьшает доступный запас'],
    ['Запустить', 'Рейс подготовлен', 'Списать снимок стоимости, освободить резерв и сохранить событие'],
    ['Завершить', 'Рейс запущен', 'Учесть снимок награды в балансе и закрыть активный слот'],
    ['Отменить', 'Рейс подготовлен', 'Освободить резерв. Разрешить новую попытку'],
    ['Заменить', 'Рейс подготовлен, принята новая редакция и хватает физического запаса', 'В одной транзакции отменить старый рейс и создать новый со ссылкой на старый']
  ]) + '<p><strong>Доступный запас</strong> равен физическому количеству за вычетом резерва. <strong>Баланс</strong> равен сумме снимков наград завершённых рейсов.</p>'),
  section('relationships', '4. Сущности и связи', '<div class="diagram" aria-label="Игрок, экспедиция и история"><span>Игрок</span> 1 → * <span>Экспедиция</span> 1 → * <span>Событие состояния</span></div>' +
    '<div class="diagram"><span>Миссия</span> 1 → * <span>Экспедиция</span> 1 → * <span>Строка снимка</span></div>' +
    table(['Связь', 'Смысл'], [
      ['Player 1 → * StockItem', 'По одной позиции на каждый вид ресурса'],
      ['Player 1 → * Mission', 'Каталог в пределах партии, позволяет независимо проверять правки'],
      ['Mission 1 → * MissionRequirement', 'Текущая стоимость по видам ресурсов'],
      ['Mission 1 → * Expedition', 'Несколько попыток, максимум одна завершённая'],
      ['Expedition 1 → * ExpeditionSupply', 'Стоимость каждой попытки фиксируется отдельно'],
      ['Expedition 1 → * ExpeditionStatusEvent', 'Начальное состояние и последующие переходы'],
      ['SupplyType 1 → * строки ресурсов', 'Справочник связывает запас, текущую цену и снимок']
    ]) + caseStageReference(5)),
  section('decisions', '5. Принятые проектные решения',
    table(['Вопрос', 'Решение', 'Причина'], [
      ['Что фиксировать?', 'Количество каждого ресурса и награду при подготовке', 'Воспроизводимость условий зарезервированного рейса'],
      ['Что хранить в истории?', 'Состояния, время UTC и порядковый номер события', 'Точный порядок и проверяемость повторного запроса'],
      ['Что считать при чтении?', 'Резерв, доступный запас и баланс', 'Один источник для каждого вычисления'],
      ['Как сохранить согласованность?', 'Транзакция SQLite и уникальные индексы', 'Одна запись активного рейса даже при конкурентной подготовке'],
      ['Почему прямой SQLite?', 'Microsoft.Data.Sqlite, DDL и SQL-запросы', 'На учебном прототипе видны ключи, запросы и границы транзакций'],
      ['Как сравнивать варианты?', 'Две свежие партии и одна партия для истории', 'Числа сравниваются при одинаковых исходных условиях']
    ]) + outcomeTable + links)
].join(''));

const reference = document('Эталоны ЛР01–ЛР08', 'Показ преподавателя и артефакты для сверки после выполнения задания.',
  section('show', 'Показ на занятии', stepList([
    'Открыть первый прототип E01. Показать начальный JSON, затем отправить запуск дважды. Для самостоятельной проверки изменить только каталог на 8/4.',
    'Открыть «Вводный тренажёр». Показать, что один и тот же запрос можно отправить из браузера и из .http.',
    'Открыть досье и выдать студенческий комплект. Предложить записать прогноз для запасов 10/5, 7/3 и 8/2.',
    'Открыть выбор сценария и выбрать «После донесения». Для максимума за партию запустить старую M01, завершить её и выполнить M03. В новой партии выбрать цель 150 по M01, затем подтвердить замену. Сравнить результаты.',
    'В «Сценариях» выбрать «Не хватает пайков». Нажать «Проверить замену» и открыть журнал. Сверить HTTP-ответ и резерв до и после.',
    'На станции 7 показать трассу R23 от источника С3 до теста 409. Затем сравнить запросы эталона и прототипа студента.'
  ]) + outcomeTable) +
  section('e01', 'Эталон первого API · E01', e01Reference() +
    '<p>Остаток 3/2 показывает списание по каталогу 7/3, а остаток 2/1 при переносе — списание по 8/4. В эталонном проекте <code>launch-reference</code> используется согласованная стоимость 6/2.</p>') +
  Course.stages.map((stage, index) =>
  section('lab-' + (index + 1), 'ЛР0' + (index + 1) + '. ' + stage.name,
    caseStageReference(index) +
    '<h3>Ответы испытания</h3>' + stepList(LearningCase.stages[index].quiz.map(task =>
      (task.choices?.[task.answer] ?? task.answer) + '. ' + task.reason))
  )).join('') + links);

const routeTable = table(['Маршрут', 'Вход', 'Успех', 'Ошибки'], [
  ['POST /api/demo/games?scenario=briefing', 'Без тела, имя набора в query. Для переноса E01 указать launch-transfer', '200 и id партии', '400'],
  ['GET /api/missions', 'X-Game-Id', '200 и каталог', '400/404'],
  ['GET /api/game', 'X-Game-Id', '200 и состояние партии', '400/404'],
  ['POST /api/expeditions', 'X-Game-Id и {"missionId":"M01"}', '201, Location и данные рейса', '400/404/409'],
  ['GET /api/expeditions/{id}', 'X-Game-Id и UUID рейса', '200, снимок и история', '400/404'],
  ['POST /api/expeditions/{id}/transitions', 'X-Game-Id и {"action":"launch"}', '200 и обновлённый рейс', '400/404/409'],
  ['POST /api/expeditions/{id}/replacements', 'X-Game-Id и {"expectedCatalogRevision":2}', '201, Location и новый рейс со ссылкой на старый', '400/404/409'],
  ['POST /api/demo/catalog-revision', 'X-Game-Id, контролируемая правка M01', '200, цена 7/3 и награда 160', '400/404']
]);

const guide = document('Пошаговый разбор проекта', 'От учебного задания до реализации и проверки действующего API.', [
  section('assignment', '1. Полное задание', '<p>Спроектировать и реализовать локальный прототип игры «Орбитальный форпост». Использовать ASP.NET Core Minimal API на .NET 10 и SQLite. Разработать восемь проектных артефактов, хранить снимки и события, реализовать команды подготовки, запуска, завершения и отмены. В интерфейсе показать каталог, изменение запасов, историю и результаты HTTP-запросов.</p>' +
    '<p>Проверить обе ветви после донесения, отмену, замену на границе запаса, недостаток ресурса, повтор команды, конкурентные действия и перезапуск. Представить исходный проект с инструкцией запуска, артефакты ЛР01–ЛР08 и протокол с запросами и наблюдаемыми значениями. Исходные правила и данные приведены в <a href="brief.html">досье</a>.</p>'),
  section('files', '2. Файлы для работы', table(['Материал', 'Как использовать'], [
    ['Start-Outpost.cmd и run/', 'Запустить готовый проект для изучения результата'],
    ['source/data/seed.json и source/data/schema.sql', 'Взять стартовые данные и сопоставить логическую модель с DDL'],
    ['source/Models.cs, Program.cs и GameStore.cs', 'Проследить путь от HTTP-запроса до записи данных'],
    ['source/wwwroot/', 'Открыть HTML, стили, задания и обработчики действий интерфейса'],
    ['source/checks/verify.mjs', 'Выполнить проверку по HTTP с отдельной БД и перезапуском'],
    ['Эталоны ЛР01–ЛР08', 'Сопоставить каждый артефакт с эталоном после выполнения']
  ]) + '<p><a href="reference.html">Открыть эталоны лабораторных</a></p>'),
  section('start', '3. Запустить проект', '<p><strong>Среда.</strong> Windows, ASP.NET Core Runtime 10 или .NET SDK 10, браузер. Для самостоятельной сборки нужен SDK, для автоматических проверок — Node.js 22+. Для просмотра квеста можно открыть index.html в браузере.</p>' +
    stepList([
      'Распаковать архив целиком в отдельный каталог. Запустить Start-Outpost.cmd, оставить окно сервера открытым и перейти по адресу из окна запуска. По умолчанию используется http://127.0.0.1:5191.',
      'На карте выбрать станцию 1. После чтения ситуации решить два задания. По кнопке «Свериться с эталоном» открыть готовый артефакт, затем вернуться к станции.',
      'Открыть «Симулятор» и пройти маршрут E01. Для сравнения стратегий открыть «Сценарии» и выбрать «После донесения». Сверить склад 10/5, резерв 6/2, старую редакцию рейса и новую редакцию каталога.'
    ]) + '<p><strong>Зачем.</strong> Первый прогон даёт ориентир для самостоятельной реализации. Готовая сборка использует настоящий сервер и создаёт файл данных при запуске.</p>' +
    '<p>При занятом порте можно запустить Start-Outpost.cmd 5193 и открыть адрес с этим портом. Сервер останавливается сочетанием Ctrl+C.</p>'),
  section('labs', '4. Решить восемь станций', Course.stages.map((stage, index) => {
    const task = LearningCase.stages[index];
    return (
    '<h3 id="step-' + (index + 1) + '">4.' + (index + 1) + '. ' + esc(stage.name) + '</h3>' +
    '<p><strong>Вход.</strong> ' + sourceLinks(task.source, 'brief.html#source-') + ' · ' + esc(task.brief) + '</p>' +
    '<p><strong>Приём.</strong> ' + esc(task.lesson) + '</p><p><strong>Пример.</strong> ' + esc(task.example) + '</p>' +
    '<p><strong>Действие.</strong> ' + esc(task.task) + '</p><p><strong>Зачем.</strong> ' + esc(task.why) +
    '</p><p><strong>Следующий шаг.</strong> ' + esc(task.next) +
    ' <a href="reference.html#lab-' + (index + 1) + '">Эталон ЛР0' + (index + 1) + '</a>.</p>');
  }).join('')),
  section('build', '5. Реализовать прототип', [
    ['5.1. Инициализировать ASP.NET Core', 'Открыть PowerShell в каталоге исходников. Для собственного проекта создать пустой Web-проект, подключить Microsoft.Data.Sqlite и добавить файл начальных данных.',
      code('dotnet new web -n MyOutpost -f net10.0\ncd MyOutpost\ndotnet add package Microsoft.Data.Sqlite --version 10.0.12'),
      'Пустой Web-проект содержит необходимые типы Minimal API. Пакет нужен для создания соединения и выполнения SQL.',
      'Проверить dotnet build. Для сверки целиком открыть OrbitalOutpost.csproj и Program.cs из образца.'],
    ['5.2. Подготовить схему и стартовый набор', 'Сохранить schema.sql и seed.json в каталоге data. Из файла проекта образца перенести настройки копирования Content и None для этих файлов. В схеме сначала создать справочники и владельцев, затем зависимые таблицы и два уникальных индекса.',
      '',
      'Разделение схемы и начальных данных позволяет воспроизвести одну и ту же партию без потери прошлых.',
      'Выполнить dotnet build. В bin/Debug/net10.0/data должны появиться оба файла. Убедиться, что в seed.json три миссии и стартовый запас 10/5.'],
    ['5.3. Задать типы и запросы чтения', 'В Models.cs создать входные PrepareRequest и TransitionRequest, затем типы ответа каталога, состояния и экспедиции. В GameStore.cs реализовать Initialize, NewGame, GetMissions, GetGame и общие методы транзакций. В Program.cs загрузить seed, вызвать Initialize и временно подключить только POST /api/demo/games, GET /api/missions и GET /api/game.',
      '',
      'Контракт отделяет данные клиента от серверного состояния. Запас и баланс собираются из источников по формулам области.',
      'Выполнить dotnet run. Отправить первые четыре строки блока PowerShell из раздела 6, используя адрес запуска. Сверить три миссии. GET /api/game с тем же заголовком должен вернуть onHand и available 10/5, reserved 0/0, credits 0.'],
    ['5.4. Реализовать подготовку и переходы', 'В GameStore.Prepare открыть недеферированную транзакцию, проверить миссию, активный слот и запас, записать экспедицию, снимок стоимости и событие. В Transition выбрать разрешённый переход из пары «текущее состояние / команда», при запуске списать снимок, затем записать состояние и событие.',
      '',
      'Одна транзакция охватывает чтение предусловий и запись. Уникальные индексы дополнительно закрепляют один активный и один завершённый рейс по миссии.',
      'До подключения маршрутов сверить таблицу переходов со switch в Transition. В Write должны входить проверки, запись статуса, списание и событие. После подключения маршрутов в шаге 5.5 проверить подготовку M01 (на складе 10/5, резерв 6/2), первый launch (на складе 4/3) и повторный launch (409).'],
    ['5.5. Подключить маршруты и ошибки', 'Сгруппировать маршруты через MapGroup("/api"). Заголовок X-Game-Id определяет партию. Для подготовки вернуть 201 и Location, для перехода — 200 с новым состоянием. В ошибках вернуть 400, 404 или 409 по контракту.',
      '',
      'Клиент может открыть созданную запись по Location. Предметный конфликт отличим от неверного формата и отсутствующего объекта.',
      'Подготовить M01 и прочитать Location. Отправить повторную подготовку, проверить статус и код active_expedition.'],
    ['5.6. Связать интерфейс с API', 'В wwwroot добавить страницу, стили и JavaScript. При старте партии сохранить id, передавать его заголовком. После команды перечитать состояние и выбранную экспедицию. Для истории отобразить события в порядке sequence.',
      '',
      'Интерфейс показывает результат проверки сервера. Журнал HTTP связывает кнопку с реальным запросом и ответом.',
      'В браузере проверить, что запуск меняет оба вида остатков и добавляет событие «В полёте». Выполнить тот же запрос из PowerShell.'],
    ['5.7. Сохранить доказательства и сверить', 'Выполнить обе стратегии из свежих партий, затем отдельную проверку снимка. Зафиксировать запрос, статус и сравнение значений. Сверить артефакты каждой станции с эталоном.',
      '',
      'Сценарии отделяют ошибки данных и сервера от визуальных эффектов клиента.',
      'В учебных ветвях получить 190/0/0 и 160/3/2. Отклонить повторный complete и сохранить снимок исходной M01.'],
    ['5.8. Реализовать замену по принятой редакции', 'В GameStore открыть транзакцию записи. Прочитать исходный рейс и текущую миссию, сравнить редакции и проверить каждый ресурс после учёта освобождаемого резерва. Записать отмену и новый рейс со ссылкой на исходный. Из Program.cs вернуть 201 и Location.',
      '',
      'Состояние старого рейса и создание нового изменяются совместно. Клиент принимает конкретную редакцию, а сервер хранит цену и награду.',
      'В наборе 7/3 замена проходит. В наборе 8/2 сверить 409 insufficient_supplies, прежний ID, статус prepared, резерв 6/2 и одно событие.']
  ].map(([heading, action, example, why, check]) => '<h3>' + heading + '</h3><p>' + action + '</p>' + example +
    '<p><strong>Зачем.</strong> ' + why + '</p><p><strong>Проверить.</strong> ' + check + '</p>').join('') +
    '<h3>Запуск исходников</h3><p>Из каталога source в распакованном архиве:</p>' +
    code('dotnet restore\ndotnet run --no-launch-profile --urls http://127.0.0.1:5191')),
  section('http', '6. Контракт и контрольный запрос', routeTable +
    '<p><a href="openapi.json">Контракт в формате OpenAPI</a></p>' +
    '<p>Запустить сервер и открыть второе окно PowerShell. Следующий блок выполняется целиком и воспроизводит первый рейс.</p>' +
    code(`$base = 'http://127.0.0.1:5191/api'
$party = Invoke-RestMethod -Method Post -Uri "$base/demo/games"
$headers = @{ 'X-Game-Id' = $party.id }
Invoke-RestMethod -Uri "$base/missions" -Headers $headers
$expedition = Invoke-RestMethod -Method Post -Uri "$base/expeditions" -Headers $headers \`
  -ContentType 'application/json' -Body '{"missionId":"M01"}'
$transition = "$base/expeditions/$($expedition.id)/transitions"
Invoke-RestMethod -Uri "$base/game" -Headers $headers
Invoke-RestMethod -Method Post -Uri $transition -Headers $headers \`
  -ContentType 'application/json' -Body '{"action":"launch"}'
Invoke-RestMethod -Method Post -Uri $transition -Headers $headers \`
  -ContentType 'application/json' -Body '{"action":"complete"}'
Invoke-RestMethod -Uri "$base/game" -Headers $headers | ConvertTo-Json -Depth 8
`) + '<p>В итоговом ответе credits = 100, onHand = 4/3. В журнале рейса три события. Повторить запрос complete и проверить статус 409, затем повторить GET и сверить прежние значения.</p>'),
  section('acceptance', '7. Прогнать контрольные сценарии', stepList([
    'В «Сценариях» открыть «После донесения». Запустить старую M01 и завершить её. Затем выполнить M03. Результат появится в сравнении стратегий.',
    'Создать вторую партию «После донесения». Выбрать цель 150 по M01, затем подтвердить замену. В журнале открыть карточки обеих попыток. Запустить и завершить новый рейс, затем открыть сравнение.',
    'Повторить замену при запасах 7/3, 6/2 и 8/2. Для отказов перечитать исходный рейс и запасы.',
    'Проверить устаревшую редакцию и повтор завершения. Для обычной отмены открыть свободную партию, подготовить M01 и отменить.',
    'Для независимой проверки перейти в корень распакованного архива и выполнить node source/checks/verify.mjs run. Скрипт проверяет в том числе два одновременных запроса и повторный запуск сервера на том же файле БД.'
  ]) + outcomeTable + referenceContent('audit')),
  section('handoff', '8. Подготовить сдачу', '<p>Приложить исходный проект, описание запуска, артефакты ЛР01–ЛР08 и протокол проверок. Для каждой проверки указать исходное состояние, действие, ожидаемый результат и фактический ответ. Сохранить снимки сравнения двух стратегий и истории M01 после правки каталога.</p>' +
    '<p>При переносе в другую область сначала заменить бриф и набор начальных данных. Затем заново вывести сущности, правила, снимки и ожидаемые результаты. Для «Мастерской» миссия становится заказом, стоимость — материалами, а завершение — сдачей изделия. Значения 190 и 150 относятся к орбитальному примеру.</p>' + links)
].join(''));

const workbook = document('Рабочие листы ЛР01–ЛР08', 'Пустые таблицы для работы по карте. Печатная версия дополняет формы квеста.',
  LearningCase.stages.map((stage, index) => section('lab-' + (index + 1), 'ЛР0' + (index + 1) + '. ' + Course.stages[index].name,
    '<p>' + esc(stage.task) + '</p>' + stage.sheets.map(sheet =>
      '<h3>' + esc(sheet.name) + '</h3>' + workedExample(stage, sheet, { row: true, interactive: false }) +
      table(sheet.columns, Array.from({ length: sheet.min }, () => sheet.columns.map(() => '\u00a0')))
    ).join('') + (index === 0 ? '' : '<p>Прогноз / обоснование / замечание после сверки __________________________________________</p>')
  )).join(''), true);

const launch = document('Первый прототип API · Рейс E01', 'Практика для первого знакомства с Minimal API и JSON.', [
  section('briefing', '1. Прочитать донесение', '<p>Рейс E01 уже подготовлен для ремонта антенны. Штаб обновил карточку M01 в каталоге. Задача — написать обработчик запуска и проверить, какое количество будет списано.</p>' + firstValues +
    '<p>В этой первой практике сервер обслуживает один рейс. Данные хранятся в памяти. Перезапуск возвращает начальное состояние. В полном проекте по карте партии и история сохраняются в SQLite.</p>' +
    '<p><a class="button" href="primer.html#e01">Открыть анимацию запуска E01</a></p>'),
  section('start', '2. Запустить заготовку', '<p>Распаковать студенческий комплект. Открыть PowerShell в каталоге <code>first-api</code>. Для запуска нужен .NET SDK 10.</p>' +
    code('dotnet run --no-launch-profile --urls http://localhost:5201') +
    '<p>Открыть <a href="http://localhost:5201/api/game">состояние рейса в браузере</a>. Найти <code>stock</code>, <code>agreedCost</code>, <code>currentCost</code>, <code>status</code> и <code>history</code>. Записать прогноз остатков. Остановить сервер сочетанием Ctrl+C перед правкой файла.</p>'),
  section('launch', '3. Написать команду запуска', '<p>В заготовке уже есть GET и тип <code>LaunchRequest</code>. Добавить перед <code>app.Run()</code> обработчик <code>POST /api/expeditions/E01/transitions</code>. Для сравнения ниже показана команда открытия шлюза. Она проверяет имя команды и текущее состояние до изменения данных.</p>' +
    code('var hatchOpen = false;\napp.MapPost("/example/hatch", (LaunchRequest request) =>\n{\n    if (request.Action != "open")\n        return Results.BadRequest(new { error = "invalid_action" });\n    if (hatchOpen)\n        return Results.Conflict(new { error = "already_open" });\n\n    hatchOpen = true;\n    return Results.Ok(new { hatchOpen });\n});') + stepList([
      'Принять LaunchRequest. Если action отличается от launch, вернуть 400.',
      'Проверить статус prepared. При другом статусе вернуть 409 до изменения состояния.',
      'Выбрать источник стоимости между agreedCost и currentCost. Записать причину выбора в протоколе. Рассчитать остаток каждого ресурса и присвоить stock новый Resources.',
      'Присвоить статус inFlight, добавить его в history, вернуть 200 с полями status и stock.'
    ]) + '<p><strong>Проверка сборки.</strong> Запустить dotnet run. При ошибке открыть первую строку с именем Program.cs и номером строки. Сверить скобки обработчика и расположение кода перед app.Run().</p>'),
  section('verify', '4. Проверить запуск и повтор', '<p>В файле <code>requests.http</code> выполнить GET перед запуском и после каждого из двух одинаковых POST. Между запросами сервер продолжает работать. При отсутствии поддержки .http выполнить GET, а затем блок PowerShell ниже дважды.</p>' +
    code(`$launch = @{
    Uri = 'http://localhost:5201/api/expeditions/E01/transitions'
    Method = 'Post'
    ContentType = 'application/json'
    Body = '{"action":"launch"}'
}
try {
    $reply = Invoke-WebRequest @launch
    $reply.StatusCode
    $reply.Content
} catch {
    if (-not $_.Exception.Response) { throw }
    [int]$_.Exception.Response.StatusCode
}
Invoke-RestMethod http://localhost:5201/api/game | ConvertTo-Json -Depth 6`) +
    '<p>Для каждого запроса записать HTTP-код, статус рейса, запас и историю. В свежей партии можно получить готовый протокол реальных запросов командой <code>./Check-E01.ps1 -AsJson</code> из папки <code>first-api</code>. Затем остановить сервер и запустить с новыми текущими условиями.</p>' +
    code('dotnet run --no-launch-profile --urls http://localhost:5201 --LaunchTransfer true') +
    '<p>Проверить через GET, что каталог стал 8/4. Предсказать результат запуска и его повтора. Для автоматической проверки выполнить <code>./Check-E01.ps1 -Catalog "8/4" -AsJson</code>. Сдать папку <code>first-api</code> и фактический HTTP-протокол обоих наборов. Результаты тренажёра сохранить отдельно.</p>'),
  section('reference', '5. Сверить результат', '<details><summary>Открыть эталон E01 после проверки</summary>' + e01Reference() + '</details>'),
  section('next', '6. Перейти к проекту по карте', '<p>На станции 6 перенести идею снимка в модель SQLite, на станции 7 — свои проверки в протокол API. В тренажёре открыть «Сценарии» и выбрать «Перенос E01». У рейса будет выданный сервером UUID. В минимальной практике его роль выполняет постоянный код E01.</p>')
].join(''), true);

const studentGuide = document('Задание на разработку прототипа API', 'Самостоятельная работа по карте «Орбитального форпоста».', [
  section('assignment', '1. Что разработать', '<p>Базовое задание — <a href="launch.html#launch">практика E01</a> с одним рейсом в памяти. Реализовать GET состояния и POST запуска. Запустить свой сервер и проверить первый и повторный запросы на каталогах 7/3 и 8/4. Сдать папку first-api и протокол HTTP.</p><p>Если назначен проект по карте, расширить прототип до нескольких рейсов и сохранения истории в SQLite. Спроектировать каталог, подготовку, запуск, завершение и отмену. Сохранить снимок условий, принятых при подготовке.</p>' +
    '<p>Для варианта с заменой реализовать атомарную команду принятия редакции. Сдать проект, заполненные листы и результаты проверок выбранного решения.</p>'),
  section('files', '2. Что открыть', table(['Материал', 'Когда использовать'], [
    ['brief.html, seed.json, scenarios.json', 'Прочитать документы и получить воспроизводимые исходные данные'],
    ['primer.html и first-api/', 'Основное задание E01. Разобрать запрос и написать обработчик запуска'],
    ['workbook.html', 'Для продолжения с SQLite. Оформить результаты восьми станций'],
    ['starter/', 'Для продолжения с SQLite. Использовать чтение исходных наборов и файл запросов'],
    ['openapi.json', 'Для продолжения с SQLite. Сверить маршруты, параметры и поля']
  ])),
  section('route', '3. Продолжение с SQLite по карте', '<nav aria-label="Станции маршрута">' + Course.stages.map((stage, index) =>
    '<a class="button" href="#station-' + (index + 1) + '">' + (index + 1) + '. ' + esc(stage.station) + '</a>').join('') +
    '</nav>' + LearningCase.stages.map((stage, index) =>
    '<h3 id="station-' + (index + 1) + '">ЛР0' + (index + 1) + '. ' + esc(Course.stages[index].name) + '</h3><p>' + esc(stage.task) +
    '</p><p><strong>Опора.</strong> ' + sourceLinks(stage.source, 'brief.html#source-') + '.</p><p><strong>Приём.</strong> ' + esc(stage.lesson) +
    '</p><p><strong>Зачем.</strong> ' + esc(stage.why) + '</p><p>' + esc(stage.next) + '</p>' + (index === 6 ? lab07HttpGuide() : '')
  ).join('')),
  section('api', '4. Расширить API для нескольких рейсов', stepList([
    'Открыть терминал в starter. Выполнить команды ниже. Проверить GET /healthz и GET /study/fixtures. Открыть requests.http. Эти запросы запускаются после старта приложения.',
    'По ЛР04–ЛР06 создать schema.sql с ключами, связями и ограничениями. Подключить Microsoft.Data.Sqlite из файла проекта. Загрузить seed.json и научиться создавать новую партию. Сначала вернуть каталог и состояние. Сверить 10/5 без резерва для свободной партии.',
    'Разработать DTO для подготовки и переходов. В подготовке проверить один активный рейс, наличие миссии и запас каждого ресурса. Записать снимок и первое событие. В ответ вернуть 201 и маршрут карточки.',
    'Подключить launch, complete и cancel. Списывать по снимку, записывать историю и рассчитывать баланс из завершённых попыток. Проверить, что редакция каталога и снимок рейса различаются после донесения.',
    'Для ветви Б добавить проверку редакции, закрытие прежней попытки и создание новой в одной транзакции. Для ветви А сохранить действующие условия до завершения. Указать в отчёте, как выбранное решение следует из цели.',
    'В requests.http подставить ID партии из ответа её создания и ID рейса из activeExpedition.id. Прогнать запросы на своей сборке. Для проверки 409 выполнить GET до и после команды и сравнить состояние.'
  ]) + code('dotnet restore\ndotnet run --urls http://127.0.0.1:5201') +
    '<p>Если редактор не умеет выполнять .http, отправить запросы через PowerShell с Invoke-RestMethod. Пример находится в README.md рядом с проектом. Проверить наличие .NET SDK 10 командой dotnet --version.</p>'),
  section('api-practice', '5. Проверить источники данных через API', apiSourceGuide()),
  section('proof', '6. Проверить и сдать', '<p><strong>Для E01.</strong> Передать папку first-api и протокол своего API на 7/3 и 8/4. Приложить запросы, ответы и состояние после каждой команды. Отдельно объяснить выбор источника списания.</p>' +
    '<p><strong>Для проекта с SQLite.</strong> Приложить исходники, рабочие листы, запись проектного решения и протокол. Для выбранной ветви проверить успех, границу, отказ и чтение после перезапуска.</p>')
].join(''), true);

const materials = document('Материалы квеста', 'Один комплект для самостоятельной работы.',
  section('student', 'Что скачать', '<p>В комплекте — досье, рабочие листы, исходные JSON, заготовки C# и проверка E01. Объяснения и эталоны собраны в тренажёре.</p>' +
    '<div class="actions"><a class="button primary" href="student-kit.zip" download>Скачать комплект студента</a>' +
    '<a class="button" href="index.html#simulator-reference">Открыть эталон</a></div>'));

const primer = '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
  '<title>Вводный тренажёр по API</title><style>' + css + '</style></head><body class="outpost-app"><main data-standalone-primer style="margin-top:24px"></main>' +
  '<script>' + primerSource + '</script></body></html>';
const seedText = await readFile(new URL('../data/seed.json', import.meta.url), 'utf8');
const documents = { 'domain.html': domain, 'reference.html': reference, 'guide.html': guide, 'brief.html': brief, 'launch.html': launch,
  'workbook.html': workbook, 'student-guide.html': studentGuide, 'materials.html': materials, 'primer.html': primer,
  'seed.json': seedText, 'scenarios.json': fixtureText };

await Promise.all(Object.entries(documents).map(([name, content]) =>
  writeFile(new URL(name, www), content, 'utf8')));

if (process.argv[2]) {
  const { mkdir } = await import('node:fs/promises');
  const { resolve, join } = await import('node:path');
  const target = resolve(process.argv[2]);
  await mkdir(target, { recursive: true });
  const singlePage = index.replace(/<link rel="stylesheet" href="site\.css(?:\?[^"]*)?">/, () => '<style>' + css + '</style>')
    .replace(/  <script src="[^"]+" defer><\/script>\r?\n/g, '')
    .replace('</body>', () => '<script>' + [courseSource, caseSource, references, studySource, primerSource, simulatorSource, appSource].join('\n') + '</script>\n</body>');
  await Promise.all(Object.entries({ 'index.html': singlePage, ...documents,
    'openapi.json': await read('openapi.json') })
    .map(([name, content]) => writeFile(join(target, name), content, 'utf8')));
}
