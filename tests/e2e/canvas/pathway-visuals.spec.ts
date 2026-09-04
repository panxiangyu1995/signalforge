import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

test('pathway realistic glyph, process and arc styles', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('SignalForge store not initialized')
    const pageId = store.state.currentPageId

    function pathwayData(value: Record<string, unknown>) {
      return [{ pluginId: 'signal-forge', key: 'pathway', value: JSON.stringify(value) }]
    }

    store.graph.createNode('PATHWAY_GLYPH', pageId, {
      name: 'EGFR',
      x: 60,
      y: 60,
      width: 96,
      height: 48,
      pluginData: pathwayData({ glyphType: 'macromolecule' })
    })
    store.graph.createNode('PATHWAY_GLYPH', pageId, {
      name: 'ATP',
      x: 200,
      y: 60,
      width: 48,
      height: 48,
      pluginData: pathwayData({ glyphType: 'simple_chemical' })
    })
    store.graph.createNode('PATHWAY_GLYPH', pageId, {
      name: 'Complex',
      x: 290,
      y: 52,
      width: 120,
      height: 64,
      pluginData: pathwayData({ glyphType: 'complex' })
    })
    store.graph.createNode('PATHWAY_GLYPH', pageId, {
      name: 'STAT3',
      x: 450,
      y: 56,
      width: 88,
      height: 56,
      pluginData: pathwayData({ glyphType: 'nucleic_acid_feature' })
    })
    store.graph.createNode('PATHWAY_GLYPH', pageId, {
      name: 'Proliferation',
      x: 580,
      y: 54,
      width: 140,
      height: 60,
      pluginData: pathwayData({ glyphType: 'phenotype' })
    })
    store.graph.createNode('PATHWAY_GLYPH', pageId, {
      name: 'Drug',
      x: 760,
      y: 54,
      width: 140,
      height: 60,
      pluginData: pathwayData({ glyphType: 'perturbation' })
    })
    store.graph.createNode('PATHWAY_GLYPH', pageId, {
      name: 'Source',
      x: 940,
      y: 54,
      width: 60,
      height: 60,
      pluginData: pathwayData({ glyphType: 'source_sink' })
    })

    store.graph.createNode('PATHWAY_PROCESS', pageId, {
      name: 'Reaction',
      x: 60,
      y: 190,
      width: 25,
      height: 25,
      pluginData: pathwayData({ processType: 'process' })
    })
    store.graph.createNode('PATHWAY_PROCESS', pageId, {
      name: 'Transport',
      x: 130,
      y: 188,
      width: 30,
      height: 30,
      pluginData: pathwayData({ processType: 'transport' })
    })
    store.graph.createNode('PATHWAY_PROCESS', pageId, {
      name: 'Association',
      x: 200,
      y: 190,
      width: 25,
      height: 25,
      pluginData: pathwayData({ processType: 'association' })
    })
    store.graph.createNode('PATHWAY_PROCESS', pageId, {
      name: 'Dissociation',
      x: 265,
      y: 188,
      width: 30,
      height: 30,
      pluginData: pathwayData({ processType: 'dissociation' })
    })

    store.graph.createNode('COMPARTMENT', pageId, {
      name: 'cytoplasm',
      x: 60,
      y: 280,
      width: 620,
      height: 260
    })

    const ras = store.graph.createNode('PATHWAY_GLYPH', pageId, {
      name: 'RAS',
      x: 110,
      y: 330,
      width: 96,
      height: 48,
      pluginData: pathwayData({ glyphType: 'macromolecule' })
    })
    const reaction = store.graph.createNode('PATHWAY_PROCESS', pageId, {
      name: 'Reaction',
      x: 300,
      y: 342,
      width: 25,
      height: 25,
      pluginData: pathwayData({ processType: 'process' })
    })
    const raf = store.graph.createNode('PATHWAY_GLYPH', pageId, {
      name: 'RAF',
      x: 420,
      y: 330,
      width: 96,
      height: 48,
      pluginData: pathwayData({ glyphType: 'macromolecule' })
    })
    const gtp = store.graph.createNode('PATHWAY_GLYPH', pageId, {
      name: 'GTP',
      x: 250,
      y: 440,
      width: 48,
      height: 48,
      pluginData: pathwayData({ glyphType: 'simple_chemical' })
    })
    const outcome = store.graph.createNode('PATHWAY_GLYPH', pageId, {
      name: 'Growth',
      x: 470,
      y: 420,
      width: 140,
      height: 60,
      pluginData: pathwayData({ glyphType: 'phenotype' })
    })

    store.graph.createNode('PATHWAY_ARC', pageId, {
      name: 'Consumption',
      pluginData: pathwayData({ arcType: 'consumption', sourceId: ras.id, targetId: reaction.id })
    })
    store.graph.createNode('PATHWAY_ARC', pageId, {
      name: 'Production',
      pluginData: pathwayData({ arcType: 'production', sourceId: reaction.id, targetId: raf.id })
    })
    store.graph.createNode('PATHWAY_ARC', pageId, {
      name: 'Catalysis',
      pluginData: pathwayData({ arcType: 'catalysis', sourceId: gtp.id, targetId: reaction.id })
    })
    store.graph.createNode('PATHWAY_ARC', pageId, {
      name: 'Stimulation',
      pluginData: pathwayData({ arcType: 'stimulation', sourceId: raf.id, targetId: outcome.id })
    })

    const drug = store.graph.createNode('PATHWAY_GLYPH', pageId, {
      name: 'Inhibitor',
      x: 760,
      y: 190,
      width: 140,
      height: 60,
      pluginData: pathwayData({ glyphType: 'perturbation' })
    })
    store.graph.createNode('PATHWAY_ARC', pageId, {
      name: 'Inhibition',
      pluginData: pathwayData({ arcType: 'inhibition', sourceId: drug.id, targetId: raf.id })
    })

    store.clearSelection()
    store.requestRender()
  })
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  const buffer = await editor.canvas.canvas.screenshot()
  expect(buffer).toMatchSnapshot('pathway-realistic-style.png')
})
