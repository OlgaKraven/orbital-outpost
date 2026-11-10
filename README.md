# Орбитальный форпост

Учебный квест и рабочий прототип данных на ASP.NET Core Minimal API (.NET 10), SQLite и статическом интерфейсе. Все данные учебные. Сервер рассчитан на локальное использование.

[Открыть тренажёр в браузере](https://olgakraven.github.io/orbital-outpost/). На GitHub Pages работают учебная модель E01 с каталогами 7/3 и 8/4, разбор API, рабочие листы и карта лабораторных. Для реальных HTTP-запросов и сценариев с SQLite запустите приложение по инструкции ниже.

## Запуск исходного проекта

Из каталога с OrbitalOutpost.csproj:

```powershell
dotnet restore
dotnet run --no-launch-profile --urls http://127.0.0.1:5191
```

Открыть http://127.0.0.1:5191. Остановить сервер через Ctrl+C. Готовая сборка запускается через Start-Outpost.cmd из корня архива. Для неё нужен ASP.NET Core Runtime 10 или SDK 10. При занятом порте передать свободный номер, например Start-Outpost.cmd 5193.

## Карта исходников

| Файл | Назначение |
| --- | --- |
| Program.cs | Минимальные HTTP-маршруты, привязка DTO и ответы |
| Models.cs | Входные и выходные типы, предметные ошибки |
| GameStore.cs | Чтение, транзакции и переходы экспедиций |
| data/schema.sql | Схема SQLite и ограничения |
| data/seed.json | Стартовый набор |
| data/scenarios.json | Исходные наборы, включая перенос E01, и редакция каталога |
| wwwroot/course.js | Бриф, артефакты и задания восьми станций |
| wwwroot/reference.js | Визуализация артефактов и расчёт матрицы |
| wwwroot/app.js | Квест, симулятор и журнал HTTP |
| wwwroot/primer.js | Интерактивный разбор API, HTTP, JSON, модели данных и транзакций |
| wwwroot/case.js и study.js | Сквозная ситуация и рабочие листы по карте |
| wwwroot/guide.html | Порядок самостоятельной реализации |
| checks/verify.mjs | Воспроизводимая приёмка через реальный HTTP |
| student/ | Заготовка студента и отдельная проверка его API |
| launch-reference/ | Рабочий эталон первой практики E01 с хранением в памяти |

## Проверка

Из каталога исходного проекта. Node.js 22+ нужен только для автоматической проверки и пересборки HTML-документов.

```powershell
dotnet publish -c Release -o run
node checks/verify.mjs run
```

Проверка запускает приложение на отдельном порту 5194 с временной базой. При необходимости задать свободный порт в OUTPOST_CHECK_PORT. Для пересборки учебных страниц выполнить `node tools/build-docs.mjs` из этого каталога.

GitHub Actions запускает сборку и проверку HTTP при обновлении `main` и в pull request к этой ветке. В той же проверке эталон E01 проходит оба варианта каталога, 7/3 и 8/4. Готовую сборку можно скачать в разделе **Artifacts** успешного запуска и запустить командой `dotnet OrbitalOutpost.dll --urls http://127.0.0.1:5191` из распакованного каталога. Для запуска нужен ASP.NET Core Runtime 10.

После проверки `main` тот же workflow публикует браузерную версию из `wwwroot`. Источник публикации в **Settings → Pages** — **GitHub Actions**.

Данные партий находятся в state/outpost.db под корнем приложения. Каждый запуск новой партии создаёт отдельный набор с новым идентификатором. Прогресс квеста и выбранная партия запоминаются браузером. Для отдельного проверочного файла передать `--GameDatabase путь-к-файлу`.

## API

Сначала POST /api/demo/games?scenario=briefing, затем передавать возвращённый id в заголовке X-Game-Id. Без scenario создаётся свободная партия. Для атомарной замены используется POST /api/expeditions/{id}/replacements с expectedCatalogRevision. Основной контракт описан в [пошаговом разборе](wwwroot/guide.html#http) и [OpenAPI](wwwroot/openapi.json).

## Запуск на отдельном сервере

Использовать опубликованный каталог run и установленный ASP.NET Core Runtime 10. Из каталога run выполнить `dotnet OrbitalOutpost.dll --urls http://127.0.0.1:5191 --GameDatabase /absolute/persistent/path/outpost.db`. Передать приложению каталог с правом записи и сохранять этот файл между запусками. Для выдачи через существующий сервер использовать проксирование на указанный локальный адрес. Учебные партии разделены по идентификатору, рабочие листы хранятся в браузере и выгружаются в JSON. Готовая сборка рассчитана на учебный показ в доверенной среде.

## Учебные источники

- [ЛР01–ЛР08 первого семестра ПиДИС](https://github.com/OlgaKraven/2026-PIDIS-lab/tree/main/content/course-3/semester-5)
- [ASP.NET Core Minimal APIs](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/minimal-apis?view=aspnetcore-10.0)
- [Транзакции Microsoft.Data.Sqlite](https://learn.microsoft.com/en-us/dotnet/standard/data/sqlite/transactions)
