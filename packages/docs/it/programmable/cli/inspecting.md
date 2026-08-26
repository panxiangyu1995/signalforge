---
title: Ispezione dei File
description: Esplora alberi di nodi, cerca per nome o tipo e analizza le proprietà dal terminale.
---

# Ispezione dei File

La CLI ti permette di esplorare file `.fig` senza aprire l'editor. Ogni comando funziona anche con l'app in esecuzione — basta omettere l'argomento del file.

::: tip Installazione
```sh
npm install -g @signal-forge/cli
# oppure
brew install panxiangyu1995/tap/signalforge
```
:::

## Informazioni sul Documento

Ottieni una panoramica rapida — conteggio pagine, nodi totali, font utilizzati, dimensione del file:

```sh
signalforge info design.fig
```

## Albero dei Nodi

Stampa l'intera gerarchia dei nodi:

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

## Trova Nodi

Cerca per tipo:

```sh
signalforge find design.fig --type TEXT
```

Cerca per nome:

```sh
signalforge find design.fig --name "Button"
```

Entrambi i flag possono essere combinati per restringere ulteriormente i risultati.

## Dettagli del Nodo

Ispeziona tutte le proprietà di un nodo specifico tramite il suo ID:

```sh
signalforge node design.fig --id 1:23
```

## Pagine

Elenca tutte le pagine del documento:

```sh
signalforge pages design.fig
```

## Variabili

Elenca le variabili di design e le relative collezioni:

```sh
signalforge variables design.fig
```

## Modalità App in Esecuzione

Quando l'app desktop è in esecuzione, ometti l'argomento del file — la CLI si connette tramite RPC e opera sul canvas attivo:

```sh
signalforge tree              # ispeziona il documento attivo
signalforge eval -c "..."     # interroga l'editor
```

## Output JSON

Tutti i comandi supportano `--json` per output leggibile dalle macchine — invia tramite pipe a `jq`, usa negli script CI o elabora con altri strumenti:

```sh
signalforge tree design.fig --json | jq '.[] | .name'
```
