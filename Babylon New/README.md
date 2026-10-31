# STARFALL — Babylon New

Изолированная ветка миграции Three.js → Babylon.js. Production-игра и существующий каталог Babylon/ не изменяются. Это техническая основа миграции, не готовый порт.

## Стек
- Babylon.js 7.0 — 3D runtime.
- Rapier 3D — физика и столкновения.
- Yuka — AI и steering.
- GSAP — UI/camera transitions.
- Howler.js — аудио.
- Vite — dev/build.
- Vitest — unit tests.

Механики: docs/MECHANICS_ARCHITECTURE.md. Состояние переноса: docs/MIGRATION_MATRIX.md.

## Запуск
Node.js 18+: npm install, npm run dev. Сборка: npm run build. Тесты: npm test.

Старые ключи сохранений только читаются. Исходный эталонный HTML хранится в локальном архиве миграции; перед локальной сборкой поместите его в reference/ согласно docs/README_SOURCE_REFERENCE.md.
