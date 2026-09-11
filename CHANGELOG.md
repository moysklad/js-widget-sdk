# История изменений

Все существенные изменения в этом проекте будут отражаться в этом файле.

## [1.3.0] - 2026-09-11

### Добавлено

- Добавлен метод `sdk.requestUserContextToken()` для протокола `user-context`: виджет запрашивает у хоста одноразовый opaque-токен (`UserContextRequest` → `UserContextResponse`) и обменивает его на контекст пользователя в Vendor API со своего бэкенда.
- Добавлен обязательный таймаут ожидания ответа для `requestUserContextToken()`: по умолчанию 10000 мс, переопределяется опцией `{ timeoutMs }`. По истечении таймаута запрос удаляется из очереди ожидания, а Promise отклоняется ошибкой `RequestTimeoutError`.
- Добавлена опциональная поддержка таймаута в `sdk.sendRequest(message, { timeoutMs })`.
- Добавлены TypeScript-декларации `RequestUserContextTokenOptions`, `SendRequestOptions` и типы ошибок SDK (`RequestTimeoutError`, `InvalidUserContextResponseError`, `InvalidMessageError`, `InvalidRequestOptionsError`, `SDKDestroyedError`).

### Изменено

- Значение `token` больше не попадает в отладочные логи и в `rawMessage` ошибок — вместо него подставляется `[redacted]`.
- `sdk.destroy()` дополнительно снимает таймеры таймаутов активных запросов.

## [1.2.0] - 2026-08-31

### Изменено

- `on('Open', …)` / `onOpen` доигрывают последнее полученное `Open` подписчику, который подписался после его прихода. Раньше виджет, подписывавшийся после монтирования интерфейса (React, Vue), терял `Open` и не отправлял `OpenFeedback`, из-за чего хост считал его не загрузившимся. Обработчик `Open` должен быть идемпотентным.

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
