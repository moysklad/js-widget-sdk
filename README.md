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

Новый протокол передачи контекста: виджет сам запрашивает у хоста одноразовый opaque-токен и передаёт его на свой бэкенд, где обменивает в Vendor API на контекст пользователя.

```
const token = await sdk.requestUserContextToken();

// передаём токен на свой бэкенд, там он обменивается в Vendor API
await fetch('/user-context/exchange', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token })
});
```

Правила передачи токена:

- передавайте токен **только в теле** запроса (POST body) — не в query-параметрах и не в заголовках, чтобы он не попал в логи, историю и Referer;
- токен **одноразовый** и с коротким сроком жизни — на каждый обмен запрашивайте новый;
- нигде его не сохраняйте (ни в `localStorage`, ни в куках), обменивайте сразу;
- обмен в Vendor API делайте **только с бэкенда** (там vendor-JWT), не из браузера.

Для работы протокола компонент решения в дескрипторе должен объявлять `<uses><user-context/></uses>`.

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
