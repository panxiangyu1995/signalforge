<script setup lang="ts">
import { useData } from 'vitepress'

const { page } = useData()

const isEnHome = page.value.relativePath === 'index.md'

const schema = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'SignalForge',
  applicationCategory: 'DesignApplication',
  operatingSystem: 'Windows, macOS, Linux, Web',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  url: 'https://app.signalforge.dev',
  description:
    'AI-native biological signaling pathway diagram editor. SBGN PD compliant with knowledge base integration and gene expression overlay.',
  softwareVersion: '0.13.2',
  license: 'https://opensource.org/licenses/MIT',
  screenshot: 'https://signalforge.dev/screenshot.png',
  downloadUrl: 'https://github.com/panxiangyu1995/signalforge/releases/latest',
  featureList: [
    'Generate SBGN pathways from natural language',
    'SBGN Process Description PD Level 1 Version 2.1',
    'Reactome and Pathway Commons knowledge base integration',
    'Gene expression data overlay on pathways',
    'SBGN-ML import and export with validation',
    'Open .fig files natively',
    '100+ AI design and pathway tools',
    'MCP server for AI coding agents',
    'P2P real-time collaboration',
    'Headless CLI for automation',
    'Desktop app via Tauri',
  ],
})
</script>

<template>
  <component :is="'script'" v-if="isEnHome" type="application/ld+json">{{ schema }}</component>
</template>
