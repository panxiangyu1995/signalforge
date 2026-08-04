import type { Canvas, CanvasKit } from 'canvaskit-wasm'

import type { SceneNode } from '@signal-forge/scene-graph'

import type { SkiaRenderer } from '#core/canvas/renderer'

import { hexToCKColor } from './utils'

export type MembraneType = 'plasma' | 'nuclear' | 'mitochondrial' | 'inner'

export function paintMembraneLine(
  ck: CanvasKit,
  canvas: Canvas,
  compartment: SceneNode,
  membraneType: MembraneType,
  r: SkiaRenderer
): void {
  const w = compartment.width
  if (w <= 0) return

  switch (membraneType) {
    case 'plasma':
      paintPlasmaMembrane(ck, canvas, w, r)
      break
    case 'nuclear':
      paintNuclearMembrane(ck, canvas, w, r)
      break
    case 'mitochondrial':
      paintMitochondrialMembrane(ck, canvas, w, compartment.height, r)
      break
    case 'inner':
      paintInnerMembrane(ck, canvas, w, r)
      break
  }
}

function paintPlasmaMembrane(
  ck: CanvasKit,
  canvas: Canvas,
  width: number,
  r: SkiaRenderer
): void {
  r.strokePaint.setStyle(ck.PaintStyle.Stroke)
  r.strokePaint.setColor(hexToCKColor(ck, '#333333'))
  r.strokePaint.setStrokeWidth(3)
  canvas.drawLine(0, 0, width, 0, r.strokePaint)

  r.strokePaint.setStrokeWidth(1)
  r.strokePaint.setColor(hexToCKColor(ck, 'rgba(153, 153, 153, 0.5)'))
  const tickH = 3
  for (let x = 4; x < width; x += 8) {
    canvas.drawLine(x, -tickH, x, tickH, r.strokePaint)
  }
}

function paintNuclearMembrane(
  ck: CanvasKit,
  canvas: Canvas,
  width: number,
  r: SkiaRenderer
): void {
  r.strokePaint.setStyle(ck.PaintStyle.Stroke)
  r.strokePaint.setColor(hexToCKColor(ck, '#555555'))
  r.strokePaint.setStrokeWidth(2)

  canvas.drawLine(0, -2, width, -2, r.strokePaint)

  const porePeriod = 40
  const poreGap = 15
  for (let x = 0; x < width; x += porePeriod) {
    const segEnd = Math.min(x + porePeriod - poreGap, width)
    canvas.drawLine(x, 2, segEnd, 2, r.strokePaint)
  }
}

function paintMitochondrialMembrane(
  ck: CanvasKit,
  canvas: Canvas,
  width: number,
  height: number,
  r: SkiaRenderer
): void {
  r.strokePaint.setStyle(ck.PaintStyle.Stroke)
  r.strokePaint.setColor(hexToCKColor(ck, '#555555'))
  r.strokePaint.setStrokeWidth(2)

  canvas.drawLine(0, 0, width, 0, r.strokePaint)

  r.strokePaint.setStrokeWidth(1.5)
  r.strokePaint.setColor(hexToCKColor(ck, 'rgba(85, 85, 85, 0.7)'))

  const innerY = 6
  const cristaePeriod = 30
  const cristaeDepth = Math.min(8, height * 0.04)

  canvas.drawLine(0, innerY, width, innerY, r.strokePaint)

  r.strokePaint.setStrokeWidth(1)
  for (let x = cristaePeriod / 2; x < width; x += cristaePeriod) {
    canvas.drawLine(x, innerY, x, innerY + cristaeDepth, r.strokePaint)
  }
}

function paintInnerMembrane(
  ck: CanvasKit,
  canvas: Canvas,
  width: number,
  r: SkiaRenderer
): void {
  r.strokePaint.setStyle(ck.PaintStyle.Stroke)
  r.strokePaint.setColor(hexToCKColor(ck, '#555555'))
  r.strokePaint.setStrokeWidth(1.5)
  canvas.drawLine(0, 0, width, 0, r.strokePaint)
}

export function inferMembraneType(compartmentName: string): MembraneType | null {
  const lower = compartmentName.toLowerCase()
  if (lower.includes('plasma') || (lower.includes('membrane') && !lower.includes('nuclear') && !lower.includes('mitochondr'))) return 'plasma'
  if (lower.includes('nuclear')) return 'nuclear'
  if (lower.includes('mitochondr')) return 'mitochondrial'
  if (lower.includes('inner')) return 'inner'
  return null
}
