#!/usr/bin/env node
/**
 * Export Zod schemas to JSON Schema format for use in other systems (e.g., Kafka topics).
 *
 * This script converts EnrichedPositionSchema and EnrichedActionSchema to JSON Schema format
 * and writes them to JSON files that can be used for schema validation in external systems.
 *
 * Usage:
 *   pnpm run export-schemas
 *   or
 *   node dist/src/scripts/export-adapter-metadata.js
 */

import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { EnrichedPositionSchema, EnrichedActionSchema } from '../types/events.ts';
import { logger } from '../utils/logger.ts';

// Output directory for generated JSON schemas
const OUTPUT_DIR = path.join(process.cwd(), '_schemas');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Convert schemas to JSON Schema format
logger.info('Converting Zod schemas to JSON Schema...\n');

// Convert EnrichedPositionSchema
const positionJsonSchema = z.toJSONSchema(EnrichedPositionSchema, {
  target: 'draft-2020-12',
  unrepresentable: 'any', // Handle types that don't have JSON Schema equivalents
});

// Convert EnrichedActionSchema
const actionJsonSchema = z.toJSONSchema(EnrichedActionSchema, {
  target: 'draft-2020-12',
  unrepresentable: 'any',
});

// Write schemas to files
const positionSchemaPath = path.join(OUTPUT_DIR, 'enriched-position-schema.json');
const actionSchemaPath = path.join(OUTPUT_DIR, 'enriched-action-schema.json');

fs.writeFileSync(positionSchemaPath, JSON.stringify(positionJsonSchema, null, 2));
fs.writeFileSync(actionSchemaPath, JSON.stringify(actionJsonSchema, null, 2));

logger.info(`✅ EnrichedPositionSchema exported to: ${positionSchemaPath}`);
logger.info(`✅ EnrichedActionSchema exported to: ${actionSchemaPath}`);

// Also export a combined file with both schemas
const combinedSchemaPath = path.join(OUTPUT_DIR, 'event-schemas.json');
const combinedSchemas = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://absinthe.network/schemas/events.json',
  title: 'Absinthe Yada Event Schemas',
  description: 'JSON Schema definitions for enriched position and action events',
  schemas: {
    EnrichedPosition: positionJsonSchema,
    EnrichedAction: actionJsonSchema,
  },
};

fs.writeFileSync(combinedSchemaPath, JSON.stringify(combinedSchemas, null, 2));

logger.info(`✅ Combined schemas exported to: ${combinedSchemaPath}`);

logger.info('\n📦 Schema export complete!');
logger.info(`\nTo use these schemas in Kafka or other systems:`);
logger.info(`  - Position events: ${positionSchemaPath}`);
logger.info(`  - Action events: ${actionSchemaPath}`);
logger.info(`  - Combined: ${combinedSchemaPath}`);
