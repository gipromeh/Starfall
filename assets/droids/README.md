# STARFALL Droid Library

Единый каталог дроидов и автономных боевых платформ. Корневой каталог `Droids/` удалён; все новые и существующие дроиды размещаются здесь.

## Структура

```
assets/droids/
  index.html
  <faction>/
    <droid_id>/
      model.glb или index.html   # модель либо автономный viewer
      config.json                # параметры и метаданные
      README.md
      textures/
      animations/
      preview.png
```

Текущие группы: `empire/`, `pirate/`. Просмотр каталога: [index.html](index.html). Каждая модель получает постоянный ID; пути к ресурсам должны быть относительными и не зависеть от старого `Droids/`.
