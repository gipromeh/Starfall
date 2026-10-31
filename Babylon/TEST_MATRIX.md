# Babylon parity & QA test matrix

Статусы: `NOT RUN`, `PASS`, `FAIL`, `BLOCKED`. Нельзя ставить PASS по статическому поиску кода, если критерий требует runtime/browser/device.

## A. Bootstrap и жизненный цикл

| ID | Проверка | Критерий |
|---|---|---|
| A01 | Холодный запуск | Engine, scene, camera и HUD стартуют без console errors |
| A02 | Ошибка CDN/asset | Понятная ошибка и контролируемый fallback; нет зависания |
| A03 | Resize/orientation | Canvas и HUD корректно пересчитываются |
| A04 | WebGL context lost/restored | Сцена восстанавливается или показывает recovery UI |
| A05 | Pause/resume/visibility | Симуляция не скачет по delta после возврата |

## B. Saves и progression

| ID | Проверка | Критерий |
|---|---|---|
| B01 | SAVE 2.0 sf_sv2a | Загрузка без потери данных |
| B02 | SAVE 2.0 sf_sv2b fallback | Восстановление при повреждении основного |
| B03 | Legacy sf_sv | Миграция старого прогресса |
| B04 | Повреждённый JSON | Без аварии; резерв/безопасное состояние |
| B05 | Покупка/продажа | Кредиты, собственность, оборудование и груз сохраняются |
| B06 | Награда/контракт | Немедленное сохранение критических событий |
| B07 | Новая игра | Архив предыдущего прогресса и подтверждение |

## C. World, economy, traffic

| ID | Проверка | Критерий |
|---|---|---|
| C01 | Пять систем | Состав и доступность совпадают с v85 |
| C02 | Рыночные цены | Технологический уровень и события влияют на цену как в baseline |
| C03 | Buy/sell | Средняя закупочная стоимость, прибыль/убыток и груз корректны |
| C04 | Караваны | Периодический spawn/despawn и маршруты без pop-in |
| C05 | Туристы | Все три класса: approach → orbit → departure |
| C06 | Off-screen traffic | Потери транспорта во время стыковки/удаления моделируются корректно |
| C07 | Reputation | Нарушения и помощь меняют репутацию/безопасность/экономику |

## D. Stations, dialogue, narrative

| ID | Проверка | Критерий |
|---|---|---|
| D01 | Dock/undock | Состояние мира сохраняется при стыковке |
| D02 | Station services | Торговля, ремонт, заправка, верфь, оружейная и склад доступны |
| D03 | Zорг | Исходные диалоги, условия и задания |
| D04 | Векса | Исходные диалоги, охотничьи контракты и прогресс |
| D05 | Шшиила | Слухи/рыночная информация и системные сведения |
| D06 | Брук | Ремонт и снабжение |
| D07 | Narrative chains | Условия, ветви, исходы и последствия сохраняются после reload |

## E. Flight and combat

| ID | Проверка | Критерий |
|---|---|---|
| E01 | Flight controls | Все исходные PC и touch bindings сохранены |
| E02 | Inertia | Поворот не телепортирует вектор скорости |
| E03 | Pirate formation | Четыре роли 1+1+1+1 одновременно |
| E04 | Avoidance | Нет сквозных столкновений/схлопывания/зависания |
| E05 | Lasers | Попадание по swept trajectory и габаритам модели |
| E06 | Missiles | Инерционное наведение, уклонение и перехват |
| E07 | Damage | Локальные очаги на поверхности модели |
| E08 | Death/reward | Уничтожение, дроп, кредиты, репутация и контрактный прогресс |
| E09 | Boss | Фазы, телеграфирование атак и награды |
| E10 | Long session | Длительный бой без зависаний и утечек |

## F. Deep Space

| ID | Проверка | Критерий |
|---|---|---|
| F01 | Signal cadence | Сигнал/активность не реже 90–120 секунд в глубоком космосе |
| F02 | Event cadence | Значимая цепочка раз в 5–10 минут активного исследования |
| F03 | No pop-in | Объект существует до обнаружения игроком |
| F04 | Chain outcomes | Минимум два исхода и последствия игнорирования |
| F05 | Save/load | Сигналы, NPC-маршруты и цепочки восстанавливаются |

## G. iPhone Safari and performance

| ID | Проверка | Критерий |
|---|---|---|
| G01 | Touch UI | Кнопки доступны, не конфликтуют с системными жестами |
| G02 | Safe areas | HUD не перекрывает Dynamic Island/home indicator |
| G03 | Frame pacing | Цель 60 FPS; фиксировать p50/p95 frame time |
| G04 | Thermal | 30-минутная сессия, нет критического throttling |
| G05 | Memory | Нет монотонного роста памяти после повторных боёв/стыковок |
| G06 | Adaptive quality | Low/Medium/High реально меняют нагрузку |
| G07 | Background/resume | Пауза, аудио unlock и восстановление после возврата |
| G08 | Context loss | Потеря/восстановление WebGL не разрушает сохранение |

## H. Desktop Chromium

Проверить полный сценарий на desktop Chromium с клавиатурой/мышью, включая разрешения 1080p и ultrawide, длительную сессию, resize, WebGL context recovery и все основные игровые циклы.

## Device report

Для каждого реального iPhone прогона фиксировать модель/SoC, iOS, Safari build, качество, разрешение, длительность, средний FPS, p95 frame time, пиковую память (если доступна), нагрев/thermal state, ошибки консоли и сценарий. Эмуляция Playwright не заменяет физическое устройство.

## Приёмка

- Никакая критическая категория A–G не может иметь FAIL или BLOCKED при production promotion.
- Все отклонения от v85 должны быть согласованы и описаны.
- Синтаксис и unit tests — только часть проверки, не доказательство parity.
- Реальный iPhone Safari report обязателен перед production promotion.


## B1 Chromium verification — 2026-10-31

**PASS — 5/5 Playwright tests**

CI workflow: `Babylon Chromium QA`, run [41219584789](https://github.com/gipromeh/Starfall/actions/runs/41219584789).

| Check | Result | Evidence |
|---|---|---|
| Babylon bootstrap / WebGL canvas | PASS | Chromium boots engine, scene and HUD; no page errors |
| Player initial forward vector | PASS | World-space forward points toward target lane after launch |
| Pirate GLB asset | PASS | Existing v85 droid GLB loads and static geometry is batched by material |
| Flight input | PASS | W thrust increases inertial velocity |
| Combat damage / death / reward / respawn | PASS | Target health reaches zero, +250 CR, target returns at full health |
| Homing missile | PASS | Projectile reaches target and reduces target hull |
| Mobile HUD | PASS | Touch joystick and FIRE/MISSILE controls are visible at 390×844 |

This is a bounded B1 vertical-slice result, not a PASS for the full parity matrix above. Laser hit testing, all original control bindings, economy, traffic, dialogue, all five systems, long-session stability, WebGL recovery and physical iPhone Safari remain NOT RUN.

The CI browser uses SwiftShader software rendering. Its FPS is not accepted as a hardware performance measurement; a desktop GPU and physical iPhone report are still required for performance sign-off.
