#!/usr/bin/env node
/**
 * Generate Adapter Catalog
 *
 * This script loads all adapters and generates a simple metadata JSON file
 * containing only human-readable information from adapter metadata.
 *
 * Usage:
 *   pnpm run generate-catalog
 *   or
 *   node dist/src/scripts/generate-adapter-catalog.js
 */

import * as fs from 'fs';
import * as path from 'path';
import { loadAllAdapters } from '../adapters/loader.ts';
import { getAllAdapters } from '../adapter-registry.ts';
import { logger } from '../utils/logger.ts';

// Output directory for generated catalog
const OUTPUT_DIR = path.join(process.cwd(), '_generated');

// Simple trackable entry
type TrackableEntry = {
  name: string;
  description: string;
};

// Simple adapter entry (only from metadata)
type AdapterCatalogEntry = {
  displayName: string;
  description: string;
  category?: string;
  tags?: string[];
  author: string;
  authorUrl?: string;
  authorIcon?: string;
  adapterIcon?: string;
  status?: string;
  compatibleWith?: string;
  createdAt: string;
  trackables: TrackableEntry[];
};

// Catalog structure
type AdapterCatalog = {
  version: string;
  generatedAt: string;
  adapters: Record<string, AdapterCatalogEntry>;
};

async function main() {
  logger.info('🔍 Loading all adapters...\n');

  // Read package.json to get version
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  const version = packageJson.version;

  logger.info(`📦 Using version: ${version}\n`);

  // Load all adapters (this registers them in the registry)
  await loadAllAdapters();

  // Get all registered adapters
  const adapters = getAllAdapters();

  logger.info(`📦 Found ${adapters.size} adapters\n`);

  // Build the catalog
  const catalog: AdapterCatalog = {
    version,
    generatedAt: new Date().toISOString(),
    adapters: {},
  };

  for (const [adapterId, adapterDef] of adapters) {
    logger.info(`  Processing: ${adapterId}`);

    const metadata = adapterDef.metadata;

    // Convert trackables from object to array
    const trackables: TrackableEntry[] = [];
    if (metadata.trackables) {
      for (const [trackableId, trackableMeta] of Object.entries(metadata.trackables)) {
        trackables.push({
          name: trackableMeta.displayName,
          description: trackableMeta.description,
        });
      }
    }

    catalog.adapters[adapterId] = {
      displayName: metadata.displayName,
      description: metadata.description,
      category: metadata.category,
      tags: metadata.tags,
      author: metadata.author,
      authorUrl: metadata.authorUrl,
      authorIcon: metadata.authorIcon,
      adapterIcon: metadata.adapterIcon,
      status: metadata.status,
      compatibleWith: metadata.compatibleWith,
      createdAt: metadata.createdAt,
      trackables,
    };
  }

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Write the catalog
  const catalogPath = path.join(OUTPUT_DIR, 'adapter-catalog.json');
  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));

  logger.info(`\n✅ Adapter catalog generated: ${catalogPath}`);
  logger.info(`   Total adapters: ${Object.keys(catalog.adapters).length}`);
}

main().catch((err) => {
  logger.error('Failed to generate adapter catalog:', err);
  process.exit(1);
});
