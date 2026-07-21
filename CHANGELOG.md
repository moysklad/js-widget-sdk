# История изменений

Все существенные изменения в этом проекте будут отражаться в этом файле.

## [1.2.0] - 2026-07-21

### Добавлено

- Добавлен метод `sdk.requestUserContextToken()` для нового протокола передачи контекста (`UserContextRequest` → `UserContextResponse`)

## [1.1.0] - 2026-06-10

### Добавлено

- Добавлена поддержка установки пакета через npm с `ESM`, `CommonJS` и декларациями TypeScript.
- Добавлен метод `sdk.autoResizeIframe()` для автоматического изменения высоты iframe.

### Изменено

- Сохранено browser/CDN-распространение через `dist/widget.js` и `dist/widget.min.js`.
- Обновлён `README` с примерами установки через npm и подключения через CDN.

### Примечание по миграции

- Основной entrypoint npm-пакета теперь экспортирует SDK как модуль (`ESM` / `CommonJS`), а не как browser-global bundle.
- Если потребитель рассчитывал на side-effect import и наличие `window.WidgetSDK`, ему нужно либо перейти на `import WidgetSDK from '@moysklad/js-widget-sdk'`, либо использовать browser bundle через `dist/widget.js` / `dist/widget.min.js`.

## [1.0.0] - 2026-02-10

### Добавлено

- Добавлен базовый browser SDK для работы виджета с хостом через `postMessage`.
- Добавлены browser bundles `dist/widget.js` и `dist/widget.min.js`.
- Добавлены основные методы SDK для запросов, событий и жизненного цикла виджета.
