---
title: Просмотр файлов
description: Просматривайте деревья узлов, ищите по имени или типу и изучайте свойства из терминала.
---

# Просмотр файлов

CLI позволяет исследовать дизайн-документы без открытия редактора. Каждая команда также работает с запущенным приложением — просто опустите аргумент файла.

::: tip Установка
```sh
npm install -g @signal-forge/cli
# или
brew install panxiangyu1995/tap/signalforge
```
:::

## Информация о документе

Краткий обзор — количество страниц, общее число узлов, используемые шрифты, размер файла:

```sh
signalforge info design.fig
```

## Дерево узлов

Вывод полной иерархии узлов:

```sh
signalforge tree design.fig
```

```
[0] [page] "Getting started" (0:46566)
  [0] [section] "" (0:46567)
    [0] [frame] "Body" (0:46568)
      [0] [frame] "Introduction" (0:46569)
        [0] [frame] "Introduction Card" (0:46570)
          [0] [frame] "Guidance" (0:46571)
```

## Поиск узлов

Поиск по типу:

```sh
signalforge find design.fig --type TEXT
```

Поиск по имени:

```sh
signalforge find design.fig --name "Button"
```

Оба флага можно комбинировать для более точных результатов.

## Запросы с XPath

Используйте XPath-селекторы для поиска узлов по типу, атрибутам и структуре дерева:

```sh
signalforge query design.fig "//FRAME"
```

### Полезные шаблоны

**По типу:**

```sh
signalforge query design.fig "//TEXT"                    # Все текстовые узлы
signalforge query design.fig "//COMPONENT"               # Все компоненты
signalforge query design.fig "//INSTANCE"                # Все экземпляры
```

**По атрибутам:**

```sh
signalforge query design.fig "//FRAME[@width < 300]"                # Фреймы шириной менее 300px
signalforge query design.fig "//*[@cornerRadius > 0]"               # Скруглённые углы
signalforge query design.fig "//*[@visible = false]"                # Скрытые узлы
signalforge query design.fig "//TEXT[@fontSize >= 24]"              # Крупный текст
signalforge query design.fig "//*[@opacity < 1]"                    # Полупрозрачные узлы
```

**По имени и текстовому содержимому:**

```sh
signalforge query design.fig "//TEXT[contains(@name, 'Button')]"    # Имя содержит 'Button'
signalforge query design.fig "//TEXT[contains(@text, 'Hello')]"     # Текст содержит 'Hello'
```

**По иерархии:**

```sh
signalforge query design.fig "//SECTION//TEXT"            # Текст внутри секций
signalforge query design.fig "//FRAME/TEXT"               # Прямые дочерние тексты фреймов
signalforge query design.fig "//COMPONENT_SET//INSTANCE"  # Экземпляры внутри наборов компонентов
```

### Доступные атрибуты

`name`, `width`, `height`, `x`, `y`, `visible`, `opacity`, `cornerRadius`, `fontSize`, `fontFamily`, `fontWeight`, `layoutMode`, `itemSpacing`, `paddingTop`, `paddingRight`, `paddingBottom`, `paddingLeft`, `strokeWeight`, `rotation`, `locked`, `blendMode`, `text`, `lineHeight`, `letterSpacing`

### Пример вывода

```
  Found 5 nodes

[0] [frame] "Logo  92×32" (0:9)
[1] [frame] "logo-short-6  31×32" (0:10)
[2] [frame] "wrapper  128×73" (0:20)
[3] [frame] "pen-drawing  148×52" (0:21)
[4] [frame] "surprised-emoji  32×32" (0:26)
```

## Свойства узла

Просмотр всех свойств конкретного узла по его ID:

```sh
signalforge node design.fig --id 1:23
```

## Страницы

Список всех страниц в документе:

```sh
signalforge pages design.fig
```

## Переменные

Список дизайн-переменных и их коллекций:

```sh
signalforge variables design.fig
```

## Режим работы с приложением

Когда настольное приложение запущено, опустите аргумент файла — CLI подключится по RPC и будет работать с активным холстом:

```sh
signalforge tree              # просмотр текущего документа
signalforge eval -c "..."     # запрос к редактору
```

## Линтинг дизайна

Проверяйте документы на соответствие правилам именования, вёрстки, структуры и доступности:

```sh
signalforge lint design.fig
signalforge lint design.pen --preset strict
signalforge lint design.fig --rule color-contrast
signalforge lint design.fig --list-rules
```

Используйте `--json` для машиночитаемого вывода.

## JSON-вывод

Все команды поддерживают `--json` для машиночитаемого вывода — передавайте в `jq`, используйте в CI-скриптах или обрабатывайте другими инструментами:

```sh
signalforge tree design.fig --json | jq '.[] | .name'
```
