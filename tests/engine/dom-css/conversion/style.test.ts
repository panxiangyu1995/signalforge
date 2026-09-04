import { describe, expect, it } from 'bun:test'

import { designDocumentToSceneGraph, sceneGraphToDesignDocument } from '@signal-forge/dom-css'

import {
  createStyleRoundTripGraph,
  expectStyleRoundTripHTML,
  expectStyleRoundTripPanel,
  expectStyleRoundTripText,
  findTextElement
} from '../helpers'

describe('@signal-forge/dom-css conversion', () => {
  it('exports multiline text with preserved whitespace', () => {
    const graph = designDocumentToSceneGraph({
      type: 'document',
      children: [
        {
          type: 'element',
          tagName: 'p',
          attrs: {},
          inlineStyle: { width: '160px' },
          children: [{ type: 'text', text: 'Open\nPencil' }]
        }
      ]
    })
    const document = sceneGraphToDesignDocument(graph)
    const text = findTextElement(document.children)

    expect(text?.inlineStyle?.['white-space']).toBe('pre-wrap')
  })

  it('maps CSS shape constraints, clipping, corners, and borders', () => {
    const graph = designDocumentToSceneGraph({
      type: 'document',
      children: [
        {
          type: 'element',
          tagName: 'div',
          attrs: { class: 'panel' },
          computedStyle: {
            width: '320px',
            height: '160px',
            'min-width': '240px',
            'max-width': '480px',
            'min-height': '120px',
            'max-height': '320px',
            overflow: 'hidden',
            'border-top-color': 'rgb(229, 231, 235)',
            'border-top-width': '1px',
            'border-right-width': '2px',
            'border-bottom-width': '3px',
            'border-left-width': '4px',
            'border-top-left-radius': '4px',
            'border-top-right-radius': '8px',
            'border-bottom-right-radius': '12px',
            'border-bottom-left-radius': '16px'
          },
          children: []
        }
      ]
    })
    const page = graph.getPages()[0]
    const panel = page ? graph.getChildren(page.id)[0] : undefined

    expect(panel?.type).toBe('FRAME')
    if (panel?.type !== 'FRAME') return
    expect(panel.minWidth).toBe(240)
    expect(panel.maxWidth).toBe(480)
    expect(panel.minHeight).toBe(120)
    expect(panel.maxHeight).toBe(320)
    expect(panel.clipsContent).toBe(true)
    expect(panel.independentStrokeWeights).toBe(true)
    expect(panel.borderTopWeight).toBe(1)
    expect(panel.borderRightWeight).toBe(2)
    expect(panel.borderBottomWeight).toBe(3)
    expect(panel.borderLeftWeight).toBe(4)
    expect(panel.independentCorners).toBe(true)
    expect(panel.topLeftRadius).toBe(4)
    expect(panel.topRightRadius).toBe(8)
    expect(panel.bottomRightRadius).toBe(12)
    expect(panel.bottomLeftRadius).toBe(16)

    const roundTrip = sceneGraphToDesignDocument(graph)
    const root = roundTrip.children[0]
    expect(root?.type).toBe('element')
    if (root?.type !== 'element') return
    const roundTripPanel = root.children[0]
    expect(roundTripPanel?.type).toBe('element')
    if (roundTripPanel?.type !== 'element') return
    expect(roundTripPanel.inlineStyle?.overflow).toBe('hidden')
    expect(roundTripPanel.inlineStyle?.['min-width']).toBe('240px')
    expect(roundTripPanel.inlineStyle?.['border-top-width']).toBe('1px')
    expect(roundTripPanel.inlineStyle?.['border-left-width']).toBe('4px')
    expect(roundTripPanel.inlineStyle?.['border-bottom-left-radius']).toBe('16px')
  })

  it('round-trips logical padding, opacity, and text shadows', () => {
    const graph = createStyleRoundTripGraph()
    const panel = expectStyleRoundTripPanel(graph)
    expectStyleRoundTripText(graph, panel)
    expectStyleRoundTripHTML(graph)
  })
})
