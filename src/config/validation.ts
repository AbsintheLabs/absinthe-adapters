import { z } from 'zod';
import { Manifest, TrackableDef, FieldDef, ConfigFromManifest } from '../types/manifest.ts';

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
 * Validates a single trackable instance against its definition
 */
function validateInstance(
  trackableId: string,
  instance: Record<string, unknown>,
  trackableDef: TrackableDef,
  instanceIdx: number,
): any {
  const validated: Record<string, any> = {};

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
    // Basic validation - pricing must be an object
    // Detailed pricing validation would happen elsewhere in the pricing engine
    if (typeof instance.pricing !== 'object' || instance.pricing === null) {
      throw new Error(
        `Instance ${instanceIdx} of trackable '${trackableId}': pricing must be an object`,
      );
    }

    validated.pricing = instance.pricing;

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
        const issues = error.issues.map((issue) => issue.message).join(', ');
        throw new Error(
          `Instance ${instanceIdx} of trackable '${trackableId}': validation failed for ${fieldType}.${fieldName}: ${issues}`,
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
