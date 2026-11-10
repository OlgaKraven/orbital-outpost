(() => {
  const slides = [
    {
      title: 'Прототип API', labels: ['Запрос чтения', 'Маршрут', 'Данные в памяти', 'Ответ'],
      intro: 'Задача E01 — получить состояние одного рейса и отправить команду запуска. Начните с чтения, чтобы видеть исходные данные до первой записи.',
      frames: [
        ['Начните с исходного состояния', 'Перед запуском нужно увидеть статус, склад и условия рейса. Такой ответ даёт первый маршрут.'],
        ['Клиент отправляет запрос', 'GET запрашивает состояние. Маршрут /api/game определяет, какие данные нужны.', 'GET /api/game'],
        ['MapGet связывает путь с кодом', 'В Program.cs обработчик собирает поля для ответа. C# создаёт объект, ASP.NET Core преобразует его в JSON.', 'app.MapGet("/api/game", () =>\n    new { status, stock, agreedCost, currentCost, history });'],
        ['Данные хранятся в памяти', 'Один рейс представлен переменными в Program.cs. Этого достаточно, чтобы проверить исходное состояние и эффект одной команды.'],
        ['Ответ становится точкой отсчёта', 'Сохраните состояние до команды. Позже запросите его снова и сравните, что изменилось.', '{ "status": "prepared", "stock": { "fuel": 10, "rations": 5 } }']
      ]
    },
    {
      title: 'HTTP-запрос и ответ', labels: ['Метод и путь', 'Заголовки', 'Тело', 'Результат'],
      intro: 'Студенту нужно запустить уже подготовленный E01. Соберите запрос из метода, адреса, заголовка и тела. Затем по ответу определите результат.',
      frames: [
        ['Определите действие', 'Запуск меняет состояние. Поэтому для него нужен POST. Перед и после команды GET покажет, как изменились данные.'],
        ['Укажите метод и путь', 'Сервер находит обработчик по двум признакам: POST и путь к переходам E01.', 'POST /api/expeditions/E01/transitions'],
        ['Обозначьте формат тела', 'Content-Type сообщает серверу, как прочитать тело. В файле .http между заголовком и телом нужна пустая строка.', 'Content-Type: application/json'],
        ['Укажите команду', 'Поле action сообщает, какой переход требуется. Сервер определяет стоимость по своим данным.', '{ "action": "launch" }'],
        ['Прочитайте ответ', '200 означает, что команда принята. 400 указывает на ошибку в запросе, 409 — на конфликт с текущим состоянием. После ответа перечитайте склад через GET.', 'HTTP/1.1 200 OK']
      ]
    },
    {
      title: 'Как собрать JSON для E01', labels: ['Команда', 'Тело запроса', 'Поле в C#', 'Проверка'],
      intro: 'Команда «Запустить рейс» должна попасть из файла requests.http в ваш обработчик. JSON — текстовое тело запроса, из которого ASP.NET Core заполнит объект LaunchRequest.',
      frames: [
        ['Диспетчер выбирает запуск', 'Маршрут указывает рейс E01. Телу запроса остаётся передать имя команды — launch.', 'POST /api/expeditions/E01/transitions'],
        ['Выберите поле для команды', 'Положите команду в объект. Фигурные скобки обозначают объект, action — имя поля. После двоеточия идёт строка в двойных кавычках.', '{ "action": "launch" }'],
        ['Поставьте JSON в конец запроса', 'Сначала адрес и заголовок формата, затем пустая строка и тело. Сервер знает, где начинается JSON.', 'POST /api/expeditions/E01/transitions\nContent-Type: application/json\n\n{ "action": "launch" }'],
        ['Прочитайте значение в обработчике', 'ASP.NET Core заполнит request.Action из поля action. Код проверит значение launch, затем статус prepared. Только после этих проверок можно списывать запас.', 'record LaunchRequest(string? Action);\n// В обработчике:\nif (request.Action != "launch") return Results.BadRequest();'],
        ['Соберите тело сами', 'Исправьте заготовку. После проверки вставьте полученный JSON в requests.http сразу после пустой строки под Content-Type.']
      ]
    },
    {
      title: 'Модель данных и снимок', labels: ['Mission', 'Expedition', 'ExpeditionSupply', 'ExpeditionStatusEvent'],
      intro: 'Таблица хранит экземпляры сущности. Первичный ключ различает записи. Внешний ключ связывает запись с другой таблицей.',
      frames: [
        ['Сопоставьте каталог и рейс', 'Одна миссия может иметь несколько попыток. Снимок хранится у попытки.'],
        ['Каталог показывает текущие условия', 'У M01 в каталоге редакция 2. В учебной базе карточка принадлежит конкретной партии.', 'Mission: playerId + id\nM01 · редакция 2 · 160 кредитов'],
        ['Рейс хранит принятые условия', 'Expedition ссылается на Mission. В уже подготовленном рейсе остаются редакция 1 и награда 100.', 'Expedition: id → missionId\nСнимок: редакция 1, 100 кредитов'],
        ['Стоимость хранится по видам', 'У одного рейса две строки стоимости. Для запуска читается 6 топлива и 2 пайка из снимка.', 'ExpeditionSupply: expeditionId + supplyCode\nfuel = 6\nrations = 2'],
        ['Переходы записываются отдельно', 'Журнал связан с рейсом через expeditionId. Поле sequence определяет порядок, а время UTC фиксирует момент.', '1 prepared → 2 inFlight → 3 completed']
      ],
      structure: true
    },
    {
      title: 'Резерв, запуск, награда', labels: ['На складе', 'Подготовка', 'Запуск', 'Завершение'],
      intro: 'Резерв удерживает груз для подготовленного рейса. Физическое количество уменьшается при запуске.',
      frames: [
        ['До подготовки', 'Есть 10 топлива и 5 пайков. Пока доступен весь запас.', null, [10,5,0,0,0]],
        ['Подготовить M01', 'На складе остаётся 10/5. Резерв 6/2. Доступно 4/3.', null, [10,5,6,2,0]],
        ['Запустить M01', 'Сервер списывает стоимость снимка. На складе 4/3, резерва нет.', null, [4,3,0,0,0]],
        ['Завершить M01', 'Баланс увеличивается на 100 кредитов. Доступный запас 4/3 позволяет подготовить M03.', null, [4,3,0,0,100]]
      ],
      direct: true
    },
    {
      title: 'Замена и транзакция', labels: ['Проверка', 'Старый рейс', 'Новый рейс', 'Результат'],
      intro: 'Транзакция связывает проверки и запись. Замена целиком сохраняется только при допустимом результате.',
      variants: [['ok', 'Запас 7 / 3'], ['fail', 'Запас 8 / 2']],
      frames: [
        ['Исходный рейс подготовлен', 'Резерв 6/2, каталог уже требует 7/3. Выберите запас для учебного примера.'],
        ['Сервер сравнивает каждый ресурс', 'После учёта старого резерва 7 ≥ 7 и 3 ≥ 3. Замена допустима.'],
        ['Закрывается исходная попытка', 'Изменение выполняется внутри транзакции. Исходный рейс получит статус cancelled при подтверждении всех изменений.'],
        ['Создаётся связанный рейс', 'Новый рейс получит снимок 7/3 и 160 и ссылку на исходный идентификатор.'],
        ['Изменения подтверждены', '201 Created. Резерв 7/3, доступно 0/0. Физическое списание произойдёт при запуске.', 'COMMIT → 201 Created', [7,3,7,3,0]]
      ],
      failure: [
        ['Исходный рейс подготовлен', 'На складе 8 топлива и 2 пайка. Резерв 6/2, каталог требует 7/3.', null, [8,2,6,2,0]],
        ['Проверка обнаружила дефицит пайков', 'Топлива хватает: 8 ≥ 7. Пайков не хватает: 2 < 3. Переход к изменениям закрыт.', null, [8,2,6,2,0]],
        ['Состояние сохраняется', '409 и код insufficient_supplies. Старый рейс остаётся prepared, резерв 6/2, доступно 2/0. Ни один новый рейс или событие не записаны.', '409 Conflict · insufficient_supplies', [8,2,6,2,0], 3]
      ]
    },
    {
      title: 'Контракт и проверка API', labels: ['Условие', 'Прогноз', 'Запрос', 'Сверка'],
      intro: 'Контракт описывает маршруты, вход и выход. Приёмочный тест связывает этот контракт с реальным состоянием базы.',
      frames: [
        ['Выберите контрольный случай', 'На складе 8/2. M01 подготовлена по редакции 1. Каталог отдаёт редакцию 2.'],
        ['Запишите прогноз', 'Укажите статус, код и состояние после отказа. Сохраните исходный ID и количество событий.', 'Ожидание: 409; резерв 6/2; старый рейс prepared'],
        ['Выполните HTTP-запрос', 'Подставьте ID партии и рейса в файл requests.http. Можно отправить запрос напрямую к своей сборке.', 'POST /api/expeditions/{{expeditionId}}/replacements\n{ "expectedCatalogRevision": 2 }'],
        ['Сопоставьте наблюдения', 'Сверьте статус и code, затем перечитайте состояние партии и историю. Откройте контракт OpenAPI, чтобы проверить поля и типы.', 'Факт: 409 insufficient_supplies. До/после: резерв 6/2, одно событие.']
      ]
    },
    {
      title: 'Практика: запуск E01', labels: ['Исходные данные', 'Проверка статуса', 'Первый запуск', 'Повтор команды'],
      intro: 'В первом прототипе один рейс, а данные хранятся в памяти. Сформулируйте прогноз по двум условиям каталога и проверьте его своим обработчиком.',
      variants: [['ok', 'Каталог 7 / 3'], ['fail', 'Каталог 8 / 4']],
      direct: true,
      frames: [
        ['Сопоставьте три записи', 'Склад 10/5. Снимок E01 6/2. Каталог M01 7/3. Какой источник определит списание?', null, [10,5,6,2,0]],
        ['Команда launch допустима', 'Рейс имеет статус prepared. Обработчик проверяет action и состояние до изменения запаса.', 'POST /api/expeditions/E01/transitions\n{ "action": "launch" }'],
        ['Первый запуск · 200', 'Списывается 6/2 из согласованного снимка. Остаток 4/3, журнал получает inFlight.', '{ "status": "inFlight", "stock": { "fuel": 4, "rations": 3 } }', [4,3,0,0,0]],
        ['Повтор той же команды · 409', 'Статус уже inFlight. Остаток 4/3 и два события сохраняются.', '409 Conflict\nhistory: prepared → inFlight', [4,3,0,0,0]]
      ],
      failure: [
        ['Изменился только каталог', 'Склад 10/5. Снимок E01 6/2. Каталог M01 теперь 8/4. Запишите новый прогноз.', null, [10,5,6,2,0]],
        ['Проверяем статус prepared', 'Каталог изменился, но запуск относится к уже согласованному рейсу. Тело команды осталось прежним.', '{ "action": "launch" }'],
        ['Первый запуск · 200', 'Снимок по-прежнему 6/2. Остаток равен 4/3. Остаток 2/1 указывал бы на ошибочное чтение каталога.', '{ "status": "inFlight", "stock": { "fuel": 4, "rations": 3 } }', [4,3,0,0,0]],
        ['Повтор · 409', 'Проверка состояния выполняется до списания. Результат: 4/3 и два события.', '409 Conflict\nhistory: prepared → inFlight', [4,3,0,0,0]]
      ]
    }
  ];
  const practiceNotes = [
    ['Зачем этот порядок', 'Сначала нужен работающий GET. По нему можно проверить, что состояние задано правильно, и измерить эффект будущего POST.', 'В папке first-api запустите заготовку и прочитайте /api/game. Найдите склад, снимок и каталог в одном ответе.'],
    ['Зачем этот порядок', 'Метод и путь находят обработчик. Заголовок помогает прочитать тело. Тело задаёт команду, а ответ показывает, принял ли её сервер.', 'Откройте requests.http. Найдите метод, путь, Content-Type и тело. Затем отправьте GET, POST запуска и ещё один GET.'],
    ['Зачем этот порядок', 'Сначала определите, какую команду принимает C#. Из этого следует имя поля и его тип. Только затем соберите текст JSON.', 'Используйте проверенное тело в POST своего проекта. При 400 проверьте значение action и формат запроса.'],
    ['Зачем этот порядок', 'Сначала различите миссию и рейс, затем решите, где хранить стоимость и события. Связи на схеме показывают происхождение данных.', 'В ЛР04–ЛР06 внесите миссию, рейс и снимок в рабочий лист. Для каждой записи укажите ключ и назначение.'],
    ['Зачем этот порядок', 'Подготовка удерживает груз. Запуск расходует груз. Завершение подтверждает награду. Каждый шаг меняет свою часть состояния.', 'В ЛР05 запишите предусловие и результат каждой команды. В ЛР07 проверьте запас и резерв после подготовки и запуска.'],
    ['Зачем этот порядок', 'Сначала сервер проверяет запас, затем меняет обе записи в одной транзакции. Так отказ оставляет понятное состояние для диспетчера.', 'В сценариях проверьте замену на запасах 7/3 и 8/2. Сравните старый и новый рейсы, резерв и код HTTP.'],
    ['Зачем этот порядок', 'Прогноз записывают до запроса. После запроса сверяют и код, и фактическое состояние. Это выявляет ошибки, даже если HTTP-код выглядит верно.', 'Для своего API запустите Check-E01.ps1. Для проекта с SQLite сохраните в ЛР07 состояние до команды и после неё.'],
    ['Зачем этот порядок', 'Первый запуск меняет статус и запас. Повтор той же команды проверяет, что сервер учитывает новый статус до списания.', 'В first-api сначала реализуйте проверку action и статуса, затем списание по снимку. Прогоните оба каталога: 7/3 и 8/4.']
  ];

  const escape = value => String(value).replace(/[&<>"']/g, character =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

  function inventory(values) {
    const [fuel, rations, fuelHeld, rationsHeld, credits] = values;
    const bar = (label, stock, reserved, maximum) => '<div class="stock-line"><span>' + label +
      ' · склад ' + stock + ' · резерв ' + reserved + ' · доступно ' + (stock - reserved) +
      '</span><div class="stock-track" aria-hidden="true"><i style="--share:' + reserved / maximum * 100 +
      '%"></i><b style="--share:' + (stock - reserved) / maximum * 100 + '%"></b></div></div>';
    return '<div class="primer-stock"><p class="stock-legend"><span>Резерв</span><span>Доступно</span></p>' +
      bar('Топливо', fuel, fuelHeld, 10) + bar('Пайки', rations, rationsHeld, 5) +
      '<p>Баланс — <strong>' + credits + ' кредитов</strong></p></div>';
  }

  window.mountPrimer = function mountPrimer(root, initialChapter = 0, singleChapter = false) {
    let chapter = initialChapter;
    let step = 0;
    let branch = 'ok';
    let playing = false;
    let timer;
    const stepDuration = 5200;
    let remaining = stepDuration;
    let deadline = 0;
    const movement = matchMedia('(prefers-reduced-motion: reduce)');
    let jsonDraft = '{ "action": "start" }';

    root.innerHTML = '<article class="panel primer">' + (singleChapter ? '' : '<div class="section-heading"><div><p class="kicker">Подготовка к маршруту</p>' +
      '<h2>Как устроен прототип API</h2></div><a class="button" href="' +
      (root.hasAttribute('data-standalone-primer') ? 'student-guide.html' : '#map') + '">' +
      (root.hasAttribute('data-standalone-primer') ? 'К заданию' : 'К карте') + '</a></div>' +
      '<p>Разбор привязан к практической работе. После каждого примера указано, что перенести в код или рабочий лист.</p>' +
      '<details class="station-explanation"><summary>Выбрать тему разбора</summary><nav class="primer-tabs" aria-label="Темы тренажёра">' + slides.map((item, index) =>
        '<button class="button" data-chapter="' + index + '">' + (index + 1) + '. ' + escape(item.title) + '</button>').join('') +
      '</nav></details>') + '<h3 id="primer-title"></h3><p id="primer-intro"></p><p id="primer-purpose" class="note"></p>' +
      '<div id="primer-variants" class="actions"></div>' +
      '<div class="primer-visual" id="primer-frame"></div><div id="primer-json"></div>' +
      '<div class="actions primer-controls"><button class="button" data-player="previous">Назад</button>' +
      '<button class="button primary" data-player="next">Далее</button>' +
      '<button class="text-button" data-player="play">Автопоказ</button>' +
      '<button class="text-button" data-player="restart">Повторить с начала</button>' +
      '<span class="note" id="primer-step" role="status"></span></div></article>';
    const visual = root.querySelector('#primer-frame');
    const stepLabel = root.querySelector('#primer-step');
    const controls = root.querySelector('.primer-controls');

    const current = () => slides[chapter];
    const frames = () => branch === 'fail' && current().failure ? current().failure : current().frames;
    const last = () => frames().length - 1;
    function renderTabs() {
      root.querySelectorAll('[data-chapter]').forEach(item => item.setAttribute('aria-pressed', String(Number(item.dataset.chapter) === chapter)));
      root.querySelector('#primer-title').textContent = current().title;
      root.querySelector('#primer-intro').textContent = current().intro;
      root.querySelector('#primer-purpose').textContent = practiceNotes[chapter][0] + '. ' + practiceNotes[chapter][1];
      root.querySelector('#primer-variants').innerHTML = (current().variants ?? []).map(([key, label]) =>
        '<button class="button" data-branch="' + key + '" aria-pressed="' + (key === branch) + '">' + escape(label) + '</button>').join('');
    }

    function renderControls() {
      controls.querySelector('[data-player="previous"]').hidden = step === 0;
      controls.querySelector('[data-player="next"]').hidden = step === last();
      const play = controls.querySelector('[data-player="play"]');
      play.hidden = step === last() && !playing;
      play.textContent = playing ? 'Пауза' : 'Автопоказ';
      controls.querySelector('[data-player="restart"]').hidden = step !== last();
      stepLabel.textContent = 'Кадр ' + (step + 1) + ' из ' + frames().length;
    }

    function renderFrame() {
      const [heading, detail, snippet, values, special] = frames()[step];
      const active = special ?? (current().direct ? step : step - 1);
      visual.classList.remove('primer-paused');
      visual.innerHTML = '<ol class="primer-flow' + (current().structure ? ' primer-structure' : '') + '" aria-label="Схема">' +
        current().labels.map((label, index) => {
          const blocked = chapter === 5 && branch === 'fail' && step > 0 && [1, 2].includes(index);
          return '<li class="' + (index === active ? 'flow-active' : blocked ? 'flow-blocked' : '') + '"' +
            (index === active ? ' aria-current="step"' : '') + '>' + escape(label) + (blocked ? '<small>пропущен</small>' : '') + '</li>';
        }).join('') + '</ol>' +
        (current().structure ? '<p class="relation-strip"><code>Mission 1 → * Expedition</code> · ' +
          '<code>Expedition 1 → * ExpeditionSupply</code> · <code>Expedition 1 → * ExpeditionStatusEvent</code></p>' : '') +
        '<h3>' + escape(heading) + '</h3><p>' + escape(detail) + '</p>' +
        (values ? inventory(values) : '') + (snippet ? '<pre>' + escape(snippet) + '</pre>' : '');
      const practice = root.querySelector('#primer-json');
      practice.innerHTML = step !== last() ? '' : '<p class="primer-application"><strong>Что сделать в проекте.</strong> ' +
        escape(practiceNotes[chapter][2]) + '</p>' + (chapter === 2
        ? '<form class="primer-json"><label for="json-exercise">Тело POST для запуска E01</label>' +
          '<textarea id="json-exercise" rows="3" spellcheck="false">' + escape(jsonDraft) +
          '</textarea><button class="button primary" type="submit">Проверить JSON</button><p role="status" id="json-result"></p></form>' : '');
      renderControls();
    }

    function pause(keepTime = false) {
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
        if (keepTime) remaining = Math.max(0, deadline - performance.now());
      }
      if (!keepTime) remaining = stepDuration;
      playing = false;
      renderControls();
    }

    function schedule() {
      deadline = performance.now() + remaining;
      timer = setTimeout(() => {
        timer = undefined;
        remaining = stepDuration;
        step++;
        if (step === last()) playing = false;
        renderFrame();
        if (playing) schedule();
      }, remaining);
    }

    function handleClick(event) {
      const target = event.target.closest('button');
      if (!target || !root.contains(target)) return;
      if (target.dataset.chapter !== undefined) {
        pause();
        chapter = Number(target.dataset.chapter);
        step = 0;
        branch = 'ok';
        renderTabs();
        renderFrame();
        return;
      }
      if (target.dataset.branch) {
        pause();
        branch = target.dataset.branch;
        step = 0;
        renderTabs();
        root.querySelector('[data-branch="' + branch + '"]').focus();
        renderFrame();
        return;
      }
      switch (target.dataset.player) {
        case 'previous': pause(); step = Math.max(0, step - 1); renderFrame(); break;
        case 'next': pause(); step = Math.min(last(), step + 1); renderFrame(); break;
        case 'restart': pause(); step = 0; renderFrame(); break;
        case 'play':
          if (playing) {
            pause(true);
            visual.classList.add('primer-paused');
          } else if (step < last()) {
            playing = true;
            visual.classList.remove('primer-paused');
            schedule();
            renderControls();
          }
          break;
      }
    }

    function validateJson(event) {
      if (!event.target.matches('.primer-json')) return;
      event.preventDefault();
      const result = root.querySelector('#json-result');
      jsonDraft = root.querySelector('#json-exercise').value;
      try {
        const json = JSON.parse(jsonDraft);
        if (json === null || Array.isArray(json) || typeof json !== 'object' || typeof json.action !== 'string') {
          result.textContent = 'JSON читается. Обработчику нужен объект со строковым полем action, чтобы заполнить LaunchRequest.Action.';
        } else if (json.action !== 'launch') {
          result.textContent = 'Формат подходит. Команда запуска называется launch. Исправьте значение action, чтобы обработчик принял команду.';
        } else {
          result.textContent = 'Верно. Перенесите это тело в POST в requests.http. При отправке обработчик прочитает launch и проверит статус рейса.';
        }
      } catch {
        result.textContent = 'JSON не читается. Проверьте скобки, двойные кавычки и запятые.';
      }
    }

    const visibility = () => {
      if (document.hidden && playing) {
        pause(true);
        visual.classList.add('primer-paused');
      }
    };
    const rememberJson = event => {
      if (event.target.id === 'json-exercise') jsonDraft = event.target.value;
    };
    if (movement.matches) root.querySelector('[data-player="play"]').title = 'Показ без движения, со сменой смысловых шагов';
    root.addEventListener('click', handleClick);
    root.addEventListener('submit', validateJson);
    root.addEventListener('input', rememberJson);
    document.addEventListener('visibilitychange', visibility);
    renderTabs();
    renderFrame();
    return () => {
      clearTimeout(timer);
      root.removeEventListener('click', handleClick);
      root.removeEventListener('submit', validateJson);
      root.removeEventListener('input', rememberJson);
      document.removeEventListener('visibilitychange', visibility);
    };
  };

  const standalone = document.querySelector('[data-standalone-primer]');
  if (standalone) window.mountPrimer(standalone, location.hash === '#e01' ? 7 : 0);
})();
