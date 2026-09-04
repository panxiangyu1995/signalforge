import { expect } from 'bun:test'

import type { DesignElement, DesignNode } from '@signal-forge/dom-css'
import { designDocumentToSceneGraph, sceneGraphToDesignDocument } from '@signal-forge/dom-css'
import type { SceneGraph, SceneNode } from '@signal-forge/scene-graph'

import { DOM_CSS_COLORS } from '#tests/helpers/dom-css'

export function expectFrame(node: SceneNode | undefined) {
  expect(node?.type).toBe('FRAME')
  if (node?.type !== 'FRAME') throw new Error('Expected frame node')
  return node
}

export function findTextElement(nodes: DesignNode[]): DesignElement | undefined {
  for (const node of nodes) {
    if (node.type !== 'element') continue
    if (node.children.some((child) => child.type === 'text')) return node
    const child = findTextElement(node.children)
    if (child) return child
  }
  return undefined
}

export function createStyleRoundTripGraph() {
  return designDocumentToSceneGraph({
    type: 'document',
    children: [
      {
        type: 'element',
        tagName: 'section',
        attrs: { class: 'panel' },
        computedStyle: {
          display: 'flex',
          'flex-direction': 'column',
          width: '240px',
          height: '120px',
          'padding-block': '8px',
          'padding-inline': '12px',
          'border-color': DOM_CSS_COLORS.slate200,
          'border-top-width': '0px',
          'border-right-width': '2px',
          'border-bottom-width': '0px',
          'border-left-width': '4px',
          opacity: '0.75',
          'box-shadow': `0px 8px 24px 0px ${DOM_CSS_COLORS.slateShadow}`
        },
        children: [
          {
            type: 'element',
            tagName: 'h1',
            attrs: {},
            computedStyle: {
              color: DOM_CSS_COLORS.slate950,
              'font-family': 'Inter, sans-serif',
              'font-size': '18px',
              'font-weight': '700',
              'line-height': '24px',
              'letter-spacing': '0.2px',
              'text-align': 'center',
              opacity: '0.5',
              'text-shadow': `0px 1px 2px 0px ${DOM_CSS_COLORS.slateShadow}`
            },
            children: [{ type: 'text', text: 'Round trip' }]
          }
        ]
      }
    ]
  })
}

export function expectStyleRoundTripPanel(graph: SceneGraph) {
  const page = graph.getPages()[0]
  const panel = expectFrame(page ? graph.getChildren(page.id)[0] : undefined)
  expect(panel.paddingTop).toBe(8)
  expect(panel.paddingRight).toBe(12)
  expect(panel.borderTopWeight).toBe(0)
  expect(panel.borderRightWeight).toBe(2)
  expect(panel.borderLeftWeight).toBe(4)
  expect(panel.opacity).toBe(0.75)
  expect(panel.effects[0]?.type).toBe('DROP_SHADOW')
  return panel
}

export function expectStyleRoundTripText(graph: SceneGraph, panel: SceneNode) {
  const heading = graph.getChildren(panel.id)[0]
  expect(heading?.type).toBe('TEXT')
  if (heading?.type !== 'TEXT') throw new Error('Expected text node')
  expect(heading.fontSize).toBe(18)
  expect(heading.fontWeight).toBe(700)
  expect(heading.lineHeight).toBe(24)
  expect(heading.letterSpacing).toBe(0.2)
  expect(heading.textAlignHorizontal).toBe('CENTER')
  expect(heading.opacity).toBe(0.5)
  expect(heading.effects[0]?.type).toBe('DROP_SHADOW')
}

function expectRoundTripPanelStyle(element: DesignElement) {
  expect(element.inlineStyle?.['padding-block']).toBe('8px')
  expect(element.inlineStyle?.['padding-inline']).toBe('12px')
  expect(element.inlineStyle?.['border-top-width']).toBe('0px')
  expect(element.inlineStyle?.['border-left-width']).toBe('4px')
  expect(element.inlineStyle?.opacity).toBe('0.75')
  expect(element.inlineStyle?.['box-shadow']).toContain('24px')
}

function expectRoundTripHeadingStyle(element: DesignElement) {
  expect(element.inlineStyle?.['font-size']).toBe('18px')
  expect(element.inlineStyle?.['font-weight']).toBe('700')
  expect(element.inlineStyle?.['line-height']).toBe('24px')
  expect(element.inlineStyle?.['letter-spacing']).toBe('0.2px')
  expect(element.inlineStyle?.['text-align']).toBe('center')
  expect(element.inlineStyle?.opacity).toBe('0.5')
  expect(element.inlineStyle?.['text-shadow']).toContain('2px')
}

export function expectStyleRoundTripHTML(graph: SceneGraph) {
  const roundTrip = sceneGraphToDesignDocument(graph)
  const root = roundTrip.children[0]
  expect(root?.type).toBe('element')
  if (root?.type !== 'element') throw new Error('Expected root element')
  const roundTripPanel = root.children[0]
  expect(roundTripPanel?.type).toBe('element')
  if (roundTripPanel?.type !== 'element') throw new Error('Expected panel element')
  expectRoundTripPanelStyle(roundTripPanel)

  const roundTripHeading = roundTripPanel.children[0]
  expect(roundTripHeading?.type).toBe('element')
  if (roundTripHeading?.type !== 'element') throw new Error('Expected heading element')
  expectRoundTripHeadingStyle(roundTripHeading)
}
