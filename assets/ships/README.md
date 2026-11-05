# STARFALL Ship Asset Library

Каталог и просмотрщик кораблей живут здесь. Все пиратские модели, конфигурации и исходники выделены в [`assets/pirates/`](../pirates/README.md). У каждого корабля стабильный `id` и своя папка. Игра находит модели через `catalog.json`; пути к моделям в игровом коде не зашиваются.

## Просмотр

Один общий просмотрщик для всех GLB: `viewer.html?ship=<id>` (без параметра открывается `activeShip` из каталога). Он показывает модель с видами, светом, каркасом и осями и делает проверку: бюджет треугольников, размер текстур и файла, ориентацию, центр. Красные пункты исправляем до коммита.

Корабль без GLB (процедурный) показывает ссылку на свой старый просмотрщик.

## ТЗ для исполнителя

Технические требования к GLB из Blender (оси, масштаб, топология, материалы, текстуры, экспорт, проверка; без дизайна): [BLENDER_GLB_SPEC.md](./BLENDER_GLB_SPEC.md).

## Структура

```
assets/ships/
  catalog.json                      реестр: id → папка, статус
  viewer.html                       общий просмотрщик GLB
  _template/config.json             шаблон паспорта
  transports/cargo_spaceship_001/
    model.glb                       Cargo Spaceship
    config.json                     паспорт гражданского транспорта
  <фракция>/<id>/
    model.glb                       модель (главный файл)
    config.json                     паспорт (по шаблону)
    README.md                       заметки: замысел, статус
    preview.png                     (по желанию) превью для каталога
```

Новый корабль: папка с `id` вида `фракция_класс_NNN`, `model.glb`, `config.json` из шаблона, запись в `catalog.json` со `status: "glb"`.

## Поля `config.json` (schemaVersion 2)

| Поле | Смысл |
|---|---|
| `model` | путь к GLB относительно папки корабля |
| `status` | `procedural_viewer` → `glb` → `integrated` |
| `replaces` | какой корабль игры заменяет: `{kind: "player", index: 3}` (индекс в `SHIPS`), `{kind: "pirate", index: 1}` (тип `ty`), `boss`, `transport` |
| `scale` | множитель масштаба при подключении в игру |
| `budget.triangles` | лимит треугольников (по умолчанию 9000) |

## Требования к GLB (кратко)

Полные требования в [BLENDER_GLB_SPEC.md](./BLENDER_GLB_SPEC.md). Главное: формат `.glb`, 1 ед. Blender = 1 м, **нос по +Y Blender (−Z в GLB)**, верх +Z Blender (+Y в GLB), начало координат в центре, применённые Transforms; до 9 000 треугольников, до 3 материалов, текстуры до 2048 px (ORM: R/G/B = AO/Rough/Metal), файл до 5 МБ. Дизайн корабля не регламентируется.

## Подключение в игру

Все пиратские GLB хранятся в `assets/pirates/ships/pirate/`. Общие каталог `catalog.json` и просмотрщик `viewer.html` остаются здесь; ссылки на пиратские модели ведут в отдельную ветку ресурсов. Игровой загрузчик использует эти пути с сохранением процедурных fallback-моделей.

## Корабли

- `assets/pirates/ships/pirate/pirate_fighter_001/` — TIE-пират «Шакал» (тип 1).
- `assets/pirates/ships/pirate/pirate_fighter_002/` — «Ржавый череп» (тип 0).
- `assets/pirates/ships/pirate/pirate_fighter_003/` — TIE Raider (тип 2).
- `assets/pirates/ships/pirate/pirate_transport_001/` — Millennium Falcon (нейтральный трафик).


## Гражданский транспорт

- `assets/ships/transports/cargo_spaceship_001/model.glb` — Cargo Spaceship. Зарегистрирован в `catalog.json`, загружается в обычный нейтральный грузовой трафик и используется как грузовой корабль караванов.
- `assets/pirates/ships/pirate/pirate_transport_001/` — отдельный пиратский Millennium Falcon.
