## 2026-11-02 — SAVE regression: исправление сценария 11 и диагностика этапов
- Run 41354157146 завершился FAIL, а не зависанием. Логи подтверждают PASS сценариев 1–10; сценарий 11 завершился TimeoutError при ожидании state=over.
- Установленная причина: сценарий 10 восстанавливает state=play для проверки немедленного сохранения на visibilitychange. Сценарий 11 не инициировал новую гибель, но ожидал уже существующий state=over.
- Решение: явно установить state=dying и dyT=0.15, дождаться штатного перехода в over и нажать кнопку #men2 экрана поражения.
- Диагностика: stage() вызывается перед запуском браузера и перед каждым блоком теста 1–12; watchdog 12 минут сообщает активный этап и его длительность.
- Область: tests/t1_saves.js, STARFALL_PASSPORT.md, CHANGELOG.md, docs/DECISION_LOG.md. Игровой HTML и SAVE runtime не меняются.
- Критерии приёмки: saves-regression завершается без FAIL/CRASH; stage-маркеры видны в Actions log; остальные browser matrix jobs зелёные.
- Статус: IMPLEMENTED; CI PENDING.

## 2026-11-02 — SAVE regression: CI root-cause findings and test correction
- Полный журнал run 41352765822 доказал, что сценарий 9 не зависает: игра переходит в dock, SV.info() показывает persist=false, ошибок страницы нет; обе проверки восстановления из памяти проходят.
- Сценарий 10 имел ложный критерий: после паузы 2,5 с проверял сохранённый hull, но периодический autosave может сохранить полный снимок при изменении других полей. Новый критерий проверяет синхронное отсутствие записи непосредственно после изменения только hull.
- Сценарий 11 искусственно переводил игру в dying, затем ждал 7 с: штатный цикл переводил её в over и показывал полноэкранный overlay. Клик по #men1 блокировался overlay; теперь используется штатная #men2.
- В тест добавлены тайминги этапов и watchdog на 12 минут, выводящий имя этапа и завершающий процесс с кодом 124.
- Область изменений: только tests/t1_saves.js и документация; STARFALL_CURRENT.html и SAVE runtime не менялись.
- Критерии приёмки: полный saves-regression завершается без FAIL/CRASH; все browser matrix jobs остаются зелёными; длительности этапов видны в логе.
- Статус: исправления теста внесены, CI-верификация ожидается.

# STARFALL — Decision Log

## 2026-11-02 — SAVE regression: diagnose storage-denied startup
- Повторный CI опроверг предыдущую гипотезу: `noWaitAfter` устранил только 30-секундное ожидание навигации; после клика игра всё ещё не достигает `state === "dock"` за 10 секунд.
- Следующий запуск теста фиксирует состояние игры, `SV.info()`, видимость меню/станции, ошибки страницы и последний dialog сразу после клика. Это диагностическая правка теста, не исправление игрового поведения.
- Сценарии 1–8 проходят; сценарий 9 остаётся блокирующим. SAVE v3 не объявляется проверенным для браузера с запрещённым `localStorage`.
- Статус: причина startup failure ещё не установлена; диагностика ожидает CI.


## 2026-11-02 — SAVE regression: storage-denied browser click
- Полный лог CI показал, что сценарии 1–8 проходят. Падение происходит в сценарии 9 после успешного клика по `#play`: Playwright ждёт завершения навигации (`page.click` timeout 30 s), хотя тесту требуется дождаться перехода игрового state в `dock`.
- Для клика в контексте с заблокированным `localStorage` отключено ожидание навигации (`noWaitAfter: true`); отдельно оставлено явное ожидание `state === 'dock'` с тайм-аутом 10 s.
- Игровой код и механизм SAVE не менялись. Повторный CI обязателен.
- Статус: исправление тестового ожидания внесено, не верифицировано.


## 2026-11-01 — Restore and publish the v90 release candidate
- User explicitly requested publication of v90 after the temporary v91 replacement.
- Restored `STARFALL_CURRENT.html` byte-for-byte from commit `35632d263ddec37702b0989d252f7b7d3b90260c`, the v90 candidate containing the OCS controller and Deep Space simulation.
- Restored the v90 passport version and checksum; removed the temporary v91 status from current release documentation. The v91 replacement remains in Git history.
- Publication gate: passport CI and the complete game-tests workflow must pass before merging PR #13 into `main`.
- Status: RESTORED; publication pending CI.


## 2026-11-01 — Explicit replacement of the production HTML baseline
- User explicitly selected the uploaded `STARFALL — Void Hunter.html` as a full replacement for `STARFALL_CURRENT.html`.
- The exported outer wrapper was stripped; the inner standalone HTML document was committed as the game entry file.
- This intentionally replaces the previous v90 implementation. Historical v89/v90 passport and research notes remain archival and must not be interpreted as proof that those systems exist in the replacement build.
- Local validation: all inline JavaScript blocks passed `node --check`. CI, gameplay regression, SAVE migration/compatibility, and physical iPhone Safari validation are pending.
- Status: IMPLEMENTED, NOT VERIFIED.


Canonical record of durable gameplay, architecture, UI and workflow decisions. New entries are appended at the top. Statuses distinguish an accepted design decision from a verified implementation.

## 2026-11-01 — Elite OCS controller integration (implementation pending CI)
- Decision: use one shared OCS-style tactical controller for ordinary E/E2 pirates and the opening pirate fleet; preserve per-ship balance, weapons, HP, collision and SAVE behavior.
- Decision: tactical decisions run at 15 Hz with per-frame orientation/velocity/position integration; slot phase offsets stagger decision ticks.
- Decision: derive steering commands from normalized target vectors projected onto local OCS axes; keep discrete yaw/pitch/acceleration commands and gate NPC fire by orientation, range and seeded PRNG.
- Implemented in STARFALL_CURRENT.html commit b4c096a; acceptance tests added in tests/t11_pirate_fleet.js commits f26d375 and da87fa9.
- Status: NOT ACCEPTED AS COMPLETE. Browser CI for head da87fa9 is pending; exact Elite byte-level controller is not claimed; browser regression and balance review remain required.

## 2026-11-01 — Scanner HUD placement
- Decision: the СКАНЕР opener belongs in the upper-right safe area; the circular radar retains the lower-left area.
- Decision: change placement only; preserve scanner panel behavior and controls.
- Implemented in STARFALL_CURRENT.html commit 59fbf0e; regression updated in tests/t16_deep_space.js commit 1a1a310.
- Status: quick/static checks passed on the preceding run; browser verification was pending at the time.

## Permanent project rules
- GitHub repository gipromeh/Starfall is the canonical project record. A decision is not safely captured until committed to the repository.
- Every game-code change must update STARFALL_PASSPORT.md and CHANGELOG.md in the same work sequence; update research mapping documents when algorithmic claims change.
- Record decisions with rationale, scope, constraints, acceptance criteria and status (proposed, implemented, verified, rejected); never label untested work as verified.
- Keep `main` unchanged. Do not merge a PR unless the user explicitly authorizes that specific merge, even after all required CI checks pass.


## 2026-11-02 — First-wave pirate detection and Elite-style radar (scope correction)
- The opening intercept is `pirateFleet` (Golovoroz + Jackal); regular E/E2 appear after the opening squadron is cleared. The earlier note that the opening pair was E/E2 and needed a spawn at 850 was incorrect and is superseded.
- Decision: preserve the fleet's 760/850 longitudinal spawn positions, widen its lateral formation to ±115, and display R/J hostile contacts from entity creation through warp-in.
- Preserve the Elite Dangerous scanner contract: heading-relative circular plane, rotating sweep, altitude stalks, amber palette, 500 m / 1 km / 2 km ranges, velocity vectors and hostile edge indicators.
- Actual opening attack geometry and its OCS fire-gate constraint are specified in the later 2026-11-02 anti-collision maneuver entry.


## 2026-11-02 — Jackal first-wave firing geometry
- Observation: the first-wave Jackal could perform an approach/overshoot without firing. The target pass offset (185 units) was incompatible with both the 0.25 rad firing lane and `EAI.fireGate`'s centered OCS gate at the 380-unit weapon range.
- Decision: reduce E/E2 pass offsets to `[55,70,45,80]` by ship type. Preserve speed, turn coefficients, HP, weapon range, damage and AI decision cadence.
- Acceptance: integration regression runs production `upd()` with a type-1 Jackal at 360 units and observes at least two actual laser projectiles. Status: implemented; awaiting CI.


## 2026-11-02 — First-wave attack must not be a head-on collision
- Corrected the scope: the opening interception is `pirateFleet` (Golovoroz + Jackal); regular E/E2 are later waves and must not be conflated with the opening squadron.
- Root cause in the attack geometry: slot side values are ±0.5 and were multiplied directly into route offsets of 30–100 units, reducing the lateral displacement to roughly 15–50 units. The opening headings were initially aimed directly at the player, and the attack waypoint did not create a meaningful safe pass lane.
- Decision: normalize the slot side to ±1 and define explicit lateral waypoints for APPROACH, ATTACK_RUN, FIRING_PASS, OVERSHOOT and REPOSITION. Keep OCS steering, firing gates, weapon sockets, speed/acceleration model and HP/damage unchanged.
- Decision: radar contact collection includes the opening fleet during warp-in and labels it R/J. Do not change ordinary E/E2 spawn geometry as part of this fix.
- Acceptance: a natural 60-second Jackal simulation must traverse ATTACK_RUN → FIRING_PASS → OVERSHOOT → REPOSITION, maintain 80–180 units minimum separation and at least 80 units lateral offset. Browser CI pending; values are initial engineering targets subject to observed simulation output.

- Fire-gate constraint: the firing-pass lateral offset is 100 units, not 220. This keeps the pirate inside the existing centered OCS projection gate while still producing a non-collision side pass; overshoot/reposition then open the separation.


## 2026-11-02 — Radar must support target acquisition and interception
- Decision: radar is an active tactical instrument, not a passive contact display. The player can select a hostile contact directly on the scanner by touch/click.
- Selection is persistent while the entity exists; when it is destroyed or removed, acquire the nearest remaining hostile contact.
- Show range, signed azimuth/bearing (left/right), signed elevation (above/below), and relative closing speed. These are computed from the target's world position/velocity transformed into player-local coordinates.
- Mirror the selected target on the main HUD: place a cue on its screen projection when visible; otherwise clamp a directional arrow to the screen edge.
- Do not add automatic steering. The player retains manual control and uses the bearing/elevation readout to establish an intercept course. Keep H distance-follow behavior separate.
- Acceptance: browser regression checks scanner selection, target persistence/fallback, bearing/elevation/closure readouts, and HUD cue; mobile and desktop usability still require manual playtest.


## 2026-11-02 — Restore the original Elite ZX Spectrum scanner model
- Reference distinction: the target is the ZX Spectrum 48K/128K Elite scanner, not Elite Dangerous' rotating circular radar. The ZX Spectrum HUD uses a shallow elliptical 3D scanner with ship contacts represented by a notch/dot and a vertical stalk showing relative altitude; the separate compass indicates planet/station direction and uses a hollow marker for a target behind the ship.
- Decision: replace the circular sweep radar with an ellipse. In player-local coordinates `(x,y,z)`, project `x` horizontally, `z` onto the ellipse plane, and `y` into the stalk height. Clip contact coordinates to a fixed STARFALL range of 1600 units per local axis.
- Decision: remove rotating sweep, circular range rings, out-of-range arrows and velocity vectors. Keep STARFALL's tap-to-select hostile contact, target HUD and screen cue as additive gameplay affordances.
- Decision: compass targets the planet by default, switches to the station inside 900 units, shows hollow when behind, and lights `S` inside 420 units. These are STARFALL adaptation thresholds, not claimed original Elite constants.
- Source: `https://elite.bbcelite.com/deep_dives/the_3d_scanner.html` (scanner projection and stick math); ZX Spectrum manual summary `https://viva-games.ru/game/elite?setlang=es` (3D scanner, compass and hollow marker semantics); screenshot reference `https://www.thirdharmoniser.com/elite.html`.
- Status: IMPLEMENTED; static checks pass; browser CI and visual validation pending.

- Attack acceptance now includes actual firing during the natural side-pass: test seeds the fire-gate PRNG to its deterministic success path and requires at least two shots while preserving the normal OCS gates and burst mechanism.

- Compass projection refinement: map local X/Y onto the compass disc using the full 3D direction length; use local Z only to choose filled (ahead) versus hollow (behind). This preserves elevation information instead of treating the compass as a top-down X/Z plot.


## 2026-11-02 — Memory-leak test isolation
- The leak regression must measure retained resources after all combat entities are removed, not count a surviving second enemy slot as a leak.
- After its eight spawn/kill rounds, the test now kills both E and E2, clears the slots, freezes enemy/traffic spawn timers while keeping the update loop in play state, then advances 40 seconds to drain debris/aliens before comparing renderer memory.
- This is a test isolation correction; it does not alter runtime enemy spawning or cleanup behavior.
