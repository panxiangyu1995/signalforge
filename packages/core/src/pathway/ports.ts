import type { SceneNode, PathwayNodeData, Vector } from '@signal-forge/scene-graph'

import { SBGN_STYLE } from '#core/pathway/constants'

export type PortSide =
  | 'top' | 'top-right' | 'right' | 'bottom-right'
  | 'bottom' | 'bottom-left' | 'left' | 'top-left'

export type ArcRole = 'input' | 'output' | 'modulation'

export interface PortPosition {
  side: PortSide
  x: number
  y: number
}

export interface PortInfo {
  ports: PortPosition[]
}

const MODULATION_ARC_TYPES: ReadonlySet<string> = new Set([
  'catalysis', 'inhibition', 'stimulation',
  'necessary_stimulation', 'modulation', 'trigger',
])

export function arcRoleForType(arcType: string | undefined, isSource: boolean): ArcRole | undefined {
  if (!arcType) return undefined
  if (MODULATION_ARC_TYPES.has(arcType)) return isSource ? 'output' : 'modulation'
  if (arcType === 'consumption') return isSource ? 'output' : 'input'
  if (arcType === 'production') return isSource ? 'output' : 'input'
  if (arcType === 'equivalence') return 'output'
  return undefined
}

function epnPorts(w: number, h: number): PortPosition[] {
  return [
    { side: 'top', x: w / 2, y: 0 },
    { side: 'top-right', x: w * 0.75, y: 0 },
    { side: 'right', x: w, y: h / 2 },
    { side: 'bottom-right', x: w * 0.75, y: h },
    { side: 'bottom', x: w / 2, y: h },
    { side: 'bottom-left', x: w * 0.25, y: h },
    { side: 'left', x: 0, y: h / 2 },
    { side: 'top-left', x: w * 0.25, y: 0 },
  ]
}

function complexPorts(w: number, h: number): PortPosition[] {
  const cut = Math.min(SBGN_STYLE.complexCornerCutLength, w / 2, h / 2)
  return [
    { side: 'top', x: w / 2, y: cut },
    { side: 'top-right', x: w - cut, y: cut },
    { side: 'right', x: w - cut, y: h / 2 },
    { side: 'bottom-right', x: w - cut, y: h - cut },
    { side: 'bottom', x: w / 2, y: h - cut },
    { side: 'bottom-left', x: cut, y: h - cut },
    { side: 'left', x: cut, y: h / 2 },
    { side: 'top-left', x: cut, y: cut },
  ]
}

function sourceSinkPorts(w: number, h: number): PortPosition[] {
  return [
    { side: 'top', x: w / 2, y: h * 0.15 },
    { side: 'top-right', x: w * 0.85, y: h * 0.15 },
    { side: 'right', x: w * 0.85, y: h / 2 },
    { side: 'bottom-right', x: w * 0.85, y: h * 0.85 },
    { side: 'bottom', x: w / 2, y: h * 0.85 },
    { side: 'bottom-left', x: w * 0.15, y: h * 0.85 },
    { side: 'left', x: w * 0.15, y: h / 2 },
    { side: 'top-left', x: w * 0.15, y: h * 0.15 },
  ]
}

function processPorts(w: number, h: number, direction: 'top-bottom' | 'left-right'): PortPosition[] {
  if (direction === 'top-bottom') {
    return [
      { side: 'top-left', x: w * 0.25, y: 0 },
      { side: 'top', x: w / 2, y: 0 },
      { side: 'top-right', x: w * 0.75, y: 0 },
      { side: 'bottom-left', x: w * 0.25, y: h },
      { side: 'bottom', x: w / 2, y: h },
      { side: 'bottom-right', x: w * 0.75, y: h },
      { side: 'left', x: 0, y: h / 2 },
      { side: 'right', x: w, y: h / 2 },
    ]
  }
  return [
    { side: 'top-left', x: 0, y: h * 0.25 },
    { side: 'left', x: 0, y: h / 2 },
    { side: 'bottom-left', x: 0, y: h * 0.75 },
    { side: 'top-right', x: w, y: h * 0.25 },
    { side: 'right', x: w, y: h / 2 },
    { side: 'bottom-right', x: w, y: h * 0.75 },
    { side: 'top', x: w / 2, y: 0 },
    { side: 'bottom', x: w / 2, y: h },
  ]
}

const INPUT_SIDES_TB: ReadonlySet<PortSide> = new Set(['top', 'top-left', 'top-right'])
const OUTPUT_SIDES_TB: ReadonlySet<PortSide> = new Set(['bottom', 'bottom-left', 'bottom-right'])
const MODULATION_SIDES_TB: ReadonlySet<PortSide> = new Set(['left', 'right'])

const INPUT_SIDES_LR: ReadonlySet<PortSide> = new Set(['left', 'top-left', 'bottom-left'])
const OUTPUT_SIDES_LR: ReadonlySet<PortSide> = new Set(['right', 'top-right', 'bottom-right'])
const MODULATION_SIDES_LR: ReadonlySet<PortSide> = new Set(['top', 'bottom'])

function roleToSides(role: ArcRole, direction: 'top-bottom' | 'left-right'): ReadonlySet<PortSide> {
  if (direction === 'top-bottom') {
    if (role === 'input') return INPUT_SIDES_TB
    if (role === 'output') return OUTPUT_SIDES_TB
    return MODULATION_SIDES_TB
  }
  if (role === 'input') return INPUT_SIDES_LR
  if (role === 'output') return OUTPUT_SIDES_LR
  return MODULATION_SIDES_LR
}

export function computePortPositions(
  node: SceneNode,
  data: PathwayNodeData,
  direction: 'top-bottom' | 'left-right' = 'top-bottom'
): PortInfo {
  const w = node.width
  const h = node.height
  const glyphType = data.glyphType

  if (data.processType) {
    return { ports: processPorts(w, h, direction) }
  }

  if (glyphType === 'complex') {
    return { ports: complexPorts(w, h) }
  }

  if (glyphType === 'source_sink') {
    return { ports: sourceSinkPorts(w, h) }
  }

  return { ports: epnPorts(w, h) }
}

export function findNearestPort(
  node: SceneNode,
  data: PathwayNodeData,
  targetPoint: Vector,
  direction: 'top-bottom' | 'left-right' = 'top-bottom',
  arcRole?: ArcRole
): PortPosition {
  const info = computePortPositions(node, data, direction)
  if (info.ports.length === 0) {
    return { side: 'top', x: node.width / 2, y: 0 }
  }

  const isProcess = !!data.processType
  const allowedSides = (isProcess && arcRole) ? roleToSides(arcRole, direction) : null

  let nearest = info.ports[0]
  let minDist = Infinity

  for (const port of info.ports) {
    if (allowedSides && !allowedSides.has(port.side)) continue
    const dx = port.x - targetPoint.x
    const dy = port.y - targetPoint.y
    const dist = dx * dx + dy * dy
    if (dist < minDist) {
      minDist = dist
      nearest = port
    }
  }

  return nearest
}
