# JS Widget SDK

Легковесный SDK для работы виджета с хостом через `postMessage`.
Дает единый API для запросов (request/response) и событий хоста.
Протоколы виджетов: https://dev.moysklad.ru/doc/api/vendor/1.0/#vidzhety

## Установка

Через npm:

```bash
npm install @moysklad/js-widget-sdk
```

Через CDN:

```html
<script src="https://cdn.jsdelivr.net/npm/@moysklad/js-widget-sdk/dist/widget.min.js"></script>
```

## Быстрый старт

### npm / bundler

```js
import WidgetSDK from '@moysklad/js-widget-sdk';

const sdk = WidgetSDK.create();
```

### CDN / script tag

```html
<script src="https://cdn.jsdelivr.net/npm/@moysklad/js-widget-sdk/dist/widget.min.js"></script>
<script>
  const sdk = WidgetSDK.create();
</script>
```

### Подписка на события

```
const sdk = WidgetSDK.create();

sdk.onOpen((message) => {
  console.log('Open', message);
});
```

### Отправка запросов хосту

```
sdk.showDialog('Учетная запись будет удалена. Вы хотите продолжить?', [
  { name: 'Yes', caption: 'Да, удалить' },
  { name: 'No', caption: 'Нет' }
])
  .then((response) => {
    console.log('Dialog response', response);
  });
```

### Получение контекста пользователя (UserContext)

Виджет сам запрашивает у хоста одноразовый opaque-токен и передает его на свой бэкенд, где обменивает в Vendor API на контекст пользователя.

```js
const token = await sdk.requestUserContextToken();

// передаем токен на свой бэкенд, там он обменивается в Vendor API
await fetch('/user-context/exchange', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token })
});
```

Требование к дескриптору: компонент решения должен объявлять протокол `user-context`, иначе хост ответит `InvalidMessageError`.

```xml
<uses>
  <user-context/>
</uses>
```

Как устроен обмен:

```
widget -> host: { name: 'UserContextRequest', messageId: 1 }
host -> widget: { name: 'UserContextResponse', correlationId: 1, token: '<opaque-token>' }
```

Правила безопасной передачи токена:

- передавайте токен **только в теле** запроса (POST body) — не в query-параметрах и не в заголовках, чтобы он не попал в логи, историю браузера и `Referer`;
- токен **одноразовый** и с коротким сроком жизни — на каждый обмен запрашивайте новый;
- нигде его не сохраняйте: SDK держит токен только в памяти и возвращает его через Promise, не пишет ни в `localStorage`, ни в `sessionStorage`, ни в куки;
- обмен в Vendor API делайте **только с бэкенда** (там vendor-JWT), не из браузера;
- `debug: true` не логирует значение токена — в консоли вместо него будет `[redacted]`.

Таймаут ожидания ответа хоста обязателен: по умолчанию 10000 мс. Значение можно переопределить:

```js
const token = await sdk.requestUserContextToken({ timeoutMs: 3000 });
```

По истечении таймаута запрос удаляется из очереди ожидания и Promise отклоняется — поздний ответ хоста уже не разрешит этот Promise.

Ошибки `requestUserContextToken()` (различаются по `error.name`):

| `error.name`                      | Когда возникает                                                                                                                                       |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RequestTimeoutError`             | Хост не ответил за `timeoutMs`. Поля: `requestName`, `messageId`, `timeoutMs`.                                                                        |
| `InvalidMessageError`             | Ответ хоста об ошибке: протокол `user-context` не поддерживается хостом, не объявлен `<user-context/>` в дескрипторе и т.п. Текст формирует хост.     |
| `InvalidUserContextResponseError` | Ответ пришел, но не соответствует протоколу: другое `name` или `token` не является непустой строкой. Поля: `responseName`, `rawMessage` (без токена). |
| `InvalidRequestOptions`           | Некорректная опция `timeoutMs` (не число, `NaN`, `Infinity`, `0` или отрицательное значение). Запрос хосту не отправляется.                           |
| `SDKDestroyed`                    | Во время ожидания ответа был вызван `sdk.destroy()`.                                                                                                  |

Диагностика `InvalidMessageError`: текст ошибки приходит от хоста и доступен в `error.message`, полный список ошибок хоста — в `error.details` (массив `errors` из сообщения) и `error.rawMessage`. Типичная причина — отсутствие `<uses><user-context/></uses>` в дескрипторе решения либо запрос протокола из компонента, для которого он не объявлен. Список возможных ошибок: https://dev.moysklad.ru/doc/api/vendor/1.0/#oshibki-pri-rabote-s-widzhetami

```js
try {
  const token = await sdk.requestUserContextToken();
} catch (error) {
  if (error.name === 'RequestTimeoutError') {
    // хост не ответил, можно повторить запрос
  } else if (error.name === 'InvalidMessageError') {
    console.warn(
      'Host rejected UserContextRequest:',
      error.message,
      error.details
    );
  }
}
```

Проверка `event.origin` в SDK намеренно не выполняется: хост может размещаться на разных доменах. Безопасность обеспечивается одноразовостью токена и его проверкой на стороне сервера при обмене в Vendor API.

## Структура репозитория

```
src/core.js                  исходники SDK
src/index.js                 npm entry (ESM/CJS)
src/browser.js               browser global entry
src/WidgetSDKInstance.js     совместимый browser entry для тестов/dev

dist/index.mjs               ESM entry для npm
dist/index.cjs               CommonJS entry для npm
dist/widget.js               собранный файл
dist/widget.min.js           минифицированный файл
dist/index.d.ts              типы
```

Папка `dist` генерируется при сборке (`npm run build`) и попадает в релизные артефакты и npm-пакет.

## Сборка

1. Установить зависимости:

```
npm install
```

2. Собрать:

```
npm run build
```

## Публичное API

Глобальный объект: `WidgetSDK`.

### Создание экземпляра

```
const sdk = WidgetSDK.create({ debug: true });
```

Используйте `debug` только при разработке.

### Методы

Запросы к хосту:

- `selectGoodFolder` — протокол `good-folder-selector`: открывает селектор группы товаров.
- `requestUserContextToken` — протокол `user-context`: запрашивает у хоста одноразовый opaque-токен для получения контекста пользователя.
- `showDialog` — протокол `standard-dialogs`: показывает стандартный диалог хоста.
- `navigateTo` — протокол `navigation-service`: навигация в хосте.
- `openFeedback` — протокол `open-feedback`: сигнал готовности виджета после `Open`.
- `setDirty` — протокол `dirty-state`: сообщает о несохраненных изменениях в виджете.
- `clearDirty` — снимает признак несохраненных изменений (dirty-state).
- `showPopup` — открывает кастомное модальное окно.
- `closePopup` — закрывает кастомное модальное окно.
- `update` — протокол `update-provider`: меняет несохраненное состояние документа в хосте.
- `validationFeedback` — протокол `validation-feedback`: ответ на `Change` о валидности данных.
- `autoResizeIframe` — автоматически отправляет родительскому окну актуальную высоту контента для изменения высоты iframe.

События и подписки:

- `off` — отписка.
- `on` — подписка на сообщения хоста.
- `onChange` — событие `Change` (изменение несохраненного состояния, протокол `change-handler`).
- `onOpen` — событие `Open` (открытие/контекст виджета).
- `onOpenPopup` — событие `OpenPopup` (открытие модального окна).
- `onSave` — событие `Save` (сохранение пользователем объекта, протокол `save-handler`).

Жизненный цикл:

- `destroy` — очистка слушателей и активных запросов.

### Пример работы с событиями

```
sdk.on('Change', (message) => {
  console.log('Change', message);
});
```

или

```
const unsubscribe = sdk.on('Change', (message) => {
  console.log('Change', message);
});

// опционально, можно отписаться при необходимости
unsubscribe();
```

## Отправка сообщений и обработка ответов

SDK использует `postMessage`:

- Каждый запрос получает `messageId`.
- Ответ хоста должен содержать `correlationId`, равный `messageId` запроса.
- Ответ с `name: 'InvalidMessageError'` превращается в `Error` и отклоняет Promise.
  Список возможных ошибок: https://dev.moysklad.ru/doc/api/vendor/1.0/#oshibki-pri-rabote-s-widzhetami
- `sdk.sendRequest(message, { timeoutMs })` позволяет ограничить время ожидания ответа: по таймауту запрос удаляется из очереди ожидания и Promise отклоняется ошибкой `RequestTimeoutError`. Без опции `timeoutMs` поведение прежнее — SDK ждет ответ хоста без ограничения по времени.

Пример вызова SDK (ShowDialog):

```
sdk.showDialog({
  dialogText: 'Привет',
  buttons: [{ name: 'Ok', caption: 'OK' }]
}).then((result) => {
  console.log('ShowDialog result', result);
});
```

Пример запроса:

```
{
  name: 'ShowDialogRequest',
  messageId: 1,
  dialogText: 'Привет',
  buttons: [{ name: 'Ok', caption: 'OK' }]
}
```

Пример ответа:

```
{
  name: 'ShowDialogResponse',
  correlationId: 1,
  result: 'Ok'
}
```

Пример ответа с ошибкой (Promise отклонится):

```
{
  name: 'InvalidMessageError',
  correlationId: 1,
  message: 'Unsupported dialog payload'
}
```

## Опции и отладка

- Опции указываются при создании SDK: `createSdk({ debug: true })`.
- `debug: true` включает логирование в консоль.
- В проде рекомендуется `debug: false`.

## Жизненный цикл

Если виджет уничтожается или переинициализируется:

```
sdk.destroy();
```

Это снимает `message`‑листенер и отклоняет активные запросы.

### Масштабирование высоты главного окна (expand)

Если содержимое главного `iframe` не умещается в минимальную допустимую высоту окна, можно включить автоматическую отправку текущей высоты контента родительскому окну. Родительская страница будет использовать это значение для изменения высоты `iframe`.

Базовое использование:

```js
const sdk = WidgetSDK.create();
sdk.autoResizeIframe();
```

Остановка опроса при необходимости:

```js
const sdk = WidgetSDK.create();
const stopAutoResize = sdk.autoResizeIframe();

stopAutoResize();
```

Поведение:

- вне iframe функция ничего не делает и возвращает no-op `dispose`;
- внутри iframe сразу отправляет первую высоту, затем повторяет проверку по интервалу;
- повторный вызов заменяет предыдущий poller на этом экземпляре SDK;
- `stopAutoResize()` снимает `load`-слушатель и останавливает опрос;
- `sdk.destroy()` также останавливает этот опрос вместе с остальными ресурсами SDK.

## Совместимость

SDK рассчитан на браузерное окружение (window/iframe) и `postMessage`.
Поддерживаемые браузеры: Яндекс.Браузер, Chrome, Opera, Firefox, Safari.
