import type { Canvas, CanvasKit } from 'canvaskit-wasm'

import { type SceneNode, type SceneGraph, type Vector, type PathwayNodeData, type PathwayArcType, getPathwayData } from '@signal-forge/scene-graph'

import type { SkiaRenderer } from '#core/canvas/renderer'

import { SBGN_STYLE, PUBLICATION_STYLE, REALISTIC_STYLE, type PathwayStyle } from './constants'
import { findNearestPort } from './ports'
import { paintBezierArc } from './arcs-bezier'
import { hexToCKColor } from './utils'

function arcLineColor(ck: CanvasKit, arcType: PathwayArcType | undefined, style: PathwayStyle): Float32Array {
  if (style === 'publication' && arcType) {
    if (arcType === 'inhibition' || arcType === 'necessary_stimulation') {
      return hexToCKColor(ck, PUBLICATION_STYLE.edgeColors.inhibition)
    }
    if (arcType === 'stimulation' || arcType === 'trigger') {
      return hexToCKColor(ck, PUBLICATION_STYLE.edgeColors.activation)
    }
    if (arcType === 'catalysis') {
      return hexToCKColor(ck, PUBLICATION_STYLE.edgeColors.catalysis)
    }
  }
  return hexToCKColor(ck, SBGN_STYLE.edgeLineColor)
}

function directionVector(
  from: Vector,
  to: Vector
): { dx: number; dy: number; len: number } {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy)
  return len > 0 ? { dx: dx / len, dy: dy / len, len } : { dx: 0, dy: -1, len: 0 }
}

export function paintArrowhead(
  ck: CanvasKit,
  canvas: Canvas,
  tipX: number,
  tipY: number,
  dirX: number,
  dirY: number,
  size: number,
  r: SkiaRenderer
): void {
  const perpX = -dirY
  const perpY = dirX
  const baseX = tipX - dirX * size
  const baseY = tipY - dirY * size

  const path = new ck.Path()
  try {
    path.moveTo(tipX, tipY)
    path.lineTo(baseX + perpX * size * 0.5, baseY + perpY * size * 0.5)
    path.lineTo(baseX - perpX * size * 0.5, baseY - perpY * size * 0.5)
    path.close()

    r.fillPaint.setStyle(ck.PaintStyle.Fill)
    canvas.drawPath(path, r.fillPaint)
  } finally {
    path.delete()
  }
}

export function paintTBar(
  ck: CanvasKit,
  canvas: Canvas,
  tipX: number,
  tipY: number,
  dirX: number,
  dirY: number,
  size: number,
  r: SkiaRenderer
): void {
  const perpX = -dirY
  const perpY = dirX
  const halfW = size * 0.5

  r.strokePaint.setStrokeWidth(2)
  r.strokePaint.setStyle(ck.PaintStyle.Stroke)
  canvas.drawLine(
    tipX + perpX * halfW,
    tipY + perpY * halfW,
    tipX - perpX * halfW,
    tipY - perpY * halfW,
    r.strokePaint
  )
}

export function paintCircleOnLine(
  ck: CanvasKit,
  canvas: Canvas,
  cx: number,
  cy: number,
  radius: number,
  r: SkiaRenderer
): void {
  r.strokePaint.setStrokeWidth(SBGN_STYLE.edgeLineWidth)
  r.strokePaint.setStyle(ck.PaintStyle.Stroke)
  canvas.drawCircle(cx, cy, radius, r.strokePaint)
}

export function paintOpenTriangle(
  ck: CanvasKit,
  canvas: Canvas,
  tipX: number,
  tipY: number,
  dirX: number,
  dirY: number,
  size: number,
  r: SkiaRenderer
): void {
  const perpX = -dirY
  const perpY = dirX
  const baseX = tipX - dirX * size
  const baseY = tipY - dirY * size

  const path = new ck.Path()
  try {
    path.moveTo(tipX, tipY)
    path.lineTo(baseX + perpX * size * 0.5, baseY + perpY * size * 0.5)
    path.lineTo(baseX - perpX * size * 0.5, baseY - perpY * size * 0.5)
    path.close()

    r.strokePaint.setStyle(ck.PaintStyle.Stroke)
    r.strokePaint.setStrokeWidth(SBGN_STYLE.edgeLineWidth)
    canvas.drawPath(path, r.strokePaint)
  } finally {
    path.delete()
  }
}

export function paintFilledTriangle(
  ck: CanvasKit,
  canvas: Canvas,
  tipX: number,
  tipY: number,
  dirX: number,
  dirY: number,
  size: number,
  r: SkiaRenderer
): void {
  paintArrowhead(ck, canvas, tipX, tipY, dirX, dirY, size, r)
}

export function paintDiamond(
  ck: CanvasKit,
  canvas: Canvas,
  cx: number,
  cy: number,
  dirX: number,
  dirY: number,
  w: number,
  h: number,
  r: SkiaRenderer
): void {
  const perpX = -dirY
  const perpY = dirX

  const path = new ck.Path()
  try {
    path.moveTo(cx + dirX * w, cy + dirY * w)
    path.lineTo(cx + perpX * h, cy + perpY * h)
    path.lineTo(cx - dirX * w, cy - dirY * w)
    path.lineTo(cx - perpX * h, cy - perpY * h)
    path.close()

    r.strokePaint.setStyle(ck.PaintStyle.Stroke)
    r.strokePaint.setStrokeWidth(SBGN_STYLE.edgeLineWidth)
    canvas.drawPath(path, r.strokePaint)
  } finally {
    path.delete()
  }
}

export function paintTriggerDecoration(
  ck: CanvasKit,
  canvas: Canvas,
  tipX: number,
  tipY: number,
  dirX: number,
  dirY: number,
  size: number,
  r: SkiaRenderer
): void {
  paintArrowhead(ck, canvas, tipX, tipY, dirX, dirY, size, r)

  const perpX = -dirY
  const perpY = dirX
  const barX = tipX - dirX * size
  const barY = tipY - dirY * size
  const halfW = size * 0.5

  r.strokePaint.setStrokeWidth(2)
  r.strokePaint.setStyle(ck.PaintStyle.Stroke)
  canvas.drawLine(
    barX + perpX * halfW,
    barY + perpY * halfW,
    barX - perpX * halfW,
    barY - perpY * halfW,
    r.strokePaint
  )
}

const ARROW_SIZE = 8 * SBGN_STYLE.arrowScale
const CIRCLE_RADIUS = 3
const DIAMOND_W = 4
const DIAMOND_H = 3

function decorationScale(style: PathwayStyle): number {
  return style === 'realistic' ? REALISTIC_STYLE.decorationScale : 1
}

function paintArcDecoration(
  ck: CanvasKit,
  canvas: Canvas,
  arcType: PathwayArcType,
  targetX: number,
  targetY: number,
  dirX: number,
  dirY: number,
  r: SkiaRenderer,
  sourceX?: number,
  sourceY?: number,
  style: PathwayStyle = 'sbgn'
): void {
  const scale = decorationScale(style)
  switch (arcType) {
    case 'production':
      paintArrowhead(ck, canvas, targetX, targetY, dirX, dirY, ARROW_SIZE * scale, r)
      break
    case 'equivalence': {
      paintArrowhead(ck, canvas, targetX, targetY, dirX, dirY, ARROW_SIZE * scale, r)
      if (sourceX !== undefined && sourceY !== undefined) {
        const revDir = directionVector({ x: targetX, y: targetY }, { x: sourceX, y: sourceY })
        paintArrowhead(ck, canvas, sourceX, sourceY, revDir.dx, revDir.dy, ARROW_SIZE * scale, r)
      }
      break
    }
    case 'inhibition':
      paintTBar(ck, canvas, targetX, targetY, dirX, dirY, ARROW_SIZE * scale, r)
      break
    case 'catalysis': {
      const cx = targetX - dirX * (CIRCLE_RADIUS * scale + 2)
      const cy = targetY - dirY * (CIRCLE_RADIUS * scale + 2)
      paintCircleOnLine(ck, canvas, cx, cy, CIRCLE_RADIUS * scale, r)
      break
    }
    case 'stimulation':
      paintOpenTriangle(ck, canvas, targetX, targetY, dirX, dirY, ARROW_SIZE * scale, r)
      break
    case 'necessary_stimulation': {
      paintFilledTriangle(ck, canvas, targetX, targetY, dirX, dirY, ARROW_SIZE * scale, r)
      const barOffset = ARROW_SIZE * scale * 1.2
      paintTBar(ck, canvas, targetX - dirX * barOffset, targetY - dirY * barOffset, dirX, dirY, ARROW_SIZE * scale, r)
      break
    }
    case 'modulation': {
      const cx = targetX - dirX * (DIAMOND_W * scale + 2)
      const cy = targetY - dirY * (DIAMOND_W * scale + 2)
      paintDiamond(ck, canvas, cx, cy, dirX, dirY, DIAMOND_W * scale, DIAMOND_H * scale, r)
      break
    }
    case 'trigger':
      paintTriggerDecoration(ck, canvas, targetX, targetY, dirX, dirY, ARROW_SIZE * scale, r)
      break
    case 'consumption':
      break
    case 'logic_and': {
      const cx = targetX - dirX * (CIRCLE_RADIUS * scale + 2)
      const cy = targetY - dirY * (CIRCLE_RADIUS * scale + 2)
      paintCircleOnLine(ck, canvas, cx, cy, CIRCLE_RADIUS * scale, r)
      r.fillPaint.setColor(r.strokePaint.getColor())
      r.fillPaint.setStyle(ck.PaintStyle.Fill)
      canvas.drawCircle(cx, cy, CIRCLE_RADIUS * scale * 0.6, r.fillPaint)
      break
    }
    case 'logic_or': {
      const cx = targetX - dirX * (CIRCLE_RADIUS * scale + 2)
      const cy = targetY - dirY * (CIRCLE_RADIUS * scale + 2)
      paintCircleOnLine(ck, canvas, cx, cy, CIRCLE_RADIUS * scale, r)
      break
    }
    case 'logic_not':
      paintTBar(ck, canvas, targetX, targetY, dirX, dirY, ARROW_SIZE * scale, r)
      break
    default:
      break
  }
}

export function paintPathwayArc(
  ck: CanvasKit,
  canvas: Canvas,
  node: SceneNode,
  data: PathwayNodeData,
  graph: SceneGraph,
  style: PathwayStyle,
  r: SkiaRenderer
): void {
  canvas.save()
  const sourceId = data.sourceId
  const targetId = data.targetId
  if (!sourceId || !targetId) { canvas.restore(); return }

  const sourceNode = graph.getNode(sourceId)
  const targetNode = graph.getNode(targetId)
  if (!sourceNode || !targetNode) { canvas.restore(); return }

  const sourceAbs = graph.getAbsolutePosition(sourceId)
  const targetAbs = graph.getAbsolutePosition(targetId)

  const sourceData = getPathwayData(sourceNode)
  const targetData = getPathwayData(targetNode)

  let sx: number, sy: number, tx: number, ty: number

  if (data.sourcePort) {
    sx = sourceAbs.x + data.sourcePort.x
    sy = sourceAbs.y + data.sourcePort.y
  } else if (sourceData) {
    const targetOfSource = { x: targetAbs.x + targetNode.width / 2 - sourceAbs.x, y: targetAbs.y + targetNode.height / 2 - sourceAbs.y }
    const port = findNearestPort(sourceNode, sourceData, targetOfSource)
    sx = sourceAbs.x + port.x
    sy = sourceAbs.y + port.y
  } else {
    sx = sourceAbs.x + sourceNode.width / 2
    sy = sourceAbs.y + sourceNode.height / 2
  }

  if (data.targetPort) {
    tx = targetAbs.x + data.targetPort.x
    ty = targetAbs.y + data.targetPort.y
  } else if (targetData) {
    const targetOfTarget = { x: sourceAbs.x + sourceNode.width / 2 - targetAbs.x, y: sourceAbs.y + sourceNode.height / 2 - targetAbs.y }
    const port = findNearestPort(targetNode, targetData, targetOfTarget)
    tx = targetAbs.x + port.x
    ty = targetAbs.y + port.y
  } else {
    tx = targetAbs.x + targetNode.width / 2
    ty = targetAbs.y + targetNode.height / 2
  }

  let dir = directionVector({ x: sx, y: sy }, { x: tx, y: ty })

  if (data.bendPoints && data.bendPoints.length > 0) {
    const lastBend = data.bendPoints[data.bendPoints.length - 1]
    dir = directionVector({ x: lastBend.x, y: lastBend.y }, { x: tx, y: ty })
  }

  const lineColor = arcLineColor(ck, data.arcType, style)
  r.strokePaint.setColor(lineColor)
  r.strokePaint.setStrokeWidth(style === 'realistic' ? REALISTIC_STYLE.arcWidth : SBGN_STYLE.edgeLineWidth)
  r.strokePaint.setStyle(ck.PaintStyle.Stroke)

  if (style === 'realistic') {
    const sp = data.sourcePort ? { side: data.sourcePort.side, x: data.sourcePort.x, y: data.sourcePort.y } : undefined
    const tp = data.targetPort ? { side: data.targetPort.side, x: data.targetPort.x, y: data.targetPort.y } : undefined
    paintBezierArc(ck, canvas, sx, sy, tx, ty, sp, tp, data.bendPoints, r)
  } else if (data.bendPoints && data.bendPoints.length > 0) {
    const path = new ck.Path()
    try {
      path.moveTo(sx, sy)
      for (const bp of data.bendPoints) {
        path.lineTo(bp.x, bp.y)
      }
      path.lineTo(tx, ty)
      canvas.drawPath(path, r.strokePaint)
    } finally {
      path.delete()
    }
  } else {
    canvas.drawLine(sx, sy, tx, ty, r.strokePaint)
  }

  if (data.arcType) {
    r.fillPaint.setColor(lineColor)
    r.strokePaint.setColor(lineColor)
    paintArcDecoration(ck, canvas, data.arcType, tx, ty, dir.dx, dir.dy, r, sx, sy, style)
  }
  canvas.restore()
}
