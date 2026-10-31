# STARFALL v86 — интеграция решений в базу v85

## База
Корневой `STARFALL_CURRENT.html` из `gipromeh/Starfall`, meta version `v85`, Three.js r128. Имя основного файла сохранено.

## Реализовано
- Встроен pure tactical decision layer для основных противников E/E2: APPROACH, PURSUE, ATTACK, EVADE, BREAK, FLEE, DISENGAGE.
- Добавлены threat scoring, относительная кинематика входящих homing missiles, выбор escape/lateral vectors, hysteresis, break exit envelopes и retreat при критическом HP.
- AI формирует desired direction, throttle и weapon intents. Существующий movement integrator E/E2 сохранён: ограничение поворота, smoothing speed 1.2*dt, acceleration cap, velocity update и position integration.
- Перенесён баланс type 0: speed multiplier 1.12, turn coefficient 1.00, steering acceleration 48, initial speed 20; профиль AI: throttle 1.10, maneuverability 0.90, orbit 0.30.
- Добавлены неоновые надписи и светящиеся полосы только на type 0.
- Радар: 500 м / 1 км / 2 км, подписанные кольца, символы классов и типов контактов, высота, векторы движения, выделение цели, off-range стрелки; сбор контактов отделён от отрисовки.
- Сохранён отдельный сценарий группового налёта `pirateFleet`; он не переводился на новый тактический FSM.
- Meta version обновлён до v86; имя `STARFALL_CURRENT.html` сохранено.

## Проверки
- Все 3 inline JavaScript-блока прошли синтаксический разбор в V8.
- Pure AI module: проверены входящая/удаляющаяся ракета, ATTACK + laser intent, EVADE, BREAK, FLEE и missile-carrier intent.
- Структурные проверки: сохранён movement integrator E/E2 и движение игрока; проверены три диапазона радара, все три надписи, область применения ливреи type 0 и отсутствие старой ошибки с `nk` как входящей ракетой.
- Реальный запуск игры в Chromium/PC и Safari/iPhone в рамках этой интеграции не выполнен. Требуется визуальная проверка положения decal-панелей на GLB и боевого поведения в браузере.
