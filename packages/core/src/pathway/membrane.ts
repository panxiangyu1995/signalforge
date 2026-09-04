import type { Canvas, CanvasKit } from 'canvaskit-wasm'

import type { SceneNode } from '@signal-forge/scene-graph'

import type { SkiaRenderer } from '#core/canvas/renderer'

import { REALISTIC_STYLE } from './constants'
import { hexToCKColor } from './utils'

export type MembraneType = 'plasma' | 'nuclear' | 'mitochondrial' | 'inner'

interface BeadStyle {
  readonly highlight: string
  readonly mid: string
  readonly edge: string
  readonly outline: string
}

const PLASMA_BEAD_OUTER: BeadStyle = {
  highlight: '#FFF0C4',
  mid: '#E8B54B',
  edge: '#A87B2E',
  outline: '#8A6320'
}

const PLASMA_BEAD_INNER: BeadStyle = {
  highlight: '#F5D98F',
  mid: '#D19A38',
  edge: '#8F6823',
  outline: '#715018'
}

const NUCLEAR_BEAD: BeadStyle = {
  highlight: '#E8DCF5',
  mid: '#9B7FC4',
  edge: '#6B4E94',
  outline: '#553C7A'
}

/**
 * One row of phospholipid head beads with a per-bead radial highlight.
 * The shader is defined around the first bead and rides along with the
 * canvas translate, so every bead gets its own upper-left hotspot without
 * allocating one shader per bead.
 */
function paintBeadRow(
  ck: CanvasKit,
  canvas: Canvas,
  width: number,
  y: number,
  headR: number,
  bead: BeadStyle,
  r: SkiaRenderer
): void {
  const spacing = headR * 2.6
  const shader = ck.Shader.MakeRadialGradient(
    [-headR * 0.35, y - headR * 0.35],
    headR * 1.55,
    [hexToCKColor(ck, bead.highlight), hexToCKColor(ck, bead.mid), hexToCKColor(ck, bead.edge)],
    [0, 0.55, 1],
    ck.TileMode.Clamp
  )

  r.fillPaint.setStyle(ck.PaintStyle.Fill)
  r.fillPaint.setShader(shader)
  r.strokePaint.setStyle(ck.PaintStyle.Stroke)
  r.strokePaint.setStrokeWidth(1)
  r.strokePaint.setColor(hexToCKColor(ck, bead.outline))

  canvas.save()
  try {
    canvas.translate(headR + 1, 0)
    for (let x = headR + 1; x < width - headR; x += spacing) {
      canvas.drawCircle(0, y, headR, r.fillPaint)
      canvas.drawCircle(0, y, headR, r.strokePaint)
      canvas.translate(spacing, 0)
    }
  } finally {
    canvas.restore()
  }

  r.fillPaint.setShader(null)
  shader.delete()
}

/**
 * Renders cross-section style membranes along the top edge of a compartment,
 * spanning the full width. Coordinates are local to the compartment origin:
 * the bilayer straddles y=0 so the head-bead rows sit just above and below
 * the compartment boundary.
 */
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

/**
 * Phospholipid bilayer: light amber tail zone, two backbone lines, and two
 * rows of phospholipid head beads — the classic illustration cross-section.
 */
function paintPlasmaMembrane(
  ck: CanvasKit,
  canvas: Canvas,
  width: number,
  r: SkiaRenderer
): void {
  const headR = 3.6
  const halfGap = 6

  // Tail zone between the two head rows.
  r.fillPaint.setStyle(ck.PaintStyle.Fill)
  r.fillPaint.setColor(hexToCKColor(ck, 'rgba(232, 181, 75, 0.22)'))
  canvas.drawRect(ck.LTRBRect(0, -halfGap, width, halfGap), r.fillPaint)

  paintBeadRow(ck, canvas, width, -halfGap, headR, PLASMA_BEAD_OUTER, r)
  paintBeadRow(ck, canvas, width, halfGap, headR, PLASMA_BEAD_INNER, r)
}

function paintNuclearMembrane(
  ck: CanvasKit,
  canvas: Canvas,
  width: number,
  r: SkiaRenderer
): void {
  const headR = 2.5
  const halfGap = 4.5

  r.fillPaint.setStyle(ck.PaintStyle.Fill)
  r.fillPaint.setColor(hexToCKColor(ck, 'rgba(155, 127, 196, 0.16)'))
  canvas.drawRect(ck.LTRBRect(0, -halfGap, width, halfGap), r.fillPaint)

  paintBeadRow(ck, canvas, width, -halfGap, headR, NUCLEAR_BEAD, r)
  paintBeadRow(ck, canvas, width, halfGap, headR, NUCLEAR_BEAD, r)
}

function paintMitochondrialMembrane(
  ck: CanvasKit,
  canvas: Canvas,
  width: number,
  height: number,
  r: SkiaRenderer
): void {
  r.strokePaint.setStyle(ck.PaintStyle.Stroke)
  r.strokePaint.setColor(hexToCKColor(ck, '#B5722F'))
  r.strokePaint.setStrokeWidth(2.5)

  canvas.drawLine(0, 0, width, 0, r.strokePaint)

  // Inner membrane with cristae bulging into the matrix.
  const innerY = 8
  const cristaePeriod = 30
  const cristaeDepth = Math.min(9, Math.max(5, height * 0.03))

  r.strokePaint.setStrokeWidth(1.5)
  r.strokePaint.setColor(hexToCKColor(ck, 'rgba(155, 100, 45, 0.85)'))
  canvas.drawLine(0, innerY, width, innerY, r.strokePaint)

  r.strokePaint.setStrokeWidth(1.2)
  for (let x = cristaePeriod / 2; x < width - cristaePeriod / 2; x += cristaePeriod) {
    const crista = new ck.Path()
    try {
      crista.moveTo(x - 6, innerY)
      crista.quadTo(x - 6, innerY + cristaeDepth, x, innerY + cristaeDepth)
      crista.quadTo(x + 6, innerY + cristaeDepth, x + 6, innerY)
      canvas.drawPath(crista, r.strokePaint)
    } finally {
      crista.delete()
    }
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

/**
 * Mitochondrion rendered as the classic illustration organelle: a deep red
 * ellipsoid body with a warm radial core and wavy cristae folded into the
 * matrix. Compartment contents (proteins) are painted on top by the caller.
 */
export function paintMitochondrionBody(
  ck: CanvasKit,
  canvas: Canvas,
  width: number,
  height: number,
  r: SkiaRenderer
): void {
  if (width <= 0 || height <= 0) return
  const oval = new ck.Path()
  try {
    oval.addOval(ck.LTRBRect(0, 0, width, height), false, 1)

    const coreShader = ck.Shader.MakeRadialGradient(
      [width / 2, height / 2],
      Math.max(width, height) * 0.62,
      [
        hexToCKColor(ck, '#C0522E'),
        hexToCKColor(ck, '#A63A22'),
        hexToCKColor(ck, '#7A2E1E')
      ],
      [0, 0.55, 1],
      ck.TileMode.Clamp
    )
    r.fillPaint.setStyle(ck.PaintStyle.Fill)
    r.fillPaint.setShader(coreShader)
    canvas.drawPath(oval, r.fillPaint)
    r.fillPaint.setShader(null)
    coreShader.delete()

    const ds = REALISTIC_STYLE.compartmentShadow
    const shadowFilter = ck.ImageFilter.MakeDropShadow(
      ds.offsetX,
      ds.offsetY,
      ds.blur,
      ds.blur,
      hexToCKColor(ck, ds.color),
      null
    )
    r.strokePaint.setStyle(ck.PaintStyle.Stroke)
    r.strokePaint.setColor(hexToCKColor(ck, '#5E1F12'))
    r.strokePaint.setStrokeWidth(2.5)
    r.strokePaint.setImageFilter(shadowFilter)
    canvas.drawPath(oval, r.strokePaint)
    r.strokePaint.setImageFilter(null)
    shadowFilter.delete()

    // Cristae: wavy folds into the matrix, clipped to the body.
    canvas.save()
    canvas.clipPath(oval, ck.ClipOp.Intersect, true)
    r.strokePaint.setStrokeWidth(2.4)
    r.strokePaint.setColor(hexToCKColor(ck, 'rgba(94, 31, 18, 0.75)'))
    const period = 26
    const amp = Math.min(10, height * 0.09)
    for (let i = 1; i <= 5; i++) {
      const y = (height / 6) * i
      const crista = cristaPath(ck, width, y, amp, period)
      try {
        canvas.drawPath(crista, r.strokePaint)
      } finally {
        crista.delete()
      }
    }
    canvas.restore()
  } finally {
    oval.delete()
  }
}

function cristaPath(ck: CanvasKit, width: number, y: number, amp: number, period: number) {
  const path = new ck.Path()
  path.moveTo(0, y)
  let up = true
  for (let x = 0; x < width; x += period) {
    path.quadTo(x + period / 2, y + (up ? -amp : amp), x + period, y)
    up = !up
  }
  return path
}

export function inferMembraneType(compartmentName: string): MembraneType | null {
  const lower = compartmentName.toLowerCase()
  if (lower.includes('plasma') || (lower.includes('membrane') && !lower.includes('nucle') && !lower.includes('mitochondr'))) return 'plasma'
  if (lower.includes('nucle')) return 'nuclear'
  if (lower.includes('mitochondr')) return 'mitochondrial'
  if (lower.includes('inner')) return 'inner'
  return null
}
