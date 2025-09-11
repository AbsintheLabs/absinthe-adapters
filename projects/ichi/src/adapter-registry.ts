// adapter-registry.ts - Central registry for all adapters
import { z } from 'zod';
import { defineAdapter, AdapterDef, BuiltAdapter, EngineIO, SemVer } from './adapter-core';

// Type for any adapter definition
type AnyDef = AdapterDef<any>;

// Central registry map
const registry = new Map<string, AnyDef>();

// Register an adapter in the central registry
export function registerAdapter<D extends AnyDef>(def: D) {
  if (registry.has(def.name)) {
    throw new Error(`Duplicate adapter: ${def.name}`);
  }

  // Validate semver format
  SemVer.parse(def.semver);

  // Automatically inject the name as a literal into the schema
  const enhancedDef = {
    ...def,
    schema: def.schema.extend({
      kind: z.literal(def.name),
    }),
  };

  registry.set(def.name, enhancedDef);
  return enhancedDef; // for tree-shaken side-effect registration
}

// Build an adapter by name with runtime validation
export function buildAdapter(name: string, rawConfig: unknown, io: EngineIO): BuiltAdapter {
  const def = registry.get(name);
  if (!def) {
    const available = Array.from(registry.keys()).join(', ');
    throw new Error(`Unknown adapter: ${name}. Available adapters: ${available}`);
  }

  try {
    // Parse and validate the config using the adapter's schema
    const parsed = def.schema.strict().parse(rawConfig);
    // Build the adapter with validated params
    const built = def.build({ params: parsed, io });

    return built;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid configuration for adapter '${name}':\n${z.prettifyError(error)}`);
    }
    throw new Error(
      `Failed to build adapter '${name}': ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// Get available adapter names
export function getAvailableAdapters(): string[] {
  return Array.from(registry.keys());
}

// Get adapter schema for documentation/validation
export function getAdapterSchema(name: string) {
  return registry.get(name)?.schema;
}

// List all adapters with their schemas
export function listAdapters(): Array<{ name: string; schema: z.ZodTypeAny }> {
  return Array.from(registry.entries()).map(([name, def]) => ({
    name,
    schema: def.schema,
  }));
}
