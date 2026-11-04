# Space asset sources and licenses

Все импортированные модели получены из официального репозитория NASA 3D Resources:
- https://github.com/nasa/NASA-3D-Resources
- NASA repository README сообщает, что ресурсы бесплатны и не защищены авторским правом.
- NASA media guidance: https://www.nasa.gov/nasa-brand-center/images-and-media
- Не использовать эмблемы и логотипы NASA так, чтобы подразумевалась поддержка или одобрение игры NASA. Перед коммерческим релизом сверять индивидуальные credits и usage notes моделей.

## Импортированные GLB

| Локальный путь | Модель | Исходный путь |
|---|---|---|
| asteroids/1999_rq36/model.glb | 1999 RQ36 asteroid | 3D Models/1999 RQ36 asteroid/1999 RQ36 asteroid.glb |
| stations/iss_nasa/model.glb | International Space Station (ISS B) | 3D Models/International Space Station (ISS) (B)/International Space Station (ISS) (B).glb |
| stations/base_station_nasa/model.glb | Base Station | 3D Models/Base Station/Base Station.glb |
| ships/civilian/apollo_lunar_module/model.glb | Apollo Lunar Module | 3D Models/Apollo Lunar Module/Apollo Lunar Module.glb |
| ships/civilian/argo/model.glb | Argo | 3D Models/Argo/Argo.glb |
| ships/civilian/shuttle_payload/model.glb | Space Shuttle Payload | 3D Models/Space Shuttle Parts/Payload.glb |
| ships/civilian/tess_satellite/model.glb | TESS satellite | 3D Models/Transiting Exoplanet Survey Satellite (TESS) (A)/Transiting Exoplanet Survey Satellite (TESS) (A).glb |
| ships/civilian/near_shoemaker/model.glb | NEAR Shoemaker | 3D Models/NEAR Shoemaker/NEAR Shoemaker.glb |

Файлы GLB скопированы без изменения геометрии и текстур. Репозиторий NASA и исходные страницы моделей остаются первичным источником credits и условий использования.

## Статус и ограничения

- В проекте уже был assets/planets/purple_planet.glb; он сохранён.
- Argo, payload, TESS и NEAR можно использовать как основу гражданского трафика и эскортов. Черновая формация находится в convoys/civilian_caravan_001/.
- Apollo Lunar Module — посадочный модуль, не истребитель.
- ISS и Base Station — орбитальные станции.
- 1999 RQ36 — модель астероида.
- `ships/civilian/space_shuttle_b/model.glb` подключён к runtime как вариант гражданского трафика (freighter variant 0). GLB содержит 2 476 треугольников, 1 материал и не содержит текстур; модель нормализуется при загрузке, процедурный транспорт остаётся fallback.
- Остальные новые модели пока не подключены к runtime. Перед использованием проверить ориентацию, масштаб, материалы, число треугольников и стоимость на мобильном GPU.
- Отдельная модель галактики в этой подборке отсутствует. Для галактических фонов использовать equirectangular texture, skybox или shader; не выдавать геометрию туманности за модель галактики.
| ships/civilian/earth_observing_1/model.glb | Earth Observing-1 (EO-1) | 3D Models/Earth Observing-1 (EO-1)/Earth Observing-1 (EO-1).glb |
| ships/civilian/geostationary_satellite/model.glb | Geostationary Operational Environmental Satellites | 3D Models/Geostationary Operational Environmental Satellites/Geostationary Operational Environmental Satellites.glb |
| ships/civilian/mars_global_surveyor/model.glb | Mars Global Surveyor (MOI) | 3D Models/Mars Global Surveyor/Mars Global Surveyor (MOI).glb |
| ships/civilian/mars_rover_opportunity/model.glb | Mars Exploration Rover Opportunity | 3D Models/Mars Exploration Rover - Opportunity (MER-B)/Mars Exploration Rover - Opportunity (MER-B).glb |
| ships/civilian/cassini_huygens/model.glb | Cassini-Huygens (B) | 3D Models/Cassini-Huygens (B)/Cassini-Huygens (B).glb |
| ships/civilian/explorer_jupiter_c/model.glb | Explorer Jupiter-C Rocket | 3D Models/Explorer Jupiter-C Rocket/Explorer Jupiter-C Rocket.glb |
| ships/civilian/space_shuttle_b/model.glb | Space Shuttle (B) | 3D Models/Space Shuttle (B)/Space Shuttle (B).glb |
| ships/civilian/space_shuttle_c/model.glb | Space Shuttle (C) | 3D Models/Space Shuttle (C)/Space Shuttle (C).glb |
| ships/civilian/cluster_probe/model.glb | Cluster | 3D Models/Cluster/Cluster.glb |
