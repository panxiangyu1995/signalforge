import { describe, expect, it } from 'bun:test'

import { designDocumentToSceneGraph, sceneGraphToDesignDocument } from '@signal-forge/dom-css'

import { expectFrame } from '../helpers'

describe('@signal-forge/dom-css conversion', () => {
  it('maps CSS flex wrapping, self alignment, clipping, and absolute position', () => {
    const graph = designDocumentToSceneGraph({
      type: 'document',
      children: [
        {
          type: 'element',
          tagName: 'div',
          attrs: { class: 'stack' },
          computedStyle: {
            display: 'flex',
            'flex-direction': 'row',
            'flex-wrap': 'wrap',
            gap: '12px',
            'row-gap': '20px',
            overflow: 'clip',
            width: '240px',
            height: '120px'
          },
          children: [
            {
              type: 'element',
              tagName: 'div',
              attrs: { class: 'chip' },
              computedStyle: {
                position: 'absolute',
                left: '16px',
                top: '24px',
                'align-self': 'center',
                width: '80px',
                height: '32px'
              },
              children: []
            }
          ]
        }
      ]
    })
    const page = graph.getPages()[0]
    const stack = expectFrame(page ? graph.getChildren(page.id)[0] : undefined)
    const chip = expectFrame(graph.getChildren(stack.id)[0])

    expect(stack.layoutMode).toBe('HORIZONTAL')
    expect(stack.layoutWrap).toBe('WRAP')
    expect(stack.itemSpacing).toBe(12)
    expect(stack.counterAxisSpacing).toBe(20)
    expect(stack.clipsContent).toBe(true)
    expect(chip.layoutPositioning).toBe('ABSOLUTE')
    expect(chip.layoutAlignSelf).toBe('CENTER')
    expect(chip.x).toBe(16)
    expect(chip.y).toBe(24)

    const roundTrip = sceneGraphToDesignDocument(graph)
    const root = roundTrip.children[0]
    expect(root?.type).toBe('element')
    if (root?.type !== 'element') return
    const roundTripStack = root.children[0]
    expect(roundTripStack?.type).toBe('element')
    if (roundTripStack?.type !== 'element') return
    expect(roundTripStack.inlineStyle?.['flex-wrap']).toBe('wrap')
    expect(roundTripStack.inlineStyle?.['row-gap']).toBe('20px')
    expect(roundTripStack.inlineStyle?.overflow).toBe('hidden')

    const roundTripChip = roundTripStack.children[0]
    expect(roundTripChip?.type).toBe('element')
    if (roundTripChip?.type !== 'element') return
    expect(roundTripChip.inlineStyle?.position).toBe('absolute')
    expect(roundTripChip.inlineStyle?.left).toBe('16px')
    expect(roundTripChip.inlineStyle?.top).toBe('24px')
    expect(roundTripChip.inlineStyle?.['align-self']).toBe('center')
  })

  it('maps CSS flex alignment into scene graph auto-layout alignment', () => {
    const graph = designDocumentToSceneGraph({
      type: 'document',
      children: [
        {
          type: 'element',
          tagName: 'div',
          attrs: { class: 'toolbar' },
          computedStyle: {
            display: 'inline-flex',
            'align-items': 'center',
            'justify-content': 'space-between',
            gap: '8px',
            width: '240px',
            height: '40px'
          },
          children: [
            {
              type: 'element',
              tagName: 'span',
              attrs: {},
              children: [{ type: 'text', text: 'File' }]
            },
            {
              type: 'element',
              tagName: 'span',
              attrs: {},
              children: [{ type: 'text', text: 'Edit' }]
            }
          ]
        }
      ]
    })
    const page = graph.getPages()[0]
    const toolbar = page ? graph.getChildren(page.id)[0] : undefined

    expect(toolbar?.type).toBe('FRAME')
    if (toolbar?.type !== 'FRAME') return
    expect(toolbar.layoutMode).toBe('HORIZONTAL')
    expect(toolbar.primaryAxisAlign).toBe('SPACE_BETWEEN')
    expect(toolbar.counterAxisAlign).toBe('CENTER')

    const roundTrip = sceneGraphToDesignDocument(graph)
    const root = roundTrip.children[0]
    expect(root?.type).toBe('element')
    if (root?.type !== 'element') return
    const roundTripToolbar = root.children[0]
    expect(roundTripToolbar?.type).toBe('element')
    if (roundTripToolbar?.type !== 'element') return
    expect(roundTripToolbar.inlineStyle?.['justify-content']).toBe('space-between')
    expect(roundTripToolbar.inlineStyle?.['align-items']).toBe('center')
  })
})
