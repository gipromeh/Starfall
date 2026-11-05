# STARFALL — Pirate Assets

Единая точка хранения ресурсов пиратской фракции: корабли, модели, конфигурации, исходники Blender, превью и сведения об авторстве.

## Структура

```
assets/pirates/
└── ships/pirate/
    ├── ATTRIBUTION.md
    ├── pirate_fighter_001/
    ├── pirate_fighter_002/
    ├── pirate_fighter_003/
    └── pirate_transport_001/
```

Каждый корабль имеет постоянный ID и собственную папку. Общий индекс всех кораблей и просмотрщик остаются в `assets/ships/catalog.json` и `assets/ships/viewer.html`.

| ID | Модель | Роль |
|---|---|---|
| `pirate_fighter_001` | «Шакал» | Истребитель, тип 1 |
| `pirate_fighter_002` | «Ржавый череп» | Истребитель, тип 0 |
| `pirate_fighter_003` | TIE Raider | Истребитель, тип 2 |
| `pirate_transport_001` | Millennium Falcon | Пиратский транспорт |

Исходные GLB перемещаются без изменения бинарного содержимого. При ошибке загрузки игра использует штатные процедурные модели.

Источники и лицензии: [ATTRIBUTION.md](ships/pirate/ATTRIBUTION.md). Модель транспорта помечена CC BY-NC-SA 4.0; коммерческое использование без отдельной проверки прав запрещено.
