import type { SceneGraph, Vector } from '@signal-forge/scene-graph'
import { getPathwayData, updatePathwayData } from '@signal-forge/scene-graph'

import { findNearestPort, arcRoleForType, type ArcRole } from '#core/pathway/ports'
import { collectPathwayArcs } from '#core/pathway/utils'

interface PortResult {
  sx: number
  sy: number
  tx: number
  ty: number
  sourceSide: string | null
  targetSide: string | null
}

function computeArcPorts(
  graph: SceneGraph,
  sourceId: string,
  targetId: string,
  arcType: string | undefined,
  direction: 'top-bottom' | 'left-right'
): PortResult | null {
  const sourceNode = graph.getNode(sourceId)
  const targetNode = graph.getNode(targetId)
  if (!sourceNode || !targetNode) return null

  const sourceData = getPathwayData(sourceNode)
  const targetData = getPathwayData(targetNode)

  const sourceAbs = graph.getAbsolutePosition(sourceId)
  const targetAbs = graph.getAbsolutePosition(targetId)

  const targetOfSource: Vector = { x: targetAbs.x + targetNode.width / 2 - sourceAbs.x, y: targetAbs.y + targetNode.height / 2 - sourceAbs.y }
  const sourceOfTarget: Vector = { x: sourceAbs.x + sourceNode.width / 2 - targetAbs.x, y: sourceAbs.y + sourceNode.height / 2 - targetAbs.y }

  const sourceRole: ArcRole | undefined = arcRoleForType(arcType, true)
  const targetRole: ArcRole | undefined = arcRoleForType(arcType, false)

  const sourcePort = sourceData
    ? findNearestPort(sourceNode, sourceData, targetOfSource, direction, sourceRole)
    : null
  const targetPort = targetData
    ? findNearestPort(targetNode, targetData, sourceOfTarget, direction, targetRole)
    : null

  return {
    sx: sourceAbs.x + (sourcePort?.x ?? sourceNode.width / 2),
    sy: sourceAbs.y + (sourcePort?.y ?? sourceNode.height / 2),
    tx: targetAbs.x + (targetPort?.x ?? targetNode.width / 2),
    ty: targetAbs.y + (targetPort?.y ?? targetNode.height / 2),
    sourceSide: sourcePort?.side ?? null,
    targetSide: targetPort?.side ?? null
  }
}

export function computeOrthogonalBendPoints(
  graph: SceneGraph,
  pageId: string,
  direction: 'top-bottom' | 'left-right' = 'top-bottom'
): number {
  const arcs = collectPathwayArcs(graph, pageId)
  let updated = 0

  for (const arc of arcs) {
    const data = getPathwayData(arc)
    if (!data?.sourceId || !data?.targetId) continue

    const ports = computeArcPorts(graph, data.sourceId, data.targetId, data.arcType, direction)
    if (!ports) continue

    const exitLen = 20
    const bendPoints = routeFromPorts(
      ports.sourceSide, ports.targetSide,
      ports.sx, ports.sy, ports.tx, ports.ty,
      exitLen, direction
    )

    updatePathwayData(arc, { bendPoints })
    updated++
  }

  return updated
}

function sideIsVertical(side: string | null): boolean {
  return side === 'top' || side === 'bottom' || side === 'top-left' || side === 'bottom-left' || side === 'top-right' || side === 'bottom-right'
}

function sideDirection(side: string | null, exitLen: number): { dx: number; dy: number } {
  switch (side) {
    case 'top':         return { dx: 0, dy: -exitLen }
    case 'bottom':      return { dx: 0, dy: exitLen }
    case 'left':        return { dx: -exitLen, dy: 0 }
    case 'right':       return { dx: exitLen, dy: 0 }
    case 'top-left':    return { dx: -exitLen * 0.707, dy: -exitLen * 0.707 }
    case 'top-right':   return { dx: exitLen * 0.707, dy: -exitLen * 0.707 }
    case 'bottom-left': return { dx: -exitLen * 0.707, dy: exitLen * 0.707 }
    case 'bottom-right':return { dx: exitLen * 0.707, dy: exitLen * 0.707 }
    default:            return { dx: 0, dy: 0 }
  }
}

function routeFromPorts(
  sourceSide: string | null,
  targetSide: string | null,
  sx: number, sy: number,
  tx: number, ty: number,
  exitLen: number,
  direction: 'top-bottom' | 'left-right'
): Vector[] {
  const bendPoints: Vector[] = []

  const srcDir = sideDirection(sourceSide, exitLen)
  const exitX = sx + srcDir.dx
  const exitY = sy + srcDir.dy

  const tgtDir = sideDirection(targetSide, exitLen)
  const entryX = tx - tgtDir.dx
  const entryY = ty - tgtDir.dy

  const srcVertical = sideIsVertical(sourceSide)
  const tgtVertical = sideIsVertical(targetSide)

  if (srcDir.dx === 0 && srcDir.dy === 0 && tgtDir.dx === 0 && tgtDir.dy === 0) {
    if (direction === 'top-bottom') {
      const midY = (sy + ty) / 2
      if (Math.abs(sx - tx) < 0.5) return []
      bendPoints.push({ x: sx, y: midY })
      bendPoints.push({ x: tx, y: midY })
    } else {
      const midX = (sx + tx) / 2
      if (Math.abs(sy - ty) < 0.5) return []
      bendPoints.push({ x: midX, y: sy })
      bendPoints.push({ x: midX, y: ty })
    }
    return bendPoints
  }

  bendPoints.push({ x: exitX, y: exitY })

  if (srcVertical && tgtVertical) {
    if (Math.abs(exitX - entryX) < 0.5) {
      bendPoints.push({ x: entryX, y: entryY })
    } else {
      const midY = (exitY + entryY) / 2
      bendPoints.push({ x: exitX, y: midY })
      bendPoints.push({ x: entryX, y: midY })
      bendPoints.push({ x: entryX, y: entryY })
    }
  } else if (!srcVertical && !tgtVertical) {
    if (Math.abs(exitY - entryY) < 0.5) {
      bendPoints.push({ x: entryX, y: entryY })
    } else {
      const midX = (exitX + entryX) / 2
      bendPoints.push({ x: midX, y: exitY })
      bendPoints.push({ x: midX, y: entryY })
      bendPoints.push({ x: entryX, y: entryY })
    }
  } else if (srcVertical && !tgtVertical) {
    bendPoints.push({ x: exitX, y: entryY })
    bendPoints.push({ x: entryX, y: entryY })
  } else {
    bendPoints.push({ x: entryX, y: exitY })
    bendPoints.push({ x: entryX, y: entryY })
  }

  return bendPoints
}
