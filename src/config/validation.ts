import { z } from 'zod';
import { Manifest, TrackableDef, FieldDef, ConfigFromManifest } from '../types/manifest.ts';
import { FeedSchema, Feed } from '../types/asset.ts';
import { globalFeedRegistry } from '../feeds/registry.ts';
import { formatZodError } from '../utils/zod-error.ts';
// import { AssetConfig } from './schema.ts';

/**
 * Validates runtime config against an adapter's manifest.
 *
 * This function:
 * 1. Ensures rawConfig is an object with keys matching manifest trackables
 * 2. Validates each trackable's instances array
 * 3. For each instance, validates params, assetSelectors, filters, and pricing
 * 4. Uses Zod schemas defined in FieldDefs to validate individual fields
 * 5. Returns properly typed and validated config
 *
 * @throws {Error} if validation fails with descriptive error messages
 */
export function validateConfigAgainstManifest<M extends Manifest>(
  rawConfig: unknown,
  manifest: M,
): ConfigFromManifest<M> {
  // 1. Ensure rawConfig is an object
  if (typeof rawConfig !== 'object' || rawConfig === null) {
    throw new Error(`Config must be an object, got ${typeof rawConfig}`);
  }

  const config = rawConfig as Record<string, unknown>;
  const validatedConfig: Record<string, any[]> = {};

  // 2. Iterate through each trackable defined in the manifest
  for (const [trackableId, trackableDef] of Object.entries(manifest.trackables)) {
    const instances = config[trackableId];

    // If trackable not provided in config, initialize as empty array
    if (instances === undefined || instances === null) {
      validatedConfig[trackableId] = [];
      continue;
    }

    // Instances must be an array
    if (!Array.isArray(instances)) {
      throw new Error(
        `Config for trackable '${trackableId}' must be an array, got ${typeof instances}`,
      );
    }

    // Validate each instance
    const validatedInstances = instances.map((instance, idx) => {
      if (typeof instance !== 'object' || instance === null) {
        throw new Error(
          `Instance ${idx} of trackable '${trackableId}' must be an object, got ${typeof instance}`,
        );
      }

      return validateInstance(trackableId, instance as Record<string, unknown>, trackableDef, idx);
    });

    validatedConfig[trackableId] = validatedInstances;
  }

  // 3. Check for unknown trackables in config
  for (const trackableId of Object.keys(config)) {
    if (!manifest.trackables[trackableId]) {
      const available = Object.keys(manifest.trackables).join(', ');
      throw new Error(
        `Unknown trackable '${trackableId}' in config. Available trackables: ${available}`,
      );
    }
  }

  return validatedConfig as ConfigFromManifest<M>;
}

/**
 * Recursively validates a feed config against its handler's schema
 *
 * @param feedConfig - The feed configuration object to validate
 * @param path - The path to this config (for error messages)
 * @returns Validated feed config
 * @throws {Error} if validation fails with descriptive error messages
 */
function validateFeedConfig(feedConfig: unknown, path: string = 'pricing'): Feed {
  // First validate that it's an object with a 'kind' field
  if (typeof feedConfig !== 'object' || feedConfig === null) {
    throw new Error(`${path} must be an object, got ${typeof feedConfig}`);
  }

  const config = feedConfig as Record<string, unknown>;

  if (!config.kind || typeof config.kind !== 'string') {
    throw new Error(`${path}.kind is required and must be a string`);
  }

  const kind = config.kind;

  // Look up the feed handler by kind
  const handler = globalFeedRegistry.getAll().get(kind);

  if (!handler) {
    const availableHandlers = Array.from(globalFeedRegistry.getAll().keys()).join(', ');
    throw new Error(
      `${path}: Unknown feed handler '${kind}'. Available handlers: ${availableHandlers}`,
    );
  }

  // Validate required environment variables for this handler
  if (handler.manifest?.requiredEnvVars) {
    for (const [envVarName, zodSchema] of Object.entries(handler.manifest.requiredEnvVars)) {
      const envValue = process.env[envVarName];

      if (envValue === undefined) {
        throw new Error(
          `${path}: Feed handler "${kind}" requires environment variable "${envVarName}" to be set, but it is not defined. Please set this variable in your environment.`,
        );
      }

      // Validate the value against the Zod schema
      const validation = zodSchema.safeParse(envValue);
      if (!validation.success) {
        throw new Error(
          `${path}: Feed handler "${kind}" requires environment variable "${envVarName}" but the value is invalid: ${validation.error.issues.map((i) => i.message).join(', ')}`,
        );
      }
    }
  }

  // Validate the entire config against the handler's schema
  try {
    const validated = handler.configSchema.parse(config) as Record<string, any>;

    // Recursively validate nested feed configs
    // We need to check if any fields in the validated config are themselves feed configs
    const result: Record<string, any> = {
      kind, // Preserve the 'kind' field (handler schemas don't include it)
      ...validated,
    };
    for (const [key, value] of Object.entries(validated)) {
      if (key === 'kind') continue; // Skip the kind field itself

      // Check if this field looks like a feed config (has a 'kind' property)
      if (value && typeof value === 'object' && 'kind' in value) {
        result[key] = validateFeedConfig(value, `${path}.${key}`);
      }
    }

    return result as Feed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Feed config validation failed at ${path}:\n${formatZodError(error)}`);
    }
    throw error;
  }
}

/**
 * Validates a single trackable instance against its definition
 */
function validateInstance(
  trackableId: string,
  instance: Record<string, unknown>,
  trackableDef: TrackableDef,
  instanceIdx: number,
): any {
  const validated: Record<string, any> = {
    trackableName: trackableId, // Include trackable name for ID generation and filtering
    quantityType: trackableDef.quantityType,
  };

  // 1. Validate required params
  if (!instance.params || typeof instance.params !== 'object') {
    throw new Error(
      `Instance ${instanceIdx} of trackable '${trackableId}' is missing required 'params' field`,
    );
  }

  const params = instance.params as Record<string, unknown>;
  validated.params = validateFields(
    trackableId,
    'params',
    params,
    trackableDef.params,
    instanceIdx,
    true, // params are required
  );

  // 2. Validate optional assetSelectors (if defined in manifest)
  if ('assetSelectors' in trackableDef && trackableDef.assetSelectors) {
    if (instance.assetSelectors !== undefined) {
      if (typeof instance.assetSelectors !== 'object' || instance.assetSelectors === null) {
        throw new Error(
          `Instance ${instanceIdx} of trackable '${trackableId}': assetSelectors must be an object`,
        );
      }

      validated.assetSelectors = validateFields(
        trackableId,
        'assetSelectors',
        instance.assetSelectors as Record<string, unknown>,
        trackableDef.assetSelectors,
        instanceIdx,
        false, // assetSelectors are optional
      );
    }
  } else if (instance.assetSelectors !== undefined) {
    throw new Error(
      `Instance ${instanceIdx} of trackable '${trackableId}': assetSelectors not allowed for this trackable`,
    );
  }

  // 3. Validate optional filters (if defined in manifest)
  if ('filters' in trackableDef && trackableDef.filters) {
    if (instance.filters !== undefined) {
      if (typeof instance.filters !== 'object' || instance.filters === null) {
        throw new Error(
          `Instance ${instanceIdx} of trackable '${trackableId}': filters must be an object`,
        );
      }

      validated.filters = validateFields(
        trackableId,
        'filters',
        instance.filters as Record<string, unknown>,
        trackableDef.filters,
        instanceIdx,
        false, // filters are optional
      );
    }
  } else if (instance.filters !== undefined) {
    throw new Error(
      `Instance ${instanceIdx} of trackable '${trackableId}': filters not allowed for this trackable`,
    );
  }

  // 4. Validate pricing config (if provided)
  if (instance.pricing !== undefined) {
    // Validate pricing against feed handler schema (recursively)
    try {
      validated.pricing = validateFeedConfig(
        instance.pricing,
        `Instance ${instanceIdx} of trackable '${trackableId}': pricing`,
      );
    } catch (error) {
      throw new Error(
        `Instance ${instanceIdx} of trackable '${trackableId}': ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // If trackable requires pricing, ensure pricing is provided
    if ('requiredPricer' in trackableDef && trackableDef.requiredPricer) {
      // Pricing is provided, this is good
      // Further validation of pricing structure would happen in pricing engine
    }
  } else if ('requiredPricer' in trackableDef && trackableDef.requiredPricer) {
    // Trackable requires pricing but none provided
    throw new Error(
      `Instance ${instanceIdx} of trackable '${trackableId}': pricing is required (needs pricer: ${trackableDef.requiredPricer})`,
    );
  }

  // 5. Check for unknown fields in instance
  const allowedFields = ['params', 'assetSelectors', 'filters', 'pricing'];
  for (const key of Object.keys(instance)) {
    if (!allowedFields.includes(key)) {
      throw new Error(
        `Instance ${instanceIdx} of trackable '${trackableId}': unknown field '${key}'`,
      );
    }
  }

  return validated;
}

/**
 * Validates a set of fields (params/assetSelectors/filters) against their FieldDef definitions
 */
function validateFields(
  trackableId: string,
  fieldType: string,
  providedFields: Record<string, unknown>,
  fieldDefs: Record<string, FieldDef>,
  instanceIdx: number,
  allRequired: boolean,
): Record<string, any> {
  const validated: Record<string, any> = {};

  // Validate each field defined in the manifest
  for (const [fieldName, fieldDef] of Object.entries(fieldDefs)) {
    const value = providedFields[fieldName];

    if (value === undefined) {
      if (allRequired) {
        throw new Error(
          `Instance ${instanceIdx} of trackable '${trackableId}': missing required ${fieldType}.${fieldName}`,
        );
      }
      // Optional field, skip
      continue;
    }

    // Use the Zod schema from FieldDef to validate
    try {
      validated[fieldName] = fieldDef.schema.parse(value);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(
          `Instance ${instanceIdx} of trackable '${trackableId}': validation failed for ${fieldType}.${fieldName}:\n${formatZodError(error, { value })}`,
        );
      }
      throw new Error(
        `Instance ${instanceIdx} of trackable '${trackableId}': validation failed for ${fieldType}.${fieldName}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Check for unknown fields
  for (const fieldName of Object.keys(providedFields)) {
    if (!fieldDefs[fieldName]) {
      const available = Object.keys(fieldDefs).join(', ');
      throw new Error(
        `Instance ${instanceIdx} of trackable '${trackableId}': unknown ${fieldType} field '${fieldName}'. Available: ${available}`,
      );
    }
  }

  return validated;
}
