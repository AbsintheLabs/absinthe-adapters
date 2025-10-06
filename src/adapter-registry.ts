// adapter-registry.ts - Simplified registry for manifest-based adapters
import { EngineIO, BuiltAdapter } from './adapter-core.ts';
import { AdapterMetadata, ConfigFromManifest, Manifest } from './types/manifest.ts';
import { validateConfigAgainstManifest } from './config/validation.ts'; // you'll need this

// Central registry map: adapterId -> AdapterDef
const registry = new Map<string, AdapterDef<Manifest>>();

/** Adapter definition combining manifest with build function */
export type AdapterDef<M extends Manifest> = {
  manifest: M;
  build: (opts: { config: ConfigFromManifest<M>; io: EngineIO }) => BuiltAdapter;
};

export function defineAdapter<const M extends Manifest>(def: {
  manifest: M;
  metadata: AdapterMetadata;
  build: (opts: { config: ConfigFromManifest<M>; io: EngineIO }) => BuiltAdapter;
}): AdapterDef<M> {
  const adapterDef = def as AdapterDef<M>;

  // Register immediately as side effect
  registerAdapter(adapterDef);

  return adapterDef;
}

// Register an adapter (called by each adapter's loader)
function registerAdapter(def: AdapterDef<Manifest>): AdapterDef<Manifest> {
  const adapterId = def.manifest.name;

  if (registry.has(adapterId)) {
    throw new Error(`Duplicate adapter: ${adapterId}`);
  }

  registry.set(adapterId, def);
  return def;
}

// Build an adapter with validated runtime config
export function buildAdapter(adapterId: string, rawConfig: unknown, io: EngineIO): BuiltAdapter {
  const def = registry.get(adapterId);

  if (!def) {
    const available = Array.from(registry.keys()).join(', ');
    throw new Error(`Unknown adapter: ${adapterId}. Available: ${available}`);
  }

  // Validate that rawConfig matches the manifest's trackables structure
  const validatedConfig = validateConfigAgainstManifest(rawConfig, def.manifest);

  // Build the adapter with validated config
  return def.build({ config: validatedConfig, io });
}

// Get adapter manifest (for runtime metadata)
export function getAdapterMeta(adapterId: string): { name: string; semver: string } | null {
  const def = registry.get(adapterId);
  return def ? { name: def.manifest.name, semver: def.manifest.version } : null;
}

// Get full manifest if needed elsewhere
export function getManifest(adapterId: string): Manifest | null {
  return registry.get(adapterId)?.manifest ?? null;
}
