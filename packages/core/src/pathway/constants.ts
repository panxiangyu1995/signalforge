export const SBGN_STYLE = {
  nodeBackgroundColor: '#f6f6f6',
  nodeBorderColor: '#555',
  edgeLineColor: '#555',
  associationFill: '#6B6B6B',
  selectionColor: '#d67614',
  cloneMarkerFill: '#838383',
  cloneMarkerStroke: '#6A6A6A',
  separatorLineColor: '#6A6A6A',
  infoboxBorderColor: '#555555',
  infoboxFill: 'white',
  sourceSinkStroke: '#6A6A6A',
  dissociationStroke: '#6A6A6A',

  defaultBorderWidth: 1.5,
  entityBorderWidth: 2,
  complexBorderWidth: 4,
  compartmentBorderWidth: 4,
  edgeLineWidth: 1.5,
  cloneMarkerStrokeWidth: 1.5,
  infoboxBorderWidth: 2,
  separatorLineWidth: 1,
  complexSeparatorWidth: 6,
  compartmentSeparatorWidth: 6,

  nodeFontSize: 20,
  infoboxFontSize: 10,
  infoboxFontFamily: 'Helvetica Neue, Helvetica, sans-serif',
  textOutlineColor: 'white',
  textOutlineWidth: 0.75,

  macromolecule: { width: 96, height: 48 },
  simpleChemical: { width: 48, height: 48 },
  nucleicAcidFeature: { width: 88, height: 56 },
  complex: { width: 10, height: 10 },
  compartment: { width: 50, height: 50 },
  perturbation: { width: 140, height: 60 },
  phenotype: { width: 140, height: 60 },
  sourceSink: { width: 60, height: 60 },
  unspecifiedEntity: { width: 32, height: 32 },
  process: { width: 25, height: 25 },
  association: { width: 25, height: 25 },
  dissociation: { width: 25, height: 25 },
  andOrNot: { width: 40, height: 40 },
  tag: { width: 100, height: 65 },

  macromoleculeCornerRadius: 0.04,
  simpleChemicalCornerRadius: 'full' as const,
  nucleicAcidBottomCornerRadius: 0.3,
  complexCornerCutLength: 24,
  compartmentPadding: 38,
  complexPadding: 22,
  entityPadding: 8,

  multimerPadding: 5,

  activePadding: 5,
  activeDashPattern: [3, 6],

  arrowScale: 1.5,

  idealEdgeLength: 50,
  nodeRepulsion: 4500,
  nodeSeparation: 75,
  layoutPadding: 30,
} as const

export const PUBLICATION_STYLE = {
  entityFills: {
    macromolecule: '#D4E6F1',
    simple_chemical: '#FADBD8',
    nucleic_acid_feature: '#D5F5E3',
    complex: '#E8DAEF',
    perturbation: '#D1F2EB',
    phenotype: '#FEF9E7',
    source_sink: '#F2F3F4',
    unspecified_entity: '#F2F3F4',
  },

  entityGradients: {
    macromolecule: { top: '#D4E6F1', bottom: '#A9CCE3' },
    simple_chemical: { top: '#FADBD8', bottom: '#F5B7B1' },
    nucleic_acid_feature: { top: '#D5F5E3', bottom: '#ABEBC6' },
    complex: { top: '#E8DAEF', bottom: '#D2B4DE' },
    perturbation: { top: '#D1F2EB', bottom: '#A3E4D7' },
    phenotype: { top: '#FEF9E7', bottom: '#F9E79F' },
    source_sink: { top: '#F2F3F4', bottom: '#D5D8DC' },
    unspecified_entity: { top: '#F2F3F4', bottom: '#D5D8DC' },
  },

  compartmentFills: {
    extracellular: 'rgba(173, 216, 230, 0.12)',
    membrane: 'rgba(255, 193, 7, 0.15)',
    cytoplasm: 'rgba(200, 230, 201, 0.10)',
    nucleus: 'rgba(206, 147, 216, 0.10)',
    mitochondria: 'rgba(255, 183, 77, 0.10)',
    endoplasmic_reticulum: 'rgba(129, 199, 132, 0.10)',
    golgi: 'rgba(255, 138, 101, 0.10)',
    default: 'rgba(0, 0, 0, 0.03)',
  },

  compartmentGradients: {
    extracellular: { top: 'rgba(173, 216, 230, 0.15)', bottom: 'rgba(173, 216, 230, 0.08)' },
    membrane: { top: 'rgba(255, 193, 7, 0.18)', bottom: 'rgba(255, 193, 7, 0.10)' },
    cytoplasm: { top: 'rgba(200, 230, 201, 0.13)', bottom: 'rgba(200, 230, 201, 0.06)' },
    nucleus: { top: 'rgba(206, 147, 216, 0.13)', bottom: 'rgba(206, 147, 216, 0.06)' },
    mitochondria: { top: 'rgba(255, 183, 77, 0.13)', bottom: 'rgba(255, 183, 77, 0.06)' },
    endoplasmic_reticulum: { top: 'rgba(129, 199, 132, 0.13)', bottom: 'rgba(129, 199, 132, 0.06)' },
    golgi: { top: 'rgba(255, 138, 101, 0.13)', bottom: 'rgba(255, 138, 101, 0.06)' },
    default: { top: 'rgba(0, 0, 0, 0.04)', bottom: 'rgba(0, 0, 0, 0.02)' },
  },

  entityBorders: {
    macromolecule: '#5B9BD5',
    simple_chemical: '#E74C3C',
    nucleic_acid_feature: '#27AE60',
    complex: '#8E44AD',
    perturbation: '#16A085',
    phenotype: '#F39C12',
    source_sink: '#6A6A6A',
    unspecified_entity: '#555',
    default: '#555',
  },

  edgeColors: {
    activation: '#5B9BD5',
    inhibition: '#E74C3C',
    catalysis: '#27AE60',
    default: '#555',
  },

  dropShadow: {
    offsetX: 1,
    offsetY: 2,
    blur: 3,
    color: 'rgba(0, 0, 0, 0.15)',
  },

  compartmentShadow: {
    offsetX: 2,
    offsetY: 4,
    blur: 8,
    color: 'rgba(0, 0, 0, 0.08)',
  },
} as const

export const REALISTIC_STYLE = {
  entityFills: {
    macromolecule: '#A8D8F0',
    simple_chemical: '#F5B7B1',
    nucleic_acid_feature: '#A9DFBF',
    complex: '#D2B4DE',
    perturbation: '#A3E4D7',
    phenotype: '#F9E79F',
    source_sink: '#D5D8DC',
    unspecified_entity: '#D5D8DC',
  },

  entityRadialGradients: {
    macromolecule: { cx: 0.35, cy: 0.3, stops: ['#C5E8F7', '#85C1E9', '#5DADE2', '#2E86C1'] },
    simple_chemical: { cx: 0.35, cy: 0.3, stops: ['#FADBD8', '#F1948A', '#E74C3C', '#C0392B'] },
    nucleic_acid_feature: { cx: 0.35, cy: 0.3, stops: ['#D5F5E3', '#82E0AA', '#27AE60', '#1E8449'] },
    complex: { cx: 0.35, cy: 0.3, stops: ['#E8DAEF', '#C39BD3', '#8E44AD', '#6C3483'] },
    perturbation: { cx: 0.35, cy: 0.3, stops: ['#D1F2EB', '#76D7C4', '#16A085', '#0E6655'] },
    phenotype: { cx: 0.35, cy: 0.3, stops: ['#FEF9E7', '#F9E79F', '#F39C12', '#D68910'] },
    source_sink: { cx: 0.35, cy: 0.3, stops: ['#F2F3F4', '#D5D8DC', '#6A6A6A', '#4A4A4A'] },
    unspecified_entity: { cx: 0.35, cy: 0.3, stops: ['#F2F3F4', '#D5D8DC', '#6A6A6A', '#4A4A4A'] },
  },

  entityBorders: {
    macromolecule: '#2E86C1',
    simple_chemical: '#C0392B',
    nucleic_acid_feature: '#1E8449',
    complex: '#6C3483',
    perturbation: '#0E6655',
    phenotype: '#D68910',
    source_sink: '#4A4A4A',
    unspecified_entity: '#4A4A4A',
    default: '#4A4A4A',
  },

  highlightColor: 'rgba(255, 255, 255, 0.4)',
  innerShadow: {
    offsetX: 1,
    offsetY: 2,
    blur: 4,
    color: 'rgba(0, 0, 0, 0.15)',
  },
  bevelTopColor: 'rgba(255, 255, 255, 0.3)',
  bevelBottomColor: 'rgba(0, 0, 0, 0.2)',

  dropShadow: {
    offsetX: 3,
    offsetY: 6,
    blur: 12,
    color: 'rgba(0, 0, 0, 0.25)',
  },

  compartmentShadow: {
    offsetX: 3,
    offsetY: 6,
    blur: 12,
    color: 'rgba(0, 0, 0, 0.12)',
  },

  compartmentGradients: {
    extracellular: { top: 'rgba(173, 216, 230, 0.22)', bottom: 'rgba(173, 216, 230, 0.12)' },
    membrane: { top: 'rgba(255, 193, 7, 0.25)', bottom: 'rgba(255, 193, 7, 0.15)' },
    cytoplasm: { top: 'rgba(200, 230, 201, 0.20)', bottom: 'rgba(200, 230, 201, 0.10)' },
    nucleus: { top: 'rgba(206, 147, 216, 0.20)', bottom: 'rgba(206, 147, 216, 0.10)' },
    mitochondria: { top: 'rgba(255, 183, 77, 0.20)', bottom: 'rgba(255, 183, 77, 0.10)' },
    endoplasmic_reticulum: { top: 'rgba(129, 199, 132, 0.20)', bottom: 'rgba(129, 199, 132, 0.10)' },
    golgi: { top: 'rgba(255, 138, 101, 0.20)', bottom: 'rgba(255, 138, 101, 0.10)' },
    default: { top: 'rgba(0, 0, 0, 0.06)', bottom: 'rgba(0, 0, 0, 0.03)' },
  },

  edgeColors: {
    activation: '#2E86C1',
    inhibition: '#C0392B',
    catalysis: '#1E8449',
    default: '#4A4A4A',
  },

  arcWidth: 2.5,
  decorationScale: 2.0,
  borderWidth: 2,

  textOutline: {
    color: 'white',
    width: 2,
  },
} as const

export type PathwayStyle = 'sbgn' | 'publication' | 'realistic'
