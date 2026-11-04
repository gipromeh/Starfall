# STARFALL Planetary Assets

Ресурсы планетарной системы: планеты, спутники, звёзды, кольца, поверхности, карты высот, текстуры и превью.

## Рекомендуемая структура

```
planets/
  <system_id>/
    <body_id>/
      config.json
      README.md
      model.glb
      textures/
      preview.png
```

Процедурная геометрия и текстуры, генерируемые игровым кодом, не копируются сюда автоматически: каталог предназначен для самостоятельных исходных ресурсов. Сохраняйте единицы измерения, масштаб, систему координат и лицензионные сведения в `config.json`/`README.md`.


## Imported model inventory

The existing `purple_planet.glb` is retained. This asset batch did not add a new planet GLB; additional planetary bodies should be sourced as dedicated low-poly GLBs or generated from procedural PBR sphere materials. Do not repurpose spacecraft models as planets.
