# STARFALL CI policy

## Цель

CI — автоматический контроль качества перед попаданием изменений в `main`. Полный набор проверок должен выполняться на каждом Pull Request в `main` и на каждом push в `main`.

## Конвейер

Workflow: `.github/workflows/game-tests.yml`.

1. **quick-checks** — быстрые проверки без запуска браузера:
   - `node --check` для каждого встроенного JavaScript-блока `STARFALL_CURRENT.html` (извлечение HTMLParser, проверка синтаксиса Node.js);
   - `tests/t12_ai_lab.js` — архитектурные регрессии AI Lab;
   - `tests/t14_radar_collision_regression.js` — статические проверки радара, столкновений и боевой механики.
2. **prepare-browser** — один раз устанавливает тестовые зависимости и прогревает общий npm/Chromium/WebKit cache.
3. **browser-tests** — запускаются только после успешных `quick-checks` и `prepare-browser`; каждый сценарий выполняется в отдельной matrix job:
   - `tests/t13_ai_lab_browser.js` — браузерный smoke test;
   - `tests/t8_nuke.js` — производительность ядерного удара;
   - `tests/t6_probe.js` — графические ресурсы и очистка объектов;
   - `tests/t11_pirate_fleet.js` — регрессии пиратской эскадрильи, Elite-inspired AI tick (15 Гц), локальных проекций, PRNG и покадрового движения;
   - `tests/t1_saves.js` — SAVE 2.0: покупки, reload, два слота, повреждение данных, миграция, резерв, localStorage недоступен;
   - `tests/t5_leak.js` — регрессия утечек в бою и проверка профилей качества;
   - `tests/t7_iphone.js` — мобильный профиль и геометрия сенсорных кнопок в Chromium;
   - `tests/t15_iphone_webkit.js` — WebKit с iPhone UA/viewport/touch: WebGL, мобильные кнопки, pointer input и resize. Это WebKit Linux, не реальный iOS Safari.
4. **passport-check** — отдельный workflow проверяет SHA паспорта и совместное обновление игры, паспорта и CHANGELOG.

## Кэширование

- npm cache: `~/.npm`, ключ привязан к ОС, Node.js и закреплённым версиям зависимостей.
- Playwright browser cache: `~/.cache/ms-playwright`, ключ привязан к ОС и версии Playwright; включает бинарники Chromium и WebKit. Системные библиотеки WebKit устанавливаются в самом `iphone-webkit` runner, поскольку apt-пакеты между jobs не кэшируются.
- Chromium и WebKit скачиваются только при cache miss. На cache hit повторная загрузка браузеров пропускается; WebKit runtime dependencies устанавливаются отдельно в job, которая запускает WebKit.
- Зависимости тестов закреплены точными версиями в workflow. Не обновлять их автоматически без отдельной проверки.

## Повторные запуски

- Новые коммиты отменяют устаревшие запуски той же ветки через workflow concurrency.
- Browser tests изолированы по отдельным matrix jobs. Для исправления одного упавшего сценария использовать **Re-run failed jobs**, а не **Re-run all jobs**: успешно прошедшие matrix jobs не запускаются повторно.
- Новый commit запускает полный набор заново: тесты должны подтверждать именно актуальный SHA, а не предыдущую ревизию.
- Не отключать и не ослаблять упавший тест только ради зелёного статуса. Сначала установить причину и исправить дефект либо обоснованно актуализировать спецификацию и тест.

## Gate перед слиянием в main

Для каждого PR в `main` должны завершиться успешно:

- `passport-check / check`;
- `game-tests / quick-checks`;
- `game-tests / prepare-browser`;
- `game-tests / browser-tests (ai-lab-browser)`;
- `game-tests / browser-tests (nuclear-performance)`;
- `game-tests / browser-tests (graphics-probe)`;
- `game-tests / browser-tests (pirate-fleet)`;
- `game-tests / browser-tests (saves-regression)`;
- `game-tests / browser-tests (performance-leak)`;
- `game-tests / browser-tests (iphone-chromium)`;
- `game-tests / browser-tests (iphone-webkit)`.

`ci-metrics` — диагностическая job; она не заменяет тесты и не должна быть обязательным gate.

**Важно:** запуск полного набора на PR настроен в workflow. Запрет ручного слияния при красных проверках дополнительно обеспечивается GitHub Ruleset / branch protection для `main`. В настройках репозитория необходимо включить Require status checks to pass before merging и добавить перечисленные выше checks. Текущая GitHub-интеграция позволяет обновлять файлы и запускать workflow, но не предоставляет API-действия для изменения branch protection; поэтому этот административный переключатель нужно включить в GitHub Settings вручную.

## Статистика

После каждого запуска `ci-metrics` публикует:

- сводку времени по job и каждому шагу в GitHub Actions Job Summary;
- статус job и список упавших шагов;
- машинно-читаемый `ci-metrics.json` как artifact с хранением 90 дней.

Сравнивать длительности следует по одинаковым типам runner и с учётом cache hit/miss. Время job — это runner time; суммарное время jobs может превышать календарную длительность workflow из-за параллельного выполнения.

## Ручные проверки

Зелёный CI подтверждает автоматические сценарии на Ubuntu/Chromium и WebKit. WebKit под Linux с мобильными viewport/UA/touch не эквивалентен Safari на iOS: он не воспроизводит iOS GPU-драйвер, энергосбережение, системные ограничения памяти и поведение вкладки при блокировке экрана. Он не заменяет проверку реального iPhone, GPU/FPS, нагрева, длительной сессии и сохранения после выгрузки приложения.
