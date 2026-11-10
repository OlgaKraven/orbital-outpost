# Эталон первой практики E01

Из каталога launch-reference выполнить `dotnet run --no-launch-profile --urls http://localhost:5201`. В браузере или файле .http открыть GET /api/game. Затем дважды отправить POST /api/expeditions/E01/transitions с JSON {"action":"launch"}. Первый вызов даёт 200 и 4/3, второй 409. Данные хранятся в памяти.

Остановить сервер и выполнить `dotnet run --no-launch-profile --urls http://localhost:5201 --LaunchTransfer true`. Каталог меняется с 7/3 на 8/4. Принятые условия 6/2 и результат 4/3 сохраняются. Студенческий вариант лежит в first-api внутри student-kit.zip.
