---
title: Dateien inspizieren
description: Knotenbäume durchsuchen, nach Name oder Typ suchen und Eigenschaften im Terminal untersuchen.
---

# Dateien inspizieren

Das CLI ermöglicht es, `.fig`-Dateien zu erkunden, ohne den Editor zu öffnen. Jeder Befehl funktioniert auch mit der laufenden App — lass einfach das Dateiargument weg.

::: tip Installation
```sh
npm install -g @signal-forge/cli
# oder
brew install panxiangyu1995/tap/signalforge
```
:::

## Dokumentinformationen

Erhalte einen schnellen Überblick — Seitenanzahl, Gesamtknoten, verwendete Schriften, Dateigröße:

```sh
signalforge info design.fig
```

## Knotenbaum

Gibt die vollständige Knotenhierarchie aus:

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

## Knoten finden

Nach Typ suchen:

```sh
signalforge find design.fig --type TEXT
```

Nach Name suchen:

```sh
signalforge find design.fig --name "Button"
```

Beide Flags können kombiniert werden, um Ergebnisse weiter einzugrenzen.

## Knotendetails

Alle Eigenschaften eines bestimmten Knotens anhand seiner ID inspizieren:

```sh
signalforge node design.fig --id 1:23
```

## Seiten

Alle Seiten im Dokument auflisten:

```sh
signalforge pages design.fig
```

## Variablen

Designvariablen und ihre Sammlungen auflisten:

```sh
signalforge variables design.fig
```

## Live-App-Modus

Wenn die Desktop-App läuft, lass das Dateiargument weg — das CLI verbindet sich über RPC und arbeitet auf der Live-Zeichenfläche:

```sh
signalforge tree              # das Live-Dokument inspizieren
signalforge eval -c "..."     # den Editor abfragen
```

## JSON-Ausgabe

Alle Befehle unterstützen `--json` für maschinenlesbare Ausgabe — weiterleiten an `jq`, in CI-Skripte einspeisen oder mit anderen Werkzeugen verarbeiten:

```sh
signalforge tree design.fig --json | jq '.[] | .name'
```
