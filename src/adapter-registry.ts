// adapter-registry.ts - Central registry for all adapters
import { z } from 'zod';
import { BuiltAdapter, EngineIO, SemVer, AdapterDef } from './adapter-core.ts';
import { validateHandlers } from './types/adapter.ts';

// Central registry map
const registry = new Map<string, AdapterDef>();

// Helper function to get adapter name and semver
function getAdapterInfo(def: AdapterDef): { name: string; semver: string } {
  return { name: def.manifest.name, semver: def.manifest.semver };
}

// Register a typed adapter with manifest and handlers
export function registerAdapter(def: AdapterDef): AdapterDef {
  const { name: adapterName, semver } = getAdapterInfo(def);

  if (registry.has(adapterName)) {
    throw new Error(`Duplicate adapter: ${adapterName}`);
  }

  // Validate semver format
  try {
    SemVer.parse(semver);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid semver for adapter '${adapterName}':\n${z.prettifyError(error)}`);
    }
    throw error;
  }

  // Validate handler compatibility with manifest
  try {
    validateHandlers(def.manifest, def.handlers);
  } catch (error) {
    throw new Error(`Handler validation failed for adapter '${adapterName}': ${error.message}`);
  }

  registry.set(adapterName, def);
  return def; // for tree-shaken side-effect registration
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
    const parsed = def.schema.parse(rawConfig);

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

export function getAdapterMeta(name: string): { name: string; semver: string } | null {
  const def = registry.get(name);
  return def ? getAdapterInfo(def) : null;
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
