import type { ToolDef } from '#core/tools/schema'
import { createPathway } from './create'
import {
  addEntity,
  addProcess,
  addArc,
  addCompartment,
  setStateVariable,
  setUnitOfInformation,
  setPathwayStyle
} from './modify'
import { autoLayoutPathway } from './layout'
import { queryPathwayDb } from './query'
import { validatePathway } from './validate'
import { importSbgnMl, exportSbgnMl } from './io'
import { removeArc, modifyArc } from './modify-arc'
import { setCloneMarker, addMultimer } from './clone'
import { annotatePathway } from './annotate'
import { mergePathway, splitPathway } from './merge'
import { setActiveState } from './active-state'
import { overlayExpressionData } from './overlay'
import { beginPathway, endPathway } from './batch'

export {
  createPathway,
  addEntity,
  addProcess,
  addArc,
  addCompartment,
  setStateVariable,
  setUnitOfInformation,
  setPathwayStyle,
  autoLayoutPathway,
  queryPathwayDb,
  validatePathway,
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
  overlayExpressionData,
  beginPathway,
  endPathway,
}

export const PATHWAY_TOOLS: ToolDef[] = [
  createPathway,
  addEntity,
  addProcess,
  addArc,
  addCompartment,
  setStateVariable,
  setUnitOfInformation,
  setPathwayStyle,
  autoLayoutPathway,
  queryPathwayDb,
  validatePathway,
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
  overlayExpressionData,
  beginPathway,
  endPathway,
]
