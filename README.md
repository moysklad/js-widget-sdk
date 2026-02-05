# JS Widget SDK

Легковесный SDK для работы виджета с хостом через `postMessage`.
Дает единый API для запросов (request/response) и событий хоста.
Протоколы виджетов: https://dev.moysklad.ru/doc/api/vendor/1.0/#vidzhety

## Быстрый старт
1) Подключите файл SDK в виджете:
```
<script src="dist/widget.min.js"></script>
```

2) Создайте экземпляр и подпишитесь на события:
```
const sdk = WidgetSDK.create();

sdk.onOpen((message) => {
  console.log('Open', message);
});
```

3) Отправляйте запросы хосту:
```
sdk.showDialog('Учетная запись будет удалена. Вы хотите продолжить?', [
  { name: 'Yes', caption: 'Да, удалить' },
  { name: 'No', caption: 'Нет' }
])
  .then((response) => {
    console.log('Dialog response', response);
  });
```

## Структура репозитория
```
src/index.js                 entry point
src/WidgetSDKInstance.js     исходники SDK

dist/widget.js               собранный файл
dist/widget.min.js           минифицированный файл
```
Папка `dist` хранится в репозитории, чтобы вендоры могли брать готовые файлы без сборки.

## Установка и сборка
1) Установить зависимости:
```
npm install
```

2) Собрать:
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
- `showDialog` — протокол `standard-dialogs`: показывает стандартный диалог хоста.
- `navigateTo` — протокол `navigation-service`: навигация в хосте.
- `openFeedback` — протокол `open-feedback`: сигнал готовности виджета после `Open`.
- `setDirty` — протокол `dirty-state`: сообщает о несохраненных изменениях в виджете.
- `clearDirty` — снимает признак несохраненных изменений (dirty-state).
- `showPopup` — открывает кастомное модальное окно.
- `closePopup` — закрывает кастомное модальное окно.
- `update` — протокол `update-provider`: меняет несохраненное состояние документа в хосте.
- `validationFeedback` — протокол `validation-feedback`: ответ на `Change` о валидности данных.

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

## Совместимость
SDK рассчитан на браузерное окружение (window/iframe) и `postMessage`.
Поддерживаемые браузеры: Яндекс.Браузер, Chrome, Opera, Firefox, Safari.
