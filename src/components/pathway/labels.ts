import type { PathwayGlyphType, PathwayProcessType, PathwayArcType } from '@signal-forge/scene-graph'

export const GLYPH_TYPE_LABELS: Record<PathwayGlyphType, string> = {
  macromolecule: 'Protein',
  simple_chemical: 'Small Molecule',
  complex: 'Complex',
  nucleic_acid_feature: 'Gene/RNA',
  unspecified_entity: 'Unknown',
  perturbation: 'Drug',
  phenotype: 'Phenotype',
  source_sink: 'Degradation',
}

export const PROCESS_TYPE_LABELS: Record<PathwayProcessType, string> = {
  process: 'Reaction',
  transport: 'Transport',
  association: 'Association',
  dissociation: 'Dissociation',
  omitted_process: 'Omitted',
  uncertain_process: 'Uncertain',
}

export const ARC_TYPE_LABELS: Record<PathwayArcType, string> = {
  consumption: 'Consumption',
  production: 'Production',
  modulation: 'Modulation',
  stimulation: 'Stimulation',
  catalysis: 'Catalysis',
  inhibition: 'Inhibition',
  necessary_stimulation: 'Nec. Stimulation',
  trigger: 'Trigger',
  logic_and: 'Logic AND',
  logic_or: 'Logic OR',
  logic_not: 'Logic NOT',
  equivalence: 'Equivalence',
}

export const GLYPH_PALETTE_ENTITIES: { type: PathwayGlyphType; label: string }[] = [
  { type: 'macromolecule', label: GLYPH_TYPE_LABELS.macromolecule },
  { type: 'simple_chemical', label: GLYPH_TYPE_LABELS.simple_chemical },
  { type: 'complex', label: GLYPH_TYPE_LABELS.complex },
  { type: 'nucleic_acid_feature', label: GLYPH_TYPE_LABELS.nucleic_acid_feature },
  { type: 'perturbation', label: GLYPH_TYPE_LABELS.perturbation },
  { type: 'phenotype', label: GLYPH_TYPE_LABELS.phenotype },
  { type: 'source_sink', label: GLYPH_TYPE_LABELS.source_sink },
  { type: 'unspecified_entity', label: GLYPH_TYPE_LABELS.unspecified_entity },
]

export const GLYPH_PALETTE_PROCESSES: { type: PathwayProcessType; label: string }[] = [
  { type: 'process', label: PROCESS_TYPE_LABELS.process },
  { type: 'transport', label: PROCESS_TYPE_LABELS.transport },
  { type: 'association', label: PROCESS_TYPE_LABELS.association },
  { type: 'dissociation', label: PROCESS_TYPE_LABELS.dissociation },
  { type: 'omitted_process', label: PROCESS_TYPE_LABELS.omitted_process },
  { type: 'uncertain_process', label: PROCESS_TYPE_LABELS.uncertain_process },
]

export const GLYPH_PALETTE_ARCS: { type: PathwayArcType; label: string }[] = [
  { type: 'production', label: ARC_TYPE_LABELS.production },
  { type: 'consumption', label: ARC_TYPE_LABELS.consumption },
  { type: 'catalysis', label: ARC_TYPE_LABELS.catalysis },
  { type: 'inhibition', label: ARC_TYPE_LABELS.inhibition },
  { type: 'stimulation', label: ARC_TYPE_LABELS.stimulation },
  { type: 'necessary_stimulation', label: ARC_TYPE_LABELS.necessary_stimulation },
  { type: 'modulation', label: ARC_TYPE_LABELS.modulation },
  { type: 'trigger', label: ARC_TYPE_LABELS.trigger },
  { type: 'logic_and', label: ARC_TYPE_LABELS.logic_and },
  { type: 'logic_or', label: ARC_TYPE_LABELS.logic_or },
  { type: 'logic_not', label: ARC_TYPE_LABELS.logic_not },
  { type: 'equivalence', label: ARC_TYPE_LABELS.equivalence },
]
