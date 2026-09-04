import { evalCode } from '#core/tools/analyze'
import { calc } from '#core/tools/calc'
import { createPage, render } from '#core/tools/create'
import { describe } from '#core/tools/describe'
import {
  setFill,
  setLayout,
  setLayoutChild,
  setLocked,
  setOpacity,
  setStroke,
  setText,
  setTextProperties,
  setVisible,
  updateNode
} from '#core/tools/modify'
import {
  addArc,
  addCompartment,
  addEntity,
  addMultimer,
  addProcess,
  annotatePathway,
  autoLayoutPathway,
  beginPathway,
  createPathway,
  endPathway,
  exportSbgnMl,
  importSbgnMl,
  mergePathway,
  modifyArc,
  overlayExpressionData,
  queryPathwayDb,
  removeArc,
  setActiveState,
  setCloneMarker,
  setPathwayStyle,
  setStateVariable,
  setUnitOfInformation,
  splitPathway,
  validatePathway
} from '#core/tools/pathway'
import {
  findNodes,
  getCurrentPage,
  getJsx,
  getNode,
  getPageTree,
  getSelection,
  listPages,
  selectNodes,
  switchPage
} from '#core/tools/read'
import type { ToolDef } from '#core/tools/schema'
import {
  batchUpdate,
  cloneNode,
  deleteNode,
  groupNodes,
  nodeAncestors,
  nodeBounds,
  nodeChildren,
  nodeMove,
  nodeResize,
  nodeTree,
  reparentNode,
  renameNode,
  ungroupNode
} from '#core/tools/structure'
import { exportImage, exportPdf, exportSvg, viewportZoomToFit } from '#core/tools/vector'

export const BIOPATH_CORE_TOOLS: ToolDef[] = [
  getSelection,
  getNode,
  findNodes,
  getPageTree,
  getCurrentPage,
  listPages,
  selectNodes,
  switchPage,
  createPage,
  updateNode,
  deleteNode,
  reparentNode,
  nodeResize,
  nodeMove,
  renameNode,
  nodeBounds,
  nodeChildren,
  nodeTree,
  viewportZoomToFit,
  calc,
  exportSvg,
  exportPdf,
  exportImage,
  createPathway,
  beginPathway,
  endPathway,
  addEntity,
  addProcess,
  addArc,
  addCompartment,
  setStateVariable,
  setUnitOfInformation,
  setPathwayStyle,
  validatePathway,
  autoLayoutPathway,
  queryPathwayDb
]

export const BIOPATH_EXTENDED_TOOLS: ToolDef[] = [
  getJsx,
  render,
  setFill,
  setStroke,
  setText,
  setTextProperties,
  setOpacity,
  setVisible,
  setLocked,
  setLayout,
  setLayoutChild,
  batchUpdate,
  cloneNode,
  groupNodes,
  ungroupNode,
  nodeAncestors,
  describe,
  evalCode,
  importSbgnMl,
  exportSbgnMl,
  removeArc,
  modifyArc,
  setCloneMarker,
  addMultimer,
  annotatePathway,
  mergePathway,
  splitPathway,
  setActiveState,
  overlayExpressionData
]

export const BIOPATH_TOOLS: ToolDef[] = [...BIOPATH_CORE_TOOLS, ...BIOPATH_EXTENDED_TOOLS]
