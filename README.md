# JS Widget SDK

Минимальный репозиторий для сборки SDK.

## Структура
```
src/WidgetSDKInstance.js      исходный файл
dist/widget.js     собранный файл
dist/widget.min.js минифицированный файл
```
Папка `dist` хранится в репозитории, чтобы вендоры могли брать готовые файлы без сборки.

## Сборка
Сборка выполняется через Rollup.
1) Установить зависимости:
```
npm install
```
2) Собрать:
```
npm run build
```

## Использование
Подключите `dist/widget.js` или `dist/widget.min.js` и используйте глобальный объект `WidgetSDK`.

Пример:
```
const sdk = WidgetSDK.create({ debug: true });
```
