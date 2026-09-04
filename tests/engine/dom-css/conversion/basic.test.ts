import { describe, expect, it } from 'bun:test'

import {
  createHeadlessCSSRuntime,
  designDocumentToSceneGraph,
  htmlToDesignDocument,
  htmlToSceneGraph,
  sceneGraphToDesignDocument,
  serializeHTML,
  tailwindHTMLToSceneGraph
} from '@signal-forge/dom-css'

import {
  computedCardDocument,
  cssCardCSS,
  cssCardHTML,
  tailwindCardClasses
} from '#tests/helpers/dom-css'

describe('@signal-forge/dom-css conversion', () => {
  it('converts HTML and CSS to DesignDOM with one API call', async () => {
    const document = await htmlToDesignDocument(cssCardHTML, {
      cssText: cssCardCSS,
      runtime: createHeadlessCSSRuntime()
    })
    const card = document.children[0]

    expect(card?.type).toBe('element')
    if (card?.type !== 'element') return
    expect(card.computedStyle?.width).toBe('320px')
    expect(card.computedStyle?.['border-radius']).toBe('16px')
  })

  it('converts HTML and CSS to a scene graph with one API call', async () => {
    const graph = await htmlToSceneGraph(cssCardHTML, {
      cssText: cssCardCSS,
      runtime: createHeadlessCSSRuntime()
    })
    const page = graph.getPages()[0]
    const card = page ? graph.getChildren(page.id)[0] : undefined

    expect(card?.type).toBe('FRAME')
    expect(card?.width).toBe(320)
    expect(card?.layoutMode).toBe('VERTICAL')
  })

  it('converts Tailwind HTML through generated CSS to a scene graph', async () => {
    const classes = [...tailwindCardClasses]
    const graph = await tailwindHTMLToSceneGraph(
      `<article class="${classes.join(' ')}"><h1>SignalForge</h1></article>`,
      classes,
      { runtime: createHeadlessCSSRuntime() }
    )
    const page = graph.getPages()[0]
    const card = page ? graph.getChildren(page.id)[0] : undefined

    expect(card?.type).toBe('FRAME')
    expect(card?.width).toBe(320)
    expect(card?.height).toBe(176)
    expect(card?.itemSpacing).toBe(12)
  })

  it('projects a DesignDOM card into a scene graph', () => {
    const graph = designDocumentToSceneGraph(computedCardDocument)
    const page = graph.getPages()[0]
    expect(page?.name).toBe('DesignDOM')

    const card = page ? graph.getChildren(page.id)[0] : undefined
    expect(card?.type).toBe('FRAME')
    expect(card?.width).toBe(320)
    expect(card?.height).toBe(160)
    expect(card?.layoutMode).toBe('VERTICAL')
    expect(card?.itemSpacing).toBe(12)
    expect(card?.paddingTop).toBe(24)
    expect(card?.cornerRadius).toBe(16)
    expect(card?.fills[0]?.type).toBe('SOLID')

    const title = card ? graph.getChildren(card.id)[0] : undefined
    expect(title?.type).toBe('TEXT')
    expect(title?.text).toBe('SignalForge')
    expect(title?.fontSize).toBe(24)
    expect(title?.fontWeight).toBe(700)
  })

  it('projects a parsed and styled HTML/CSS card into a scene graph', async () => {
    const runtime = createHeadlessCSSRuntime()
    const document = await runtime.computeStyles(runtime.parseHTML(cssCardHTML), cssCardCSS)
    const graph = designDocumentToSceneGraph(document)
    const page = graph.getPages()[0]
    const card = page ? graph.getChildren(page.id)[0] : undefined

    expect(card?.type).toBe('FRAME')
    if (card?.type !== 'FRAME') return
    expect(card.width).toBe(320)
    expect(card.height).toBe(180)
    expect(card.layoutMode).toBe('VERTICAL')
    expect(card.itemSpacing).toBe(12)
    expect(card.paddingLeft).toBe(24)
    expect(card.fills[0]?.type).toBe('SOLID')
    expect(card.strokes[0]?.weight).toBe(1)
    expect(card.effects[0]?.type).toBe('DROP_SHADOW')
    expect(card.effects[0]?.radius).toBe(24)

    const [title, description] = graph.getChildren(card.id)
    expect(title?.type).toBe('TEXT')
    expect(title?.fontSize).toBe(24)
    expect(title?.fills[0]?.type).toBe('SOLID')
    expect(description?.type).toBe('TEXT')
    expect(description?.fontSize).toBe(14)

    const roundTrip = sceneGraphToDesignDocument(graph)
    const html = serializeHTML(roundTrip)
    expect(html).toContain('SignalForge')
    expect(html).toContain('Design with code-shaped CSS.')
    expect(html).toContain('box-shadow')
  })

  it('projects a scene graph back into DesignDOM', () => {
    const graph = designDocumentToSceneGraph(computedCardDocument)
    const document = sceneGraphToDesignDocument(graph)
    const page = document.children[0]
    expect(page?.type).toBe('element')
    if (page?.type !== 'element') return

    const card = page.children[0]
    expect(card?.type).toBe('element')
    if (card?.type !== 'element') return

    expect(card.tagName).toBe('div')
    expect(card.inlineStyle?.width).toBe('320px')
    expect(card.inlineStyle?.display).toBe('flex')
    expect(card.inlineStyle?.['flex-direction']).toBe('column')
    expect(card.attrs['data-signalforge-node-id']).toBeTruthy()

    const title = card.children[0]
    expect(title?.type).toBe('element')
    if (title?.type !== 'element') return
    expect(title.tagName).toBe('span')
    expect(title.inlineStyle?.['font-size']).toBe('24px')
  })
})
